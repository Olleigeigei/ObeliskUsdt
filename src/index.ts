/**
 * ObeliskUSDT 模块入口
 *
 * @author Telegram @Mhuai8
 */

import { createPaymentRouter } from './api/paymentRouter';
import { createAdminRouter } from './api/adminRouter';
import { createPaymentConfigService } from './services/configService';
import { createPaymentOrderService } from './services/orderService';
import { createBlockScannerService } from './services/blockScanner';
import { createBotPaymentService } from './services/botPaymentService';
import { createBotBridge } from './bot/commandHandlers';
import { createSchedulerBridge } from './scheduler/paymentTasks';
import { registerModels } from './models';
import type { ObeliskUSDTDeps, ObeliskUSDTInstance } from './types';

export function initObeliskUSDT(deps: ObeliskUSDTDeps): ObeliskUSDTInstance {
  const models = registerModels(deps.sequelize);
  const configService = createPaymentConfigService(deps);
  const orderService = createPaymentOrderService(deps, configService);
  const scanner = createBlockScannerService(deps, configService, orderService);
  const botPaymentService = createBotPaymentService(deps, { orderService, configService });

  return {
    paymentRouter: createPaymentRouter(deps, { orderService, configService }),
    adminRouter: createAdminRouter(deps, { orderService, configService, scanner }),
    orderService,
    configService,
    bot: createBotBridge(deps, { botPaymentService, orderService }),
    async startScanner() {
      await scanner.start();
    },
    async stopScanner() {
      await scanner.stop();
    },
    registerScheduledTasks(cron) {
      createSchedulerBridge({ deps, scanner, orderService }).register(cron);
    },
    models,
  };
}

export * from './types';
