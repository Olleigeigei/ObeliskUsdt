/**
 * ObeliskUSDT 模块入口
 *
 * @author Telegram @okgeceo
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
import { createSequelizeObeliskPersistence } from './persistence/sequelizeObeliskPersistence';
import type { ObeliskUSDTDeps, ObeliskUSDTDepsResolved, ObeliskUSDTInstance } from './types';

export function initObeliskUSDT(depsInput: ObeliskUSDTDeps): ObeliskUSDTInstance {
  if (!depsInput.persistence && !depsInput.sequelize) {
    throw new Error('initObeliskUSDT: 请传入 sequelize 或 persistence');
  }

  let models: ObeliskUSDTInstance['models'];
  if (depsInput.sequelize) {
    models = registerModels(depsInput.sequelize);
  }

  const persistence =
    depsInput.persistence ??
    (depsInput.sequelize ? createSequelizeObeliskPersistence(depsInput.sequelize) : null);
  if (!persistence) {
    throw new Error('initObeliskUSDT: 无法构造 persistence');
  }

  const deps: ObeliskUSDTDepsResolved = { ...depsInput, persistence };

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
export * from './migrations/runMigrations';
export type { ObeliskPersistence } from './persistence/obeliskPersistence';
export { createSequelizeObeliskPersistence } from './persistence/sequelizeObeliskPersistence';
