/**
 * 订单服务
 *
 * @author Telegram @Mhuai8
 */

import { Op } from 'sequelize';
import PaymentOrder from '../models/PaymentOrder';
import { createAmountAllocationService } from './amountAllocation';
import type { ObeliskUSDTDeps } from '../types';

export function createPaymentOrderService(deps: ObeliskUSDTDeps, configService: any) {
  const amountService = createAmountAllocationService(deps, configService);

  function generateOrderNo(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PAY${timestamp}${random}`;
  }

  return {
    async createOrder(params: {
      baseAmount: number | string;
      bizOrderNo: string;
      metadata?: Record<string, unknown> | null;
    }) {
      const bizOrderNo = String(params.bizOrderNo || '').trim();
      if (!bizOrderNo) throw new Error('业务单号不能为空');
      if (bizOrderNo.length > 64) throw new Error('业务单号长度不能超过64');
      const baseAmountNumber = Number(params.baseAmount);
      if (!Number.isFinite(baseAmountNumber) || baseAmountNumber <= 0) {
        throw new Error('支付金额无效');
      }
      const metadata = params.metadata ? params.metadata : null;
      const normalizedBaseAmount = baseAmountNumber.toFixed(2);

      const allocation = await amountService.allocateAmount(normalizedBaseAmount);
      const expiresAt = new Date();
      const expireMinutes = await configService.getOrderExpireMinutes();
      expiresAt.setMinutes(expiresAt.getMinutes() + expireMinutes);
      const requiredConfirmations = await configService.getRequiredConfirmations();
      const order = await PaymentOrder.create({
        orderNo: generateOrderNo(),
        bizOrderNo,
        baseAmount: normalizedBaseAmount,
        actualAmount: allocation.actualAmount,
        amountInSun: allocation.amountInSun,
        walletAddress: allocation.walletAddress,
        walletId: allocation.walletId,
        requiredConfirmations,
        status: 'pending',
        expiresAt,
        metadata,
      } as any);
      deps.logger.info(`[ObeliskUSDT] 创建订单成功 ${order.orderNo}`);
      return order;
    },
    async cancelOrder(orderNo: string): Promise<void> {
      const order = await PaymentOrder.findOne({ where: { orderNo } });
      if (!order) throw new Error('订单不存在');
      if (order.status !== 'pending') throw new Error('只能取消待支付订单');
      const [affectedRows] = await PaymentOrder.update({ status: 'cancelled' }, { where: { id: order.id, status: 'pending' } });
      if (affectedRows === 0) throw new Error('订单状态已变更，无法取消');
      await amountService.releaseLock(order.walletAddress, order.actualAmount);
    },
    async cancelOrderById(orderId: number): Promise<void> {
      const order = await PaymentOrder.findByPk(orderId);
      if (!order) throw new Error('订单不存在');
      if (order.status !== 'pending') throw new Error('只能取消待支付订单');
      const [affectedRows] = await PaymentOrder.update({ status: 'cancelled' }, { where: { id: order.id, status: 'pending' } });
      if (affectedRows === 0) throw new Error('订单状态已变更，无法取消');
      await amountService.releaseLock(order.walletAddress, order.actualAmount);
    },
    async processExpiredOrders(): Promise<void> {
      const expiredOrders = await PaymentOrder.findAll({
        where: { status: 'pending', expiresAt: { [Op.lt]: new Date() } },
      });
      for (const order of expiredOrders) {
        await order.update({ status: 'expired' });
        await amountService.releaseLock(order.walletAddress, order.actualAmount);
      }
    },
    isOrderExpired(order: any): boolean {
      return new Date() > order.expiresAt;
    },
    amountService,
  };
}
