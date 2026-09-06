/**
 * 链上扫描服务（子包内实现）
 *
 * @author Telegram @okgeceo
 */

import Decimal from 'decimal.js';
import TronWebModule from 'tronweb';
import axios from 'axios';
import type { ConfirmedOrder, ObeliskUSDTDepsResolved } from '../types';

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

interface TronGridTransferItem {
  transaction_id?: string;
  token_info?: {
    address?: string;
  };
  block_timestamp?: number;
  from?: string;
  to?: string;
  value?: string;
}

interface ScannerHealthStats {
  providerFailureCount: number;
  providerCircuitOpenUntil: number;
  providerBackoffMs: number;
  callbackQueueSize: number;
  callbackDeadLetterSize: number;
  lastScanAt: number | null;
  lastActivityAt: number | null;
  idleRounds: number;
}

export function createBlockScannerService(deps: ObeliskUSDTDepsResolved, configService: any, orderService?: any) {
  const { order, wallet, transaction } = deps.persistence;
  let tronWeb: any = null;
  let isScanning = false;
  let timer: NodeJS.Timeout | null = null;
  let providerFailureCount = 0;
  let providerCircuitOpenUntil = 0;
  let providerBackoffMs = 0;
  let lastScanAt: number | null = null;
  let lastActivityAt: number | null = null;
  let idleRounds = 0;
  const walletScanConcurrency = 5;
  const configCacheTtlMs = 10_000;
  const configCache = new Map<string, { value: unknown; expiresAt: number }>();
  const txBlockNumberCache = new Map<string, { value: number; expiresAt: number }>();
  const callbackQueue: Array<{ orderId: number; retries: number; nextRetryAt: number; lastError?: string }> = [];
  const callbackDeadLetters: Array<{ orderId: number; error: string; failedAt: number }> = [];
  const queuedOrderIds = new Set<number>();

  async function getCachedConfig<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = configCache.get(key);
    if (hit && hit.expiresAt > now) {
      return hit.value as T;
    }
    const value = await loader();
    configCache.set(key, { value, expiresAt: now + configCacheTtlMs });
    return value;
  }

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

  function isProviderCircuitOpen(): boolean {
    return Date.now() < providerCircuitOpenUntil;
  }

  function onProviderSuccess(): void {
    providerFailureCount = 0;
    providerBackoffMs = 0;
    providerCircuitOpenUntil = 0;
  }

  function onProviderFailure(error: unknown, walletAddress?: string): void {
    providerFailureCount += 1;
    deps.logger.warn('[ObeliskUSDT] 外部扫描源请求失败', {
      walletAddress,
      failureCount: providerFailureCount,
      error,
    });
    if (providerFailureCount < 3) return;
    providerBackoffMs = providerBackoffMs > 0 ? Math.min(providerBackoffMs * 2, 120_000) : 10_000;
    providerCircuitOpenUntil = Date.now() + providerBackoffMs;
    deps.logger.warn('[ObeliskUSDT] 外部扫描源熔断已开启', {
      failureCount: providerFailureCount,
      backoffMs: providerBackoffMs,
      reopenAt: new Date(providerCircuitOpenUntil).toISOString(),
    });
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
    const baseUrl = await getCachedConfig<string>('tronscanApiUrl', () => configService.getTronscanApiUrl());
    const tronGridBaseUrl = await getCachedConfig<string>('tronGridApiUrl', () => configService.getTronGridApiUrl());
    const trc20Id = await getCachedConfig<string>('usdtContract', () => configService.getUSDTContractAddress());
    const timeWindowMs = await getCachedConfig<number>('scanTimeWindowMs', () => configService.getScanTimeWindowMs());
    const limit = await getCachedConfig<number>('scanTrc20Limit', () => configService.getScanTrc20Limit());
    const now = Date.now();
    const start = now - timeWindowMs;

    const headers: Record<string, string> = {};
    const tronscanApiKey = await getCachedConfig<string>('tronscanApiKey', () => configService.getTronscanApiKey());
    if (tronscanApiKey) {
      headers['TRON-PRO-API-KEY'] = tronscanApiKey;
    }

    const normalized: Array<{
      txHash: string;
      fromAddress: string;
      toAddress: string;
      amountSun: string;
      amountUsdt: string;
      blockNumber: number;
      blockTimestamp: number;
    }> = [];

    // 先走 TronGrid，稳定性更高。
    try {
      const gridRes = await axios.get<{ data?: TronGridTransferItem[] }>(
        `${tronGridBaseUrl.replace(/\/$/, '')}/v1/accounts/${encodeURIComponent(address)}/transactions/trc20`,
        {
          params: {
            limit,
            only_confirmed: true,
            only_to: true,
            min_timestamp: start,
            max_timestamp: now,
          },
          headers,
          timeout: 15_000,
        },
      );
      const gridList = gridRes.data?.data || [];
      for (const item of gridList) {
        if (!item.transaction_id || !item.value || !item.to) continue;
        if (String(item.to).toLowerCase() !== address.toLowerCase()) continue;
        if (String(item.token_info?.address || '').toLowerCase() !== trc20Id.toLowerCase()) continue;
        normalized.push({
          txHash: String(item.transaction_id),
          fromAddress: String(item.from || ''),
          toAddress: String(item.to),
          amountSun: String(item.value),
          amountUsdt: convertSunToUSDTString(String(item.value)),
          // TronGrid 该接口未返回 block_number，后续在匹配时补拉。
          blockNumber: 0,
          blockTimestamp: Number(item.block_timestamp || 0),
        });
      }
    } catch (error) {
      deps.logger.warn('[ObeliskUSDT] TronGrid 查询失败，回退 Tronscan', { address, error });
    }

    if (normalized.length > 0) return normalized;

    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/transfer/trc20`;
    const commonParams = {
      address,
      limit,
      trc20Id,
      direction: 2,
      sort: '-timestamp',
      start: 0,
      db_version: 1,
    };

    const firstRes = await axios.get<{ data?: TronscanTransferItem[] }>(endpoint, {
      params: {
        ...commonParams,
        start_timestamp: start,
        end_timestamp: now,
      },
      headers,
      timeout: 15_000,
    });

    let list = firstRes.data?.data || [];
    if (list.length === 0) {
      const fallbackRes = await axios.get<{ data?: TronscanTransferItem[] }>(endpoint, {
        params: commonParams,
        headers,
        timeout: 15_000,
      });
      list = fallbackRes.data?.data || [];
    }

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
    let resolvedBlockNumber = Number(transfer.blockNumber || 0);
    if (resolvedBlockNumber <= 0 && transfer.txHash) {
      const cached = txBlockNumberCache.get(transfer.txHash);
      if (cached && cached.expiresAt > Date.now()) {
        resolvedBlockNumber = cached.value;
      }
    }
    if (resolvedBlockNumber <= 0 && transfer.txHash) {
      try {
        await ensureTronWeb();
        const txInfo = await tronWeb.trx.getTransactionInfo(transfer.txHash);
        resolvedBlockNumber = Number(txInfo?.blockNumber || 0);
        if (resolvedBlockNumber > 0) {
          txBlockNumberCache.set(transfer.txHash, {
            value: resolvedBlockNumber,
            expiresAt: Date.now() + 5 * 60 * 1000,
          });
        }
      } catch (error) {
        deps.logger.warn('[ObeliskUSDT] 获取交易区块高度失败', {
          txHash: transfer.txHash,
          error,
        });
      }
    }

    const { row: txRecord } = await transaction.findOrCreateIncoming(transfer.txHash, {
      txHash: transfer.txHash,
      fromAddress: transfer.fromAddress,
      toAddress: transfer.toAddress,
      amount: transfer.amountSun,
      amountInUSDT: transfer.amountUsdt,
      blockNumber: resolvedBlockNumber,
      blockTimestamp: transfer.blockTimestamp,
      isMatched: false,
    });

    if (txRecord.isMatched) return;

    const matchedOrder = await order.findPendingForIncomingMatch({
      walletAddress: transfer.toAddress,
      actualAmount: transfer.amountUsdt,
      now: new Date(),
    });
    if (!matchedOrder) return;

    const affectedRows = await order.updateToPaidIfStillPending(matchedOrder.id, {
      status: 'paid',
      txHash: transfer.txHash,
      blockNumber: resolvedBlockNumber > 0 ? resolvedBlockNumber : null,
      paidAt: new Date(),
    });
    if (affectedRows === 0) return;

    await transaction.updateById(txRecord.id, {
      orderId: matchedOrder.id,
      orderNo: matchedOrder.orderNo,
      isMatched: true,
      matchedAt: new Date(),
    });

    if (orderService?.amountService?.releaseLock) {
      try {
        await orderService.amountService.releaseLock(matchedOrder.walletAddress, matchedOrder.actualAmount);
      } catch (error) {
        deps.logger.warn('[ObeliskUSDT] 释放金额锁失败', {
          orderNo: matchedOrder.orderNo,
          walletAddress: matchedOrder.walletAddress,
          actualAmount: matchedOrder.actualAmount,
          error,
        });
      }
    }

    deps.logger.info('[ObeliskUSDT] 匹配到支付交易', {
      orderNo: matchedOrder.orderNo,
      txHash: transfer.txHash,
      walletAddress: transfer.toAddress,
      actualAmount: transfer.amountUsdt,
    });
  }

  async function scanWalletTransfers(): Promise<{ matchedCount: number }> {
    if (isProviderCircuitOpen()) {
      deps.logger.warn('[ObeliskUSDT] 外部扫描源熔断中，跳过本轮钱包扫描', {
        reopenAt: new Date(providerCircuitOpenUntil).toISOString(),
      });
      return { matchedCount: 0 };
    }
    const walletAddresses = await wallet.listActiveAddresses();
    let cursor = 0;
    let matchedCount = 0;
    const workers = Array.from({ length: Math.min(walletScanConcurrency, walletAddresses.length) }).map(async () => {
      while (true) {
        if (isProviderCircuitOpen()) return;
        const idx = cursor;
        cursor += 1;
        if (idx >= walletAddresses.length) return;
        const walletAddress = walletAddresses[idx];
        try {
          const transfers = await fetchTransfersByWallet(walletAddress);
          onProviderSuccess();
          matchedCount += transfers.length;
          for (const transfer of transfers) {
            await markPaidOrder(transfer);
          }
        } catch (error) {
          onProviderFailure(error, walletAddress);
          deps.logger.warn('[ObeliskUSDT] 钱包扫描失败', { wallet: walletAddress, error });
        }
      }
    });
    await Promise.all(workers);
    return { matchedCount };
  }

  async function processCallbackQueue(): Promise<{ completedCount: number }> {
    let completedCount = 0;
    const now = Date.now();
    for (const item of callbackQueue.slice()) {
      if (item.nextRetryAt > now) continue;
      try {
        const orderRow = await order.findById(item.orderId);
        if (!orderRow) {
          queuedOrderIds.delete(item.orderId);
          callbackQueue.splice(callbackQueue.indexOf(item), 1);
          continue;
        }
        if (orderRow.status === 'completed') {
          queuedOrderIds.delete(item.orderId);
          callbackQueue.splice(callbackQueue.indexOf(item), 1);
          continue;
        }
        if (orderRow.status !== 'confirmed') {
          continue;
        }

        await dispatchConfirmedOrder(orderRow);
        await order.updateById(orderRow.id, { status: 'completed', completedAt: new Date() });
        completedCount += 1;
        queuedOrderIds.delete(item.orderId);
        callbackQueue.splice(callbackQueue.indexOf(item), 1);
        deps.logger.info('[ObeliskUSDT] 订单已完成', {
          orderNo: orderRow.orderNo,
          txHash: orderRow.txHash,
        });
      } catch (error: any) {
        item.retries += 1;
        item.lastError = String(error?.message || error || 'unknown');
        if (item.retries >= 5) {
          queuedOrderIds.delete(item.orderId);
          callbackQueue.splice(callbackQueue.indexOf(item), 1);
          callbackDeadLetters.push({
            orderId: item.orderId,
            error: item.lastError,
            failedAt: Date.now(),
          });
          deps.logger.error('[ObeliskUSDT] 回调处理失败进入死信', {
            orderId: item.orderId,
            error: item.lastError,
          });
          continue;
        }
        item.nextRetryAt = Date.now() + Math.min(60_000, 2 ** item.retries * 1000);
        deps.logger.error('[ObeliskUSDT] 回调处理失败，等待重试', {
          orderId: item.orderId,
          retries: item.retries,
          nextRetryAt: new Date(item.nextRetryAt).toISOString(),
          error: item.lastError,
        });
      }
    }
    return { completedCount };
  }

  function enqueueConfirmedOrder(orderId: number): void {
    if (queuedOrderIds.has(orderId)) return;
    queuedOrderIds.add(orderId);
    callbackQueue.push({
      orderId,
      retries: 0,
      nextRetryAt: Date.now(),
    });
  }

  async function updateConfirmations(): Promise<{ confirmedCount: number }> {
    await ensureTronWeb();
    const orders = await order.findPaidOrConfirmedWithTx(500);

    if (orders.length === 0) return { confirmedCount: 0 };
    const currentBlock = await tronWeb.trx.getCurrentBlock();
    const currentBlockNumber = Number(currentBlock?.block_header?.raw_data?.number || 0);
    let confirmedCount = 0;

    for (const o of orders) {
      if (!o.blockNumber) continue;
      const confirmations = Math.max(0, currentBlockNumber - Number(o.blockNumber) + 1);
      if (o.confirmations !== confirmations) {
        await order.updateById(o.id, { confirmations });
      }

      let nextStatus = o.status;
      if (o.status === 'paid' && confirmations >= Number(o.requiredConfirmations || 6)) {
        await order.updateById(o.id, { status: 'confirmed', confirmedAt: new Date() });
        confirmedCount += 1;
        nextStatus = 'confirmed';
        deps.logger.info('[ObeliskUSDT] 订单已确认', {
          orderNo: o.orderNo,
          txHash: o.txHash,
          confirmations,
          requiredConfirmations: o.requiredConfirmations,
        });
        enqueueConfirmedOrder(o.id);
      }

      if (nextStatus === 'confirmed' && confirmations >= Number(o.requiredConfirmations || 6)) {
        enqueueConfirmedOrder(o.id);
      }
    }
    return { confirmedCount };
  }

  async function scanLoop(): Promise<void> {
    if (!isScanning) return;
    lastScanAt = Date.now();
    let matchedCount = 0;
    let confirmedCount = 0;
    let completedCount = 0;
    try {
      const scanResult = await scanWalletTransfers();
      matchedCount = scanResult.matchedCount;
      const confirmResult = await updateConfirmations();
      confirmedCount = confirmResult.confirmedCount;
      const callbackResult = await processCallbackQueue();
      completedCount = callbackResult.completedCount;
    } catch (error) {
      deps.logger.error('[ObeliskUSDT] 扫描循环异常', error);
    }
    const activity = matchedCount + confirmedCount + completedCount;
    if (activity > 0) {
      lastActivityAt = Date.now();
      idleRounds = 0;
    } else {
      idleRounds += 1;
    }
    const baseInterval = await getCachedConfig<number>('scanInterval', () => configService.getScanInterval());
    const interval = activity > 0
      ? 2_000
      : Math.min(12_000, Math.max(Number(baseInterval), 3_000) + Math.min(8_000, idleRounds * 1_000));
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
      const row = await order.findById(orderId);
      if (!row) return;
      await dispatchConfirmedOrder(row);
    },
    getHealthStats(): ScannerHealthStats {
      return {
        providerFailureCount,
        providerCircuitOpenUntil,
        providerBackoffMs,
        callbackQueueSize: callbackQueue.length,
        callbackDeadLetterSize: callbackDeadLetters.length,
        lastScanAt,
        lastActivityAt,
        idleRounds,
      };
    },
  };
}
