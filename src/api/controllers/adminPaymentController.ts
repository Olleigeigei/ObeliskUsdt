/**
 * 管理支付控制器
 *
 * @author Telegram @okgeceo
 */

import type { Request, Response } from 'express';
import type { ObeliskPersistence } from '../../persistence/obeliskPersistence';
import { success, fail } from '../response';

function toPositiveInt(value: unknown, defaultValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(1, Math.floor(parsed));
}

export function createAdminPaymentController(services: {
  orderService: any;
  configService: any;
  scanner: any;
  persistence: ObeliskPersistence;
}) {
  const { order, wallet, transaction } = services.persistence;

  return {
    getWalletStats: async (_req: Request, res: Response) => {
      try {
        const total = await wallet.count();
        const active = await wallet.countActive();
        success(res, { total, active, inactive: total - active }, '获取钱包统计成功');
      } catch (error: any) {
        fail(res, 'GET_WALLET_STATS_FAILED', error?.message || '获取钱包统计失败', 500);
      }
    },

    getWalletList: async (_req: Request, res: Response) => {
      try {
        const list = await wallet.listForAdminOrdered();
        success(res, { list }, '获取钱包列表成功');
      } catch (error: any) {
        fail(res, 'GET_WALLET_LIST_FAILED', error?.message || '获取钱包列表失败', 500);
      }
    },

    getWalletDetail: async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        const item = await wallet.findById(id);
        if (!item) {
          fail(res, 'WALLET_NOT_FOUND', '钱包不存在', 404);
          return;
        }
        success(res, item, '获取钱包详情成功');
      } catch (error: any) {
        fail(res, 'GET_WALLET_DETAIL_FAILED', error?.message || '获取钱包详情失败', 500);
      }
    },

    createWallet: async (req: Request, res: Response) => {
      try {
        const body = req.body || {};
        const item = await wallet.create({
          address: String(body.address || '').trim(),
          label: String(body.label || '').trim(),
          isActive: body.isActive !== false,
          priority: Number(body.priority || 0),
        });
        success(res, item, '创建钱包成功');
      } catch (error: any) {
        fail(res, 'CREATE_WALLET_FAILED', error?.message || '创建钱包失败', 500);
      }
    },

    updateWallet: async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        const body = req.body || {};
        const item = await wallet.findById(id);
        if (!item) {
          fail(res, 'WALLET_NOT_FOUND', '钱包不存在', 404);
          return;
        }
        await wallet.updateById(id, {
          address: body.address !== undefined ? String(body.address).trim() : item.address,
          label: body.label !== undefined ? String(body.label).trim() : item.label,
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : item.isActive,
          priority: body.priority !== undefined ? Number(body.priority) : item.priority,
        });
        const next = await wallet.findById(id);
        success(res, next, '更新钱包成功');
      } catch (error: any) {
        fail(res, 'UPDATE_WALLET_FAILED', error?.message || '更新钱包失败', 500);
      }
    },

    deleteWallet: async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        const item = await wallet.findById(id);
        if (!item) {
          fail(res, 'WALLET_NOT_FOUND', '钱包不存在', 404);
          return;
        }
        await wallet.deleteById(id);
        success(res, { id }, '删除钱包成功');
      } catch (error: any) {
        fail(res, 'DELETE_WALLET_FAILED', error?.message || '删除钱包失败', 500);
      }
    },

    getOrderList: async (req: Request, res: Response) => {
      try {
        const page = toPositiveInt(req.query.page, 1);
        const pageSize = Math.min(200, toPositiveInt(req.query.pageSize, 20));
        const status = req.query.status ? String(req.query.status) as any : undefined;
        const orderNoContains = req.query.orderNo ? String(req.query.orderNo) : undefined;

        const { rows, total } = await order.findPagedForAdmin({
          page,
          pageSize,
          status,
          orderNoContains,
        });

        success(res, {
          list: rows,
          pagination: { page, pageSize, total },
        }, '获取订单列表成功');
      } catch (error: any) {
        fail(res, 'GET_ORDER_LIST_FAILED', error?.message || '获取订单列表失败', 500);
      }
    },

    getOrderDetail: async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        const item = await order.findById(id);
        if (!item) {
          fail(res, 'ORDER_NOT_FOUND', '订单不存在', 404);
          return;
        }
        success(res, item, '获取订单详情成功');
      } catch (error: any) {
        fail(res, 'GET_ORDER_DETAIL_FAILED', error?.message || '获取订单详情失败', 500);
      }
    },

    confirmOrder: async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        const item = await order.findById(id);
        if (!item) {
          fail(res, 'ORDER_NOT_FOUND', '订单不存在', 404);
          return;
        }
        if (!['paid', 'confirmed'].includes(item.status)) {
          fail(res, 'INVALID_STATUS', '订单状态不允许确认', 400);
          return;
        }

        if (item.status === 'paid') {
          await order.updateById(id, { status: 'confirmed', confirmedAt: new Date() });
        }

        await services.scanner.dispatchConfirmedOrder(item.id);
        await order.updateById(id, { status: 'completed', completedAt: new Date() });

        const next = await order.findById(id);
        success(res, next, '确认订单成功');
      } catch (error: any) {
        fail(res, 'CONFIRM_ORDER_FAILED', error?.message || '确认订单失败', 500);
      }
    },

    cancelOrder: async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        await services.orderService.cancelOrderById(id);
        success(res, { id }, '取消订单成功');
      } catch (error: any) {
        fail(res, 'CANCEL_ORDER_FAILED', error?.message || '取消订单失败', 500);
      }
    },

    updateOrderRemark: async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        const item = await order.findById(id);
        if (!item) {
          fail(res, 'ORDER_NOT_FOUND', '订单不存在', 404);
          return;
        }
        const remark = String((req.body || {}).remark || '').trim();
        const metadata = (item.metadata || {}) as Record<string, unknown>;
        metadata.remark = remark;
        await order.updateById(id, { metadata });
        const next = await order.findById(id);
        success(res, next, '更新备注成功');
      } catch (error: any) {
        fail(res, 'UPDATE_ORDER_REMARK_FAILED', error?.message || '更新备注失败', 500);
      }
    },

    deleteOrder: async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        const item = await order.findById(id);
        if (!item) {
          fail(res, 'ORDER_NOT_FOUND', '订单不存在', 404);
          return;
        }
        await order.deleteById(id);
        success(res, { id }, '删除订单成功');
      } catch (error: any) {
        fail(res, 'DELETE_ORDER_FAILED', error?.message || '删除订单失败', 500);
      }
    },

    cleanupOrders: async (req: Request, res: Response) => {
      try {
        const days = Math.max(1, Number((req.body || {}).days || 30));
        const deadline = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const deleted = await order.deleteFinishedBefore(deadline, ['expired', 'cancelled', 'failed']);
        success(res, { deleted }, '清理订单成功');
      } catch (error: any) {
        fail(res, 'CLEANUP_ORDERS_FAILED', error?.message || '清理订单失败', 500);
      }
    },

    getPaymentStats: async (_req: Request, res: Response) => {
      try {
        const [ordersTotal, pending, paid, confirmed, completed, failed, txTotal] = await Promise.all([
          order.count(),
          order.countByStatus('pending'),
          order.countByStatus('paid'),
          order.countByStatus('confirmed'),
          order.countByStatus('completed'),
          order.countByStatus('failed'),
          transaction.count(),
        ]);
        const scannerStats = services.scanner?.getHealthStats ? services.scanner.getHealthStats() : null;
        success(res, {
          ordersTotal,
          pending,
          paid,
          confirmed,
          completed,
          failed,
          txTotal,
          scanner: scannerStats,
        }, '获取支付统计成功');
      } catch (error: any) {
        fail(res, 'GET_PAYMENT_STATS_FAILED', error?.message || '获取支付统计失败', 500);
      }
    },

    getNetworkConfig: async (_req: Request, res: Response) => {
      try {
        const mode = await services.configService.getNetworkMode();
        const requiredConfirmations = await services.configService.getRequiredConfirmations();
        const scanMode = await services.configService.getScanMode();
        const scanInterval = await services.configService.getScanInterval();
        success(res, { mode, requiredConfirmations, scanMode, scanInterval }, '获取网络配置成功');
      } catch (error: any) {
        fail(res, 'GET_NETWORK_CONFIG_FAILED', error?.message || '获取网络配置失败', 500);
      }
    },

    setNetworkMode: async (req: Request, res: Response) => {
      try {
        const mode = String((req.body || {}).mode || '');
        if (!['mainnet', 'testnet'].includes(mode)) {
          fail(res, 'INVALID_NETWORK_MODE', '网络模式只能是 mainnet 或 testnet', 400);
          return;
        }
        await services.configService.setNetworkMode(mode as 'mainnet' | 'testnet');
        success(res, { mode }, '设置网络模式成功');
      } catch (error: any) {
        fail(res, 'SET_NETWORK_MODE_FAILED', error?.message || '设置网络模式失败', 500);
      }
    },

    getNetworkPresets: async (_req: Request, res: Response) => {
      try {
        success(res, services.configService.getNetworkPresets(), '获取网络预设成功');
      } catch (error: any) {
        fail(res, 'GET_NETWORK_PRESETS_FAILED', error?.message || '获取网络预设失败', 500);
      }
    },
  };
}
