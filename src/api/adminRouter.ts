/**
 * 管理支付路由
 *
 * @author Telegram @Mhuai8
 */

import express, { Router } from 'express';
import type { ObeliskUSDTDeps } from '../types';
import { resolveAuthMiddleware } from './middleware';
import { createAdminPaymentController } from './controllers/adminPaymentController';

export function createAdminRouter(
  deps: ObeliskUSDTDeps,
  services: { orderService: any; configService: any; scanner: any },
): Router {
  const router: Router = express.Router();
  const auth = resolveAuthMiddleware(deps);
  const controller = createAdminPaymentController(services);

  router.get('/admin/payment/wallets/stats', auth.admin, controller.getWalletStats);
  router.get('/admin/payment/wallets', auth.admin, controller.getWalletList);
  router.get('/admin/payment/wallets/:id', auth.admin, controller.getWalletDetail);
  router.post('/admin/payment/wallets', auth.admin, controller.createWallet);
  router.put('/admin/payment/wallets/:id', auth.admin, controller.updateWallet);
  router.delete('/admin/payment/wallets/:id', auth.admin, controller.deleteWallet);

  router.get('/admin/payment/orders', auth.admin, controller.getOrderList);
  router.get('/admin/payment/orders/:id', auth.admin, controller.getOrderDetail);
  router.put('/admin/payment/orders/:id/confirm', auth.admin, controller.confirmOrder);
  router.put('/admin/payment/orders/:id/cancel', auth.admin, controller.cancelOrder);
  router.put('/admin/payment/orders/:id/remark', auth.admin, controller.updateOrderRemark);
  router.delete('/admin/payment/orders/:id', auth.admin, controller.deleteOrder);
  router.post('/admin/payment/orders/cleanup', auth.admin, controller.cleanupOrders);

  router.get('/admin/payment/stats', auth.admin, controller.getPaymentStats);
  router.get('/admin/payment/network', auth.admin, controller.getNetworkConfig);
  router.put('/admin/payment/network', auth.admin, controller.setNetworkMode);
  router.get('/admin/payment/network/presets', auth.admin, controller.getNetworkPresets);

  return router;
}
