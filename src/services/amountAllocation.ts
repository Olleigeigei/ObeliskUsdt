/**
 * 金额分配服务
 *
 * @author Telegram @Mhuai8
 */

import Decimal from 'decimal.js';
import PaymentWallet from '../models/PaymentWallet';
import type { ObeliskUSDTDeps } from '../types';

export function createAmountAllocationService(deps: ObeliskUSDTDeps, configService: any) {
  const LOCK_PREFIX = 'LOCK:PAYMENT:';

  return {
    async allocateAmount(baseAmount: number | string): Promise<{
      walletAddress: string;
      walletId: number;
      actualAmount: string;
      amountInSun: string;
    }> {
      const baseAmountDecimal = new Decimal(baseAmount);
      const wallets = await PaymentWallet.findAll({
        where: { isActive: true },
        order: [['priority', 'ASC'], ['lastUsedAt', 'ASC']],
        limit: 100,
      });
      if (wallets.length === 0) {
        throw new Error('没有可用的收款钱包');
      }
      const lockTTL = await configService.getLockTTL();
      for (let i = 1; i <= 9999; i++) {
        const decimalPart = new Decimal(i).div(10000);
        const totalAmount = baseAmountDecimal.plus(decimalPart);
        const amountStr = totalAmount.toFixed(4);
        for (const wallet of wallets) {
          const lockKey = `${LOCK_PREFIX}${wallet.address}:${amountStr}`;
          const lockValue = `TEMP_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const result = await (deps.redis as any).set(lockKey, lockValue, 'EX', lockTTL, 'NX');
          if (result === 'OK') {
            await wallet.update({ lastUsedAt: new Date() });
            const amountInSun = totalAmount.mul(1000000).floor().toString();
            return {
              walletAddress: wallet.address,
              walletId: wallet.id,
              actualAmount: amountStr,
              amountInSun,
            };
          }
        }
      }
      throw new Error('当前所有金额组合都被占用，请稍后重试');
    },
    async releaseLock(walletAddress: string, amount: string): Promise<void> {
      const lockKey = `${LOCK_PREFIX}${walletAddress}:${amount}`;
      await deps.redis.del(lockKey);
    },
    convertSunToUSDT(sunAmount: string): Decimal {
      return new Decimal(sunAmount).div(1000000);
    },
    convertSunToUSDTForMatch(sunAmount: string): string {
      return new Decimal(sunAmount).div(1000000).toFixed(4);
    },
  };
}
