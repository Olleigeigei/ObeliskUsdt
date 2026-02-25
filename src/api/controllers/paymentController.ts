/**
 * 用户支付控制器
 *
 * @author Telegram @Mhuai8
 */

import type { Request, Response } from 'express';
import crypto from 'crypto';
import { Op } from 'sequelize';
import PaymentOrder from '../../models/PaymentOrder';
import { success, fail } from '../response';

export function createPaymentController(services: { orderService: any; config: any; redis: any }) {
  const safeIsPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const moneyRegex = /^\d+(\.\d{1,2})?$/;

  function getOrderToken(req: Request): string | null {
    const headerTokenRaw = (req.headers['x-obl-order-token'] || req.headers['x-order-token']) as
      | string
      | string[]
      | undefined;
    const headerToken = Array.isArray(headerTokenRaw) ? headerTokenRaw[0] : headerTokenRaw;
    const queryToken = (req.query as any)?.token ? String((req.query as any).token) : '';
    const token = String(headerToken || queryToken || '').trim();
    return token ? token : null;
  }

  function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  function getOrderTokenRedisKey(orderNo: string): string {
    return `obl:usdt:order-token:${orderNo}`;
  }

  function getOrderTokenTtlSeconds(expiresAt: Date): number {
    const diffMs = expiresAt.getTime() - Date.now();
    const diffSeconds = Math.floor(diffMs / 1000);
    const ttl = diffSeconds + 10 * 60;
    return Math.max(60, Math.min(48 * 3600, ttl));
  }

  function isTokenMatched(order: any, token: string): boolean {
    const metadata = (order as any)?.metadata || null;
    const expected = metadata && typeof metadata === 'object' ? String((metadata as any).orderTokenHash || '') : '';
    if (!expected) return false;
    return expected === hashToken(token);
  }

  function parseAndNormalizeBaseAmount(input: unknown): { baseAmountNumber: number; normalized: string } | null {
    if (typeof input === 'string') {
      const raw = input.trim();
      if (!raw) return null;
      if (!moneyRegex.test(raw)) return null;
      const num = Number(raw);
      if (!Number.isFinite(num) || num <= 0) return null;
      return { baseAmountNumber: num, normalized: num.toFixed(2) };
    }

    if (typeof input === 'number') {
      if (!Number.isFinite(input) || input <= 0) return null;
      const scaled = input * 100;
      const rounded = Math.round(scaled);
      if (Math.abs(scaled - rounded) > 1e-8) return null;
      return { baseAmountNumber: input, normalized: input.toFixed(2) };
    }

    return null;
  }

  return {
    createPayment: async (req: Request, res: Response) => {
      try {
        const body = req.body || {};

        const bizOrderNo = String(body.bizOrderNo || '').trim();
        const baseAmountParsed = parseAndNormalizeBaseAmount(body.baseAmount);

        if (!baseAmountParsed) {
          fail(res, 'INVALID_AMOUNT', '支付金额无效（仅支持最多 2 位小数）', 400);
          return;
        }
        if (!bizOrderNo) {
          fail(res, 'INVALID_BIZ_ORDER_NO', '业务单号不能为空', 400);
          return;
        }
        if (bizOrderNo.length > 64) {
          fail(res, 'INVALID_BIZ_ORDER_NO', '业务单号长度不能超过64', 400);
          return;
        }

        const redis = services.redis;
        if (!redis) {
          fail(res, 'ORDER_TOKEN_STORE_MISSING', '订单令牌存储不可用', 500);
          return;
        }

        const metadataFromHost = safeIsPlainObject(body.metadata) ? (body.metadata as Record<string, unknown>) : null;
        if (metadataFromHost) {
          try {
            const raw = JSON.stringify(metadataFromHost);
            if (raw.length > 8000) {
              fail(res, 'INVALID_METADATA', 'metadata 过大', 400);
              return;
            }
          } catch {
            fail(res, 'INVALID_METADATA', 'metadata 格式不合法', 400);
            return;
          }
        }

        const existingOrder: any = await PaymentOrder.findOne({
          where: {
            bizOrderNo,
            status: { [Op.in]: ['pending', 'paid', 'confirmed'] },
            expiresAt: { [Op.gt]: new Date() },
          },
          order: [['createdAt', 'DESC']],
        });

        if (existingOrder) {
          if (String(existingOrder.baseAmount) !== baseAmountParsed.normalized) {
            fail(res, 'BIZ_ORDER_NO_CONFLICT', '业务单号已存在且金额不一致', 409);
            return;
          }

          const tokenKey = getOrderTokenRedisKey(existingOrder.orderNo);
          try {
            const savedToken = await redis.get(tokenKey);
            if (savedToken) {
              success(res, {
                id: existingOrder.id,
                orderNo: existingOrder.orderNo,
                bizOrderNo: existingOrder.bizOrderNo,
                status: existingOrder.status,
                actualAmount: existingOrder.actualAmount,
                walletAddress: existingOrder.walletAddress,
                expiresAt: existingOrder.expiresAt,
                orderToken: String(savedToken),
              }, '创建支付订单成功');
              return;
            }
          } catch (error) {
            fail(res, 'ORDER_TOKEN_STORE_FAILED', '订单令牌存储读失败', 500);
            return;
          }

          const rotatedToken = crypto.randomBytes(24).toString('hex');
          const metadata = (existingOrder.metadata && typeof existingOrder.metadata === 'object')
            ? { ...(existingOrder.metadata as Record<string, unknown>) }
            : {};
          metadata.orderTokenHash = hashToken(rotatedToken);
          try {
            await existingOrder.update({ metadata } as any);
            await redis.set(tokenKey, rotatedToken, 'EX', getOrderTokenTtlSeconds(existingOrder.expiresAt));
          } catch (error) {
            fail(res, 'ORDER_TOKEN_STORE_FAILED', '订单令牌存储写失败', 500);
            return;
          }

          success(res, {
            id: existingOrder.id,
            orderNo: existingOrder.orderNo,
            bizOrderNo: existingOrder.bizOrderNo,
            status: existingOrder.status,
            actualAmount: existingOrder.actualAmount,
            walletAddress: existingOrder.walletAddress,
            expiresAt: existingOrder.expiresAt,
            orderToken: rotatedToken,
          }, '创建支付订单成功');
          return;
        }

        const orderToken = crypto.randomBytes(24).toString('hex');
        const order = await services.orderService.createOrder({
          baseAmount: baseAmountParsed.normalized,
          bizOrderNo,
          metadata: {
            ...(metadataFromHost || {}),
            orderTokenHash: hashToken(orderToken),
          },
        });
        try {
          await redis.set(getOrderTokenRedisKey(order.orderNo), orderToken, 'EX', getOrderTokenTtlSeconds(order.expiresAt));
        } catch (error) {
          fail(res, 'ORDER_TOKEN_STORE_FAILED', '订单令牌存储写失败', 500);
          return;
        }

        success(res, {
          id: order.id,
          orderNo: order.orderNo,
          bizOrderNo: order.bizOrderNo,
          status: order.status,
          actualAmount: order.actualAmount,
          walletAddress: order.walletAddress,
          expiresAt: order.expiresAt,
          orderToken,
        }, '创建支付订单成功');
      } catch (error: any) {
        fail(res, 'CREATE_PAYMENT_FAILED', error?.message || '创建支付订单失败', 500);
      }
    },

    getPaymentStatus: async (req: Request, res: Response) => {
      try {
        const orderNo = String(req.params.orderNo || '');
        if (!orderNo) {
          fail(res, 'INVALID_ORDER_NO', '订单号不能为空', 400);
          return;
        }

        const token = getOrderToken(req);
        if (!token) {
          fail(res, 'MISSING_ORDER_TOKEN', '缺少订单令牌', 401);
          return;
        }

        const order: any = await PaymentOrder.findOne({ where: { orderNo } });
        if (order && !isTokenMatched(order, token)) {
          fail(res, 'ORDER_NOT_FOUND', '订单不存在或无权限查看', 404);
          return;
        }

        if (!order) {
          fail(res, 'ORDER_NOT_FOUND', '订单不存在或无权限查看', 404);
          return;
        }

        success(res, {
          id: order.id,
          orderNo: order.orderNo,
          bizOrderNo: order.bizOrderNo,
          status: order.status,
          actualAmount: order.actualAmount,
          walletAddress: order.walletAddress,
          txHash: order.txHash,
          confirmations: order.confirmations,
          requiredConfirmations: order.requiredConfirmations,
          paidAt: order.paidAt,
          confirmedAt: order.confirmedAt,
          completedAt: order.completedAt,
          expiresAt: order.expiresAt,
        }, '获取支付状态成功');
      } catch (error: any) {
        fail(res, 'GET_PAYMENT_STATUS_FAILED', error?.message || '获取支付状态失败', 500);
      }
    },

    cancelPayment: async (req: Request, res: Response) => {
      try {
        const orderNo = String(req.params.orderNo || '');
        if (!orderNo) {
          fail(res, 'INVALID_ORDER_NO', '订单号不能为空', 400);
          return;
        }

        const token = getOrderToken(req);
        if (!token) {
          fail(res, 'MISSING_ORDER_TOKEN', '缺少订单令牌', 401);
          return;
        }

        const order: any = await PaymentOrder.findOne({ where: { orderNo } });
        if (!order) {
          fail(res, 'ORDER_NOT_FOUND', '订单不存在或无权限查看', 404);
          return;
        }
        if (!isTokenMatched(order, token)) {
          fail(res, 'ORDER_NOT_FOUND', '订单不存在或无权限查看', 404);
          return;
        }

        await services.orderService.cancelOrder(orderNo);
        success(res, { orderNo }, '取消订单成功');
      } catch (error: any) {
        fail(res, 'CANCEL_PAYMENT_FAILED', error?.message || '取消订单失败', 500);
      }
    },
  };
}
