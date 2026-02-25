/**
 * 链上扫描服务（子包内实现）
 *
 * @author Telegram @Mhuai8
 */

import axios from 'axios';
import Decimal from 'decimal.js';
import TronWebModule from 'tronweb';
import { Op } from 'sequelize';
import PaymentOrder from '../models/PaymentOrder';
import PaymentWallet from '../models/PaymentWallet';
import PaymentTransaction from '../models/PaymentTransaction';
import type { ConfirmedOrder, ObeliskUSDTDeps } from '../types';

const TronWeb = (TronWebModule as any).TronWeb || (TronWebModule as any).default || TronWebModule;

interface TronscanTransferItem {
  to?: string;
  from?: string;
  amount?: string;
  block_timestamp?: number;
  hash?: string;
  block?: number;
  contract_ret?: string;
}

export function createBlockScannerService(deps: ObeliskUSDTDeps, configService: any, orderService?: any) {
  let tronWeb: any = null;
  let isScanning = false;
  let timer: NodeJS.Timeout | null = null;

  async function ensureTronWeb(): Promise<void> {
    if (tronWeb) return;
    tronWeb = new TronWeb({
      fullHost: await configService.getTronGridApiUrl(),
      headers: (await configService.getTronGridApiKey())
        ? { 'TRON-PRO-API-KEY': await configService.getTronGridApiKey() }
        : {},
    });
  }

  function convertSunToUSDTString(sunAmount: string): string {
    return new Decimal(sunAmount).div(1_000_000).toFixed(4);
  }

  async function fetchTransfersByWallet(address: string): Promise<Array<{
    txHash: string;
    fromAddress: string;
    toAddress: string;
    amountSun: string;
    amountUsdt: string;
    blockNumber: number;
    blockTimestamp: number;
  }>> {
    const baseUrl = await configService.getTronscanApiUrl();
    const trc20Id = await configService.getUSDTContractAddress();
    const timeWindowMs = await configService.getScanTimeWindowMs();
    const limit = await configService.getScanTrc20Limit();
    const now = Date.now();
    const start = now - timeWindowMs;

    const headers: Record<string, string> = {};
    const tronscanApiKey = await configService.getTronscanApiKey();
    if (tronscanApiKey) {
      headers['TRON-PRO-API-KEY'] = tronscanApiKey;
    }

    const res = await axios.get<{ data?: TronscanTransferItem[] }>(
      `${baseUrl.replace(/\/$/, '')}/api/transfer/trc20`,
      {
        params: {
          address,
          start_timestamp: start,
          end_timestamp: now,
          limit,
          trc20Id,
          direction: 2,
          sort: '-timestamp',
          start: 0,
          db_version: 1,
        },
        headers,
        timeout: 15_000,
      },
    );

    const list = res.data?.data || [];
    const normalized: Array<{
      txHash: string;
      fromAddress: string;
      toAddress: string;
      amountSun: string;
      amountUsdt: string;
      blockNumber: number;
      blockTimestamp: number;
    }> = [];

    for (const item of list) {
      if (item.contract_ret !== 'SUCCESS') continue;
      if (!item.hash || !item.amount || !item.to) continue;
      if (String(item.to).toLowerCase() !== address.toLowerCase()) continue;
      normalized.push({
        txHash: String(item.hash),
        fromAddress: String(item.from || ''),
        toAddress: String(item.to),
        amountSun: String(item.amount),
        amountUsdt: convertSunToUSDTString(String(item.amount)),
        blockNumber: Number(item.block || 0),
        blockTimestamp: Number(item.block_timestamp || 0),
      });
    }

    return normalized;
  }

  async function dispatchConfirmedOrder(order: any): Promise<void> {
    const metadata = (order.metadata || {}) as Record<string, unknown>;
    const safeMetadata: Record<string, unknown> = { ...metadata };
    if (Object.prototype.hasOwnProperty.call(safeMetadata, 'orderTokenHash')) {
      delete (safeMetadata as any).orderTokenHash;
    }
    const payload: ConfirmedOrder = {
      id: order.id,
      orderNo: order.orderNo,
      bizOrderNo: order.bizOrderNo,
      baseAmount: order.baseAmount,
      actualAmount: order.actualAmount,
      walletAddress: order.walletAddress,
      txHash: order.txHash,
      blockNumber: order.blockNumber,
      confirmations: order.confirmations,
      requiredConfirmations: order.requiredConfirmations,
      metadata: Object.keys(safeMetadata).length ? safeMetadata : null,
    };
    if (deps.onOrderConfirmed) {
      await deps.onOrderConfirmed(payload);
    }
  }

  async function markPaidOrder(transfer: {
    txHash: string;
    fromAddress: string;
    toAddress: string;
    amountSun: string;
    amountUsdt: string;
    blockNumber: number;
    blockTimestamp: number;
  }): Promise<void> {
    const [txRecord] = await PaymentTransaction.findOrCreate({
      where: { txHash: transfer.txHash },
      defaults: {
        txHash: transfer.txHash,
        fromAddress: transfer.fromAddress,
        toAddress: transfer.toAddress,
        amount: transfer.amountSun,
        amountInUSDT: transfer.amountUsdt,
        blockNumber: transfer.blockNumber,
        blockTimestamp: transfer.blockTimestamp,
        isMatched: false,
      } as any,
    });

    if (txRecord.isMatched) return;

    const order = await PaymentOrder.findOne({
      where: {
        status: 'pending',
        walletAddress: transfer.toAddress,
        actualAmount: transfer.amountUsdt,
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [['createdAt', 'ASC']],
    });
    if (!order) return;

    const [affectedRows] = await PaymentOrder.update(
      {
        status: 'paid',
        txHash: transfer.txHash,
        blockNumber: transfer.blockNumber,
        paidAt: new Date(),
      },
      { where: { id: order.id, status: 'pending' } },
    );
    if (affectedRows === 0) return;

    await txRecord.update({
      orderId: order.id,
      orderNo: order.orderNo,
      isMatched: true,
      matchedAt: new Date(),
    } as any);

    if (orderService?.amountService?.releaseLock) {
      try {
        await orderService.amountService.releaseLock(order.walletAddress, order.actualAmount);
      } catch (error) {
        deps.logger.warn('[ObeliskUSDT] 释放金额锁失败', {
          orderNo: order.orderNo,
          walletAddress: order.walletAddress,
          actualAmount: order.actualAmount,
          error,
        });
      }
    }

    deps.logger.info('[ObeliskUSDT] 匹配到支付交易', {
      orderNo: order.orderNo,
      txHash: transfer.txHash,
      walletAddress: transfer.toAddress,
      actualAmount: transfer.amountUsdt,
    });
  }

  async function scanWalletTransfers(): Promise<void> {
    const wallets = await PaymentWallet.findAll({ where: { isActive: true }, attributes: ['address'] });
    for (const wallet of wallets) {
      try {
        const transfers = await fetchTransfersByWallet(wallet.address);
        for (const transfer of transfers) {
          await markPaidOrder(transfer);
        }
      } catch (error) {
        deps.logger.warn('[ObeliskUSDT] 钱包扫描失败', { wallet: wallet.address, error });
      }
    }
  }

  async function updateConfirmations(): Promise<void> {
    await ensureTronWeb();
    const orders = await PaymentOrder.findAll({
      where: {
        status: { [Op.in]: ['paid', 'confirmed'] },
        txHash: { [Op.ne]: null },
      },
      limit: 100,
      order: [['updatedAt', 'ASC']],
    });

    if (orders.length === 0) return;
    const currentBlock = await tronWeb.trx.getCurrentBlock();
    const currentBlockNumber = Number(currentBlock?.block_header?.raw_data?.number || 0);

    for (const order of orders) {
      if (!order.blockNumber) continue;
      const confirmations = Math.max(0, currentBlockNumber - Number(order.blockNumber) + 1);
      await order.update({ confirmations } as any);

      if (order.status === 'paid' && confirmations >= Number(order.requiredConfirmations || 6)) {
        await order.update({ status: 'confirmed', confirmedAt: new Date() } as any);
        deps.logger.info('[ObeliskUSDT] 订单已确认', {
          orderNo: order.orderNo,
          txHash: order.txHash,
          confirmations,
          requiredConfirmations: order.requiredConfirmations,
        });
      }

      if (order.status === 'confirmed' && confirmations >= Number(order.requiredConfirmations || 6)) {
        try {
          await dispatchConfirmedOrder(order);
          await order.update({ status: 'completed', completedAt: new Date() } as any);
          deps.logger.info('[ObeliskUSDT] 订单已完成', {
            orderNo: order.orderNo,
            txHash: order.txHash,
          });
        } catch (error) {
          deps.logger.error('[ObeliskUSDT] 回调处理失败，等待下次重试', {
            orderNo: order.orderNo,
            txHash: order.txHash,
            error,
          });
        }
      }
    }
  }

  async function scanLoop(): Promise<void> {
    if (!isScanning) return;
    try {
      await scanWalletTransfers();
      await updateConfirmations();
    } catch (error) {
      deps.logger.error('[ObeliskUSDT] 扫描循环异常', error);
    }
    const interval = await configService.getScanInterval();
    timer = setTimeout(() => {
      scanLoop();
    }, interval);
  }

  return {
    async start(): Promise<void> {
      if (isScanning) return;
      await configService.initializeDefaults();
      await ensureTronWeb();
      isScanning = true;
      deps.logger.info('[ObeliskUSDT] 扫描器已启动');
      await scanLoop();
    },
    async stop(): Promise<void> {
      isScanning = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      deps.logger.info('[ObeliskUSDT] 扫描器已停止');
    },
    async updateConfirmations(): Promise<void> {
      await updateConfirmations();
    },
    async dispatchConfirmedOrder(orderId: number): Promise<void> {
      const order = await PaymentOrder.findByPk(orderId);
      if (!order) return;
      await dispatchConfirmedOrder(order);
    },
  };
}
