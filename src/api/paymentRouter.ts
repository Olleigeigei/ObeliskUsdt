/**
 * 用户支付路由
 *
 * @author Telegram @Mhuai8
 */

import express, { Router } from 'express';
import type { ObeliskUSDTDeps } from '../types';
import { resolveAuthMiddleware } from './middleware';
import { createPaymentController } from './controllers/paymentController';
import { createSignMiddleware } from './signMiddleware';

export function createPaymentRouter(
  deps: ObeliskUSDTDeps,
  services: { orderService: any; configService: any },
): Router {
  const router: Router = express.Router();
  const auth = resolveAuthMiddleware(deps);
  const paymentController = createPaymentController({
    orderService: services.orderService,
    config: deps.config,
    redis: deps.redis,
  });

  const signMiddleware = createSignMiddleware({
    getSignMode: () => services.configService.getApiSignMode(),
    getAuthToken: () => services.configService.getApiAuthToken(),
    getMaxSkewSeconds: () => services.configService.getApiSignMaxSkewSeconds(),
    getRedis: async () => deps.redis,
  });

  router.post('/payment/create', auth.optional, signMiddleware, paymentController.createPayment);
  router.get('/payment/status/:orderNo', auth.optional, paymentController.getPaymentStatus);
  router.post('/payment/cancel/:orderNo', auth.optional, paymentController.cancelPayment);

  return router;
}
