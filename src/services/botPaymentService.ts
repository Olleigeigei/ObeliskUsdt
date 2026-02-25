/**
 * Bot 支付服务
 *
 * @author Telegram @Mhuai8
 */

import { buildEnhancedQrImage } from './qrImage';
import type { ObeliskUSDTDeps } from '../types';

export interface CreateOrderWithQRParams {
  bizOrderNo: string;
  baseAmount: number | string;
  metadata?: Record<string, unknown> | null;
}

export interface CreateOrderWithQRResult {
  order: any;
  orderNo: string;
  walletAddress: string;
  actualAmount: string;
  expiresAt: Date;
  qrPngBuffer: Buffer;
  paymentPageUrl: string;
}

export function createBotPaymentService(deps: ObeliskUSDTDeps, services: { orderService: any; configService: any }) {
  function getPaymentPageBaseUrl(): string {
    return (deps.config.webUrl || '').replace(/\/$/, '');
  }

  return {
    async createOrderWithQR(params: CreateOrderWithQRParams): Promise<CreateOrderWithQRResult> {
      const order = await services.orderService.createOrder(params);
      const baseUrl = getPaymentPageBaseUrl();
      const paymentPageUrl = baseUrl ? `${baseUrl}/payment?orderNo=${order.orderNo}` : '';

      const [qrLogoUrl, qrTopText, qrBottomTextRaw] = await Promise.all([
        services.configService.getQrLogoUrl(),
        services.configService.getQrTopText(),
        services.configService.getQrBottomText(),
      ]);

      const qrBottomText = (qrBottomTextRaw || '').trim()
        ? String(qrBottomTextRaw).replace(/\{amount\}/g, order.actualAmount)
        : `支付 ${order.actualAmount} USDT`;

      const qrPngBuffer = await buildEnhancedQrImage(
        order.walletAddress,
        {
          topText: (qrTopText || '').trim() || undefined,
          bottomText: qrBottomText,
          logoUrl: (qrLogoUrl || '').trim() || undefined,
          width: 600,
        },
        deps.logger,
      );

      return {
        order,
        orderNo: order.orderNo,
        walletAddress: order.walletAddress,
        actualAmount: order.actualAmount,
        expiresAt: order.expiresAt,
        qrPngBuffer,
        paymentPageUrl,
      };
    },
  };
}
