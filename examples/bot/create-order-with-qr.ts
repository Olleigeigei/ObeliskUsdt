/**
 * 机器人：创建订单并发送二维码示例
 *
 * @author Telegram @Mhuai8
 */

import type { ObeliskUSDTInstance } from '../../src/types';

/**
 * 机器人下单并返回可发送的支付信息
 */
export async function createBotOrderWithQr(params: {
  usdt: ObeliskUSDTInstance;
  baseAmount: string;
  bizOrderNo: string;
}) {
  const result = await params.usdt.bot.createOrderWithQR({
    bizOrderNo: params.bizOrderNo,
    baseAmount: params.baseAmount,
    metadata: { scene: 'bot' },
  });

  return {
    orderNo: result.orderNo,
    caption: [
      `订单号: ${result.orderNo}`,
      `金额: ${result.actualAmount} USDT`,
      `地址: ${result.walletAddress}`,
      `链接: ${result.paymentPageUrl}`,
    ].join('\n'),
    qrPngBuffer: result.qrPngBuffer,
  };
}
