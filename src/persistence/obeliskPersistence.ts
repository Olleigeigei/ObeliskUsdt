/**
 * 支付数据访问抽象层：宿主可实现本接口以接入 Prisma、TypeORM、Kysely 等任意方案，
 * 不强制绑定 Sequelize。
 *
 * @author Telegram @okgeceo
 */

import type { PaymentOrderAttributes, PaymentOrderStatus } from '../models/PaymentOrder';
import type { PaymentWalletAttributes } from '../models/PaymentWallet';
import type { PaymentTransactionAttributes } from '../models/PaymentTransaction';

/** 订单行（纯数据，不含 ORM 实例方法） */
export type PaymentOrderRow = PaymentOrderAttributes;

/** 钱包行 */
export type PaymentWalletRow = PaymentWalletAttributes;

/** 链上交易记录行 */
export type PaymentTransactionRow = PaymentTransactionAttributes;

export type OrderCreateInput = Omit<
  PaymentOrderAttributes,
  'id' | 'txHash' | 'blockNumber' | 'confirmations' | 'paidAt' | 'confirmedAt' | 'completedAt' | 'errorMessage' | 'createdAt' | 'updatedAt'
> & {
  txHash?: null;
  blockNumber?: null;
  confirmations?: number;
  paidAt?: null;
  confirmedAt?: null;
  completedAt?: null;
  errorMessage?: null;
};

export type WalletCreateInput = Pick<PaymentWalletAttributes, 'address' | 'label' | 'isActive' | 'priority'>;

/**
 * 模块内部所需的全部持久化能力。
 * 宿主使用 Prisma 等方案时，按表结构 `obl_*` 实现等价读写即可。
 */
export interface ObeliskPersistence {
  order: {
    create(data: OrderCreateInput): Promise<PaymentOrderRow>;
    findByOrderNo(orderNo: string): Promise<PaymentOrderRow | null>;
    /**
     * 创建接口幂等：同 bizOrderNo 且未过期、状态为进行中的最近一单
     */
    findActiveBizOrderDuplicate(bizOrderNo: string, now: Date): Promise<PaymentOrderRow | null>;
    findById(id: number): Promise<PaymentOrderRow | null>;
    updateById(id: number, patch: Partial<PaymentOrderRow>): Promise<void>;
    cancelPendingByOrderNo(orderNo: string): Promise<{ affected: number; order: PaymentOrderRow | null }>;
    cancelPendingById(id: number): Promise<{ affected: number; order: PaymentOrderRow | null }>;
    findPendingExpiredBefore(now: Date): Promise<PaymentOrderRow[]>;
    /** 扫描匹配：待支付 + 钱包 + 实际金额 + 未过期，按创建时间升序取第一条 */
    findPendingForIncomingMatch(params: {
      walletAddress: string;
      actualAmount: string;
      now: Date;
    }): Promise<PaymentOrderRow | null>;
    /** 条件更新为已支付，返回影响行数 */
    updateToPaidIfStillPending(
      id: number,
      patch: Pick<PaymentOrderRow, 'txHash' | 'blockNumber' | 'paidAt' | 'status'>,
    ): Promise<number>;
    findPaidOrConfirmedWithTx(limit: number): Promise<PaymentOrderRow[]>;
    findPagedForAdmin(params: {
      page: number;
      pageSize: number;
      status?: PaymentOrderStatus;
      orderNoContains?: string;
    }): Promise<{ rows: PaymentOrderRow[]; total: number }>;
    deleteById(id: number): Promise<void>;
    deleteFinishedBefore(deadline: Date, statuses: PaymentOrderStatus[]): Promise<number>;
    count(): Promise<number>;
    countByStatus(status: PaymentOrderStatus): Promise<number>;
  };
  wallet: {
    count(): Promise<number>;
    countActive(): Promise<number>;
    /** 扫描器轮询全部启用钱包地址 */
    listActiveAddresses(): Promise<string[]>;
    listForAdminOrdered(): Promise<PaymentWalletRow[]>;
    listActiveForAllocation(limit: number): Promise<PaymentWalletRow[]>;
    findById(id: number): Promise<PaymentWalletRow | null>;
    create(data: WalletCreateInput): Promise<PaymentWalletRow>;
    updateById(id: number, patch: Partial<PaymentWalletRow>): Promise<void>;
    deleteById(id: number): Promise<void>;
    touchLastUsed(id: number, at: Date): Promise<void>;
  };
  transaction: {
    findOrCreateIncoming(
      txHash: string,
      defaults: Omit<
        PaymentTransactionAttributes,
        'id' | 'orderId' | 'orderNo' | 'matchedAt' | 'createdAt' | 'updatedAt'
      >,
    ): Promise<{ row: PaymentTransactionRow; created: boolean }>;
    updateById(id: number, patch: Partial<PaymentTransactionRow>): Promise<void>;
    count(): Promise<number>;
  };
}
