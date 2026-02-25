/**
 * ObeliskUSDT 公共类型定义
 *
 * @author Telegram @Mhuai8
 */

import type { Router, RequestHandler } from 'express';
import type { Sequelize } from 'sequelize';
import type Redis from 'ioredis';
import type PaymentWallet from './models/PaymentWallet';
import type PaymentOrder from './models/PaymentOrder';
import type PaymentTransaction from './models/PaymentTransaction';
import type { PaymentMessages } from '../config/messages';
import type { PaymentKeyboards } from '../config/keyboards';

export interface LoggerLike {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface ObeliskUSDTConfig {
  network: 'mainnet' | 'testnet';
  webUrl: string;
  botUsername?: string;
  trongridApiKey?: string;
  tronscanApiKey?: string;
  apiSignMode?: 'off' | 'hmac-sha256';
  apiAuthToken?: string;
  apiSignMaxSkewSeconds?: number;
  logo?: string;
  orderExpirationMinutes?: number;
  messages?: DeepPartial<PaymentMessages>;
  keyboards?: DeepPartial<PaymentKeyboards>;
}

export interface ConfirmedOrder {
  id: number;
  orderNo: string;
  bizOrderNo: string;
  baseAmount: string;
  actualAmount: string;
  walletAddress: string;
  txHash?: string | null;
  blockNumber?: number | null;
  confirmations?: number;
  requiredConfirmations?: number;
  metadata?: Record<string, unknown> | null;
}

export interface BotCreateOrderWithQRParams {
  bizOrderNo: string;
  baseAmount: number | string;
  metadata?: Record<string, unknown> | null;
}

export interface BotCreateOrderWithQRResult {
  order: unknown;
  orderNo: string;
  walletAddress: string;
  actualAmount: string;
  expiresAt: Date;
  qrPngBuffer: Uint8Array;
  paymentPageUrl: string;
}

export interface ObeliskUSDTDeps {
  sequelize: Sequelize;
  redis: Redis;
  logger: LoggerLike;
  config: ObeliskUSDTConfig;
  configStore?: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
  onOrderConfirmed?: (order: ConfirmedOrder) => Promise<void>;
  authMiddleware?: {
    optional: RequestHandler;
    required: RequestHandler;
    admin: RequestHandler;
  };
}

export interface ObeliskUSDTInstance {
  paymentRouter: Router;
  adminRouter: Router;
  orderService: unknown;
  configService: unknown;
  bot: {
    registerCallbacks(handler: unknown): void;
    registerCommands(registry: unknown): void;
    createOrderWithQR(params: BotCreateOrderWithQRParams): Promise<BotCreateOrderWithQRResult>;
    templates?: {
      messages: PaymentMessages;
      keyboards: PaymentKeyboards;
      getMessage(path: string): string;
      getKeyboard(path: string): string;
    };
  };
  startScanner(): Promise<void>;
  stopScanner(): Promise<void>;
  registerScheduledTasks(cron: unknown): void;
  models: {
    PaymentWallet: typeof PaymentWallet;
    PaymentOrder: typeof PaymentOrder;
    PaymentTransaction: typeof PaymentTransaction;
  };
}
