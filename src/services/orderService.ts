/**
 * 订单服务
 *
 * @author Telegram @okgeceo
 */

import { createAmountAllocationService } from './amountAllocation';
import type { ObeliskUSDTDepsResolved } from '../types';

export function createPaymentOrderService(deps: ObeliskUSDTDepsResolved, configService: any) {
  const amountService = createAmountAllocationService(deps, configService);
  const { order } = deps.persistence;

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
      const row = await order.create({
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
      });
      deps.logger.info(`[ObeliskUSDT] 创建订单成功 ${row.orderNo}`);
      return row;
    },
    async cancelOrder(orderNo: string): Promise<void> {
      const r = await order.cancelPendingByOrderNo(orderNo);
      if (!r.order) throw new Error('订单不存在');
      if (r.order.status !== 'pending') throw new Error('只能取消待支付订单');
      if (r.affected === 0) throw new Error('订单状态已变更，无法取消');
      await amountService.releaseLock(r.order.walletAddress, r.order.actualAmount);
    },
    async cancelOrderById(orderId: number): Promise<void> {
      const r = await order.cancelPendingById(orderId);
      if (!r.order) throw new Error('订单不存在');
      if (r.order.status !== 'pending') throw new Error('只能取消待支付订单');
      if (r.affected === 0) throw new Error('订单状态已变更，无法取消');
      await amountService.releaseLock(r.order.walletAddress, r.order.actualAmount);
    },
    async processExpiredOrders(): Promise<void> {
      const expiredOrders = await order.findPendingExpiredBefore(new Date());
      for (const o of expiredOrders) {
        await order.updateById(o.id, { status: 'expired' });
        await amountService.releaseLock(o.walletAddress, o.actualAmount);
      }
    },
    isOrderExpired(order: { expiresAt: Date }): boolean {
      return new Date() > order.expiresAt;
    },
    amountService,
  };
}
