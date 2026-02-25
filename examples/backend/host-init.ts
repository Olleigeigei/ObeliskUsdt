/**
 * 宿主后端初始化 ObeliskUSDT 示例
 *
 * @author Telegram @Mhuai8
 */

import type { Express } from 'express';
import type { Sequelize } from 'sequelize';
import type Redis from 'ioredis';
import type { ObeliskUSDTInstance, ConfirmedOrder } from '../../src/types';
import { initObeliskUSDT } from '../../src';

interface HostInitParams {
  app: Express;
  sequelize: Sequelize;
  redis: Redis;
  logger: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  authMiddleware: {
    optional: any;
    required: any;
    admin: any;
  };
  grantBenefitByOrder: (order: ConfirmedOrder) => Promise<void>;
  cron: unknown;
}

/**
 * 初始化支付模块并挂载路由
 */
export async function setupObeliskUsdtForHost(params: HostInitParams): Promise<ObeliskUSDTInstance> {
  const usdt = initObeliskUSDT({
    sequelize: params.sequelize,
    redis: params.redis,
    logger: params.logger,
    authMiddleware: params.authMiddleware,
    config: {
      network: 'mainnet',
      webUrl: process.env.WEB_URL || 'https://your-host-domain.com',
      botUsername: process.env.BOT_USERNAME,
      trongridApiKey: process.env.TRONGRID_API_KEY,
      tronscanApiKey: process.env.TRONSCAN_API_KEY,
      apiAuthToken: process.env.OBL_USDT_API_AUTH_TOKEN || '',
      orderExpirationMinutes: 15,
    },
    onOrderConfirmed: async (order: ConfirmedOrder) => {
      // 宿主必须在此实现幂等发放，避免重复到账导致重复发放
      await params.grantBenefitByOrder(order);
    },
  });

  params.app.use('/api', usdt.paymentRouter);
  params.app.use('/api', usdt.adminRouter);

  await usdt.startScanner();
  usdt.registerScheduledTasks(params.cron);

  params.logger.info('[ObeliskUSDT] 初始化完成');
  return usdt;
}
