/**
 * 支付定时任务注册
 *
 * @author Telegram @Mhuai8
 */

import type { ObeliskUSDTDeps } from '../types';

export function createSchedulerBridge(params: { deps: ObeliskUSDTDeps; scanner: any; orderService?: any }) {
  return {
    register(cron: any): void {
      if (!cron || typeof cron.schedule !== 'function') {
        params.deps.logger.warn('[ObeliskUSDT] 未提供有效的 cron 调度器，跳过支付定时任务注册');
        return;
      }

      cron.schedule('*/1 * * * *', async () => {
        try {
          if (params.orderService?.processExpiredOrders) {
            await params.orderService.processExpiredOrders();
          }
        } catch (error) {
          params.deps.logger.error('[ObeliskUSDT] 处理过期订单失败', error);
        }
      });

      cron.schedule('*/1 * * * *', async () => {
        try {
          await params.scanner.updateConfirmations();
        } catch (error) {
          params.deps.logger.error('[ObeliskUSDT] 更新确认数失败', error);
        }
      });

      params.deps.logger.info('[ObeliskUSDT] 支付定时任务已注册');
    },
  };
}
