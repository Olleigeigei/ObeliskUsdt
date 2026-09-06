/**
 * 使用 Prisma 实现 ObeliskPersistence 的示例骨架。
 * 依赖：宿主项目已安装 @prisma/client，且 schema 与 obl_* 表一致（可参考同目录 prisma.schema.example.prisma）。
 *
 * @author Telegram @okgeceo
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ObeliskPersistence,
  OrderCreateInput,
  PaymentOrderRow,
  PaymentTransactionRow,
  PaymentWalletRow,
  WalletCreateInput,
} from '../../src/persistence/obeliskPersistence';
import type { PaymentOrderStatus } from '../../src/models/PaymentOrder';

function d2(v: Prisma.Decimal): string {
  return v.toFixed(2);
}

function d4(v: Prisma.Decimal): string {
  return v.toFixed(4);
}

function d6(v: Prisma.Decimal): string {
  return v.toFixed(6);
}

function toWalletRow(w: {
  id: bigint;
  address: string;
  label: string;
  isActive: boolean;
  priority: number;
  totalOrders: number;
  totalAmount: Prisma.Decimal;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentWalletRow {
  return {
    id: Number(w.id),
    address: w.address,
    label: w.label,
    isActive: w.isActive,
    priority: w.priority,
    totalOrders: w.totalOrders,
    totalAmount: d6(w.totalAmount),
    lastUsedAt: w.lastUsedAt,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

function toOrderRow(o: {
  id: bigint;
  orderNo: string;
  bizOrderNo: string;
  baseAmount: Prisma.Decimal;
  actualAmount: Prisma.Decimal;
  amountInSun: string;
  walletAddress: string;
  walletId: bigint;
  status: PaymentOrderStatus;
  txHash: string | null;
  blockNumber: bigint | null;
  confirmations: number;
  requiredConfirmations: number;
  expiresAt: Date;
  paidAt: Date | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentOrderRow {
  return {
    id: Number(o.id),
    orderNo: o.orderNo,
    bizOrderNo: o.bizOrderNo,
    baseAmount: d2(o.baseAmount),
    actualAmount: d4(o.actualAmount),
    amountInSun: o.amountInSun,
    walletAddress: o.walletAddress,
    walletId: Number(o.walletId),
    status: o.status as PaymentOrderStatus,
    txHash: o.txHash,
    blockNumber: o.blockNumber != null ? Number(o.blockNumber) : null,
    confirmations: o.confirmations,
    requiredConfirmations: o.requiredConfirmations,
    expiresAt: o.expiresAt,
    paidAt: o.paidAt,
    confirmedAt: o.confirmedAt,
    completedAt: o.completedAt,
    errorMessage: o.errorMessage,
    metadata: (o.metadata && typeof o.metadata === 'object' ? o.metadata : null) as Record<string, unknown> | null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function toTxRow(t: {
  id: bigint;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountInUsdt: Prisma.Decimal;
  blockNumber: bigint;
  blockTimestamp: bigint;
  orderId: bigint | null;
  orderNo: string | null;
  isMatched: boolean;
  matchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentTransactionRow {
  return {
    id: Number(t.id),
    txHash: t.txHash,
    fromAddress: t.fromAddress,
    toAddress: t.toAddress,
    amount: t.amount,
    amountInUsdt: d4(t.amountInUsdt),
    blockNumber: Number(t.blockNumber),
    blockTimestamp: Number(t.blockTimestamp),
    orderId: t.orderId != null ? Number(t.orderId) : null,
    orderNo: t.orderNo,
    isMatched: t.isMatched,
    matchedAt: t.matchedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/**
 * 由宿主在 initObeliskUSDT({ persistence: createPrismaObeliskPersistence(prisma), ... }) 中注入。
 */
export function createPrismaObeliskPersistence(prisma: PrismaClient): ObeliskPersistence {
  return {
    order: {
      async create(data: OrderCreateInput): Promise<PaymentOrderRow> {
        const row = await prisma.oblPaymentOrder.create({
          data: {
            orderNo: data.orderNo,
            bizOrderNo: data.bizOrderNo,
            baseAmount: data.baseAmount,
            actualAmount: data.actualAmount,
            amountInSun: data.amountInSun,
            walletAddress: data.walletAddress,
            walletId: BigInt(data.walletId),
            status: data.status as any,
            txHash: data.txHash ?? null,
            blockNumber: data.blockNumber != null ? BigInt(data.blockNumber) : null,
            confirmations: data.confirmations ?? 0,
            requiredConfirmations: data.requiredConfirmations,
            expiresAt: data.expiresAt,
            paidAt: data.paidAt ?? null,
            confirmedAt: data.confirmedAt ?? null,
            completedAt: data.completedAt ?? null,
            errorMessage: data.errorMessage ?? null,
            metadata: data.metadata === null || data.metadata === undefined ? undefined : (data.metadata as Prisma.InputJsonValue),
          },
        });
        return toOrderRow(row);
      },
      async findByOrderNo(orderNo: string): Promise<PaymentOrderRow | null> {
        const row = await prisma.oblPaymentOrder.findUnique({ where: { orderNo } });
        return row ? toOrderRow(row) : null;
      },
      async findActiveBizOrderDuplicate(bizOrderNo: string, now: Date): Promise<PaymentOrderRow | null> {
        const row = await prisma.oblPaymentOrder.findFirst({
          where: {
            bizOrderNo,
            status: { in: ['pending', 'paid', 'confirmed'] },
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: 'desc' },
        });
        return row ? toOrderRow(row) : null;
      },
      async findById(id: number): Promise<PaymentOrderRow | null> {
        const row = await prisma.oblPaymentOrder.findUnique({ where: { id: BigInt(id) } });
        return row ? toOrderRow(row) : null;
      },
      async updateById(id: number, patch: Partial<PaymentOrderRow>): Promise<void> {
        const data: Prisma.OblPaymentOrderUpdateInput = {};
        if (patch.status !== undefined) data.status = patch.status as any;
        if (patch.txHash !== undefined) data.txHash = patch.txHash;
        if (patch.blockNumber !== undefined) data.blockNumber = patch.blockNumber != null ? BigInt(patch.blockNumber) : null;
        if (patch.confirmations !== undefined) data.confirmations = patch.confirmations;
        if (patch.paidAt !== undefined) data.paidAt = patch.paidAt;
        if (patch.confirmedAt !== undefined) data.confirmedAt = patch.confirmedAt;
        if (patch.completedAt !== undefined) data.completedAt = patch.completedAt;
        if (patch.errorMessage !== undefined) data.errorMessage = patch.errorMessage;
        if (patch.metadata !== undefined) {
          data.metadata = patch.metadata === null ? Prisma.JsonNull : (patch.metadata as Prisma.InputJsonValue);
        }
        if (patch.baseAmount !== undefined) data.baseAmount = patch.baseAmount;
        if (patch.actualAmount !== undefined) data.actualAmount = patch.actualAmount;
        if (patch.amountInSun !== undefined) data.amountInSun = patch.amountInSun;
        if (patch.walletAddress !== undefined) data.walletAddress = patch.walletAddress;
        if (patch.walletId !== undefined) data.walletId = BigInt(patch.walletId);
        if (patch.requiredConfirmations !== undefined) data.requiredConfirmations = patch.requiredConfirmations;
        if (patch.expiresAt !== undefined) data.expiresAt = patch.expiresAt;
        await prisma.oblPaymentOrder.update({ where: { id: BigInt(id) }, data });
      },
      async cancelPendingByOrderNo(orderNo: string): Promise<{ affected: number; order: PaymentOrderRow | null }> {
        const before = await prisma.oblPaymentOrder.findUnique({ where: { orderNo } });
        if (!before) return { affected: 0, order: null };
        const plain = toOrderRow(before);
        const result = await prisma.oblPaymentOrder.updateMany({
          where: { id: before.id, status: 'pending' },
          data: { status: 'cancelled' },
        });
        return { affected: result.count, order: plain };
      },
      async cancelPendingById(id: number): Promise<{ affected: number; order: PaymentOrderRow | null }> {
        const before = await prisma.oblPaymentOrder.findUnique({ where: { id: BigInt(id) } });
        if (!before) return { affected: 0, order: null };
        const plain = toOrderRow(before);
        const result = await prisma.oblPaymentOrder.updateMany({
          where: { id: BigInt(id), status: 'pending' },
          data: { status: 'cancelled' },
        });
        return { affected: result.count, order: plain };
      },
      async findPendingExpiredBefore(now: Date): Promise<PaymentOrderRow[]> {
        const rows = await prisma.oblPaymentOrder.findMany({
          where: { status: 'pending', expiresAt: { lt: now } },
        });
        return rows.map(toOrderRow);
      },
      async findPendingForIncomingMatch(params: {
        walletAddress: string;
        actualAmount: string;
        now: Date;
      }): Promise<PaymentOrderRow | null> {
        const row = await prisma.oblPaymentOrder.findFirst({
          where: {
            status: 'pending',
            walletAddress: params.walletAddress,
            actualAmount: params.actualAmount,
            expiresAt: { gt: params.now },
          },
          orderBy: { createdAt: 'asc' },
        });
        return row ? toOrderRow(row) : null;
      },
      async updateToPaidIfStillPending(
        id: number,
        patch: Pick<PaymentOrderRow, 'txHash' | 'blockNumber' | 'paidAt' | 'status'>,
      ): Promise<number> {
        const result = await prisma.oblPaymentOrder.updateMany({
          where: { id: BigInt(id), status: 'pending' },
          data: {
            status: patch.status as any,
            txHash: patch.txHash,
            blockNumber: patch.blockNumber != null ? BigInt(patch.blockNumber) : null,
            paidAt: patch.paidAt,
          },
        });
        return result.count;
      },
      async findPaidOrConfirmedWithTx(limit: number): Promise<PaymentOrderRow[]> {
        const rows = await prisma.oblPaymentOrder.findMany({
          where: {
            status: { in: ['paid', 'confirmed'] },
            txHash: { not: null },
          },
          take: limit,
          orderBy: { updatedAt: 'asc' },
        });
        return rows.map(toOrderRow);
      },
      async findPagedForAdmin(params: {
        page: number;
        pageSize: number;
        status?: PaymentOrderStatus;
        orderNoContains?: string;
      }): Promise<{ rows: PaymentOrderRow[]; total: number }> {
        const where: Prisma.OblPaymentOrderWhereInput = {};
        if (params.status) where.status = params.status as any;
        if (params.orderNoContains) {
          where.orderNo = { contains: params.orderNoContains };
        }
        const [rows, total] = await prisma.$transaction([
          prisma.oblPaymentOrder.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: params.pageSize,
            skip: (params.page - 1) * params.pageSize,
          }),
          prisma.oblPaymentOrder.count({ where }),
        ]);
        return { rows: rows.map(toOrderRow), total };
      },
      async deleteById(id: number): Promise<void> {
        await prisma.oblPaymentOrder.delete({ where: { id: BigInt(id) } });
      },
      async deleteFinishedBefore(deadline: Date, statuses: PaymentOrderStatus[]): Promise<number> {
        const result = await prisma.oblPaymentOrder.deleteMany({
          where: {
            status: { in: statuses as any[] },
            updatedAt: { lt: deadline },
          },
        });
        return result.count;
      },
      async count(): Promise<number> {
        return prisma.oblPaymentOrder.count();
      },
      async countByStatus(status: PaymentOrderStatus): Promise<number> {
        return prisma.oblPaymentOrder.count({ where: { status: status as any } });
      },
    },
    wallet: {
      async count(): Promise<number> {
        return prisma.oblPaymentWallet.count();
      },
      async countActive(): Promise<number> {
        return prisma.oblPaymentWallet.count({ where: { isActive: true } });
      },
      async listActiveAddresses(): Promise<string[]> {
        const rows = await prisma.oblPaymentWallet.findMany({
          where: { isActive: true },
          select: { address: true },
        });
        return rows.map((r) => r.address);
      },
      async listForAdminOrdered(): Promise<PaymentWalletRow[]> {
        const rows = await prisma.oblPaymentWallet.findMany({
          orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        });
        return rows.map(toWalletRow);
      },
      async listActiveForAllocation(limit: number): Promise<PaymentWalletRow[]> {
        const rows = await prisma.oblPaymentWallet.findMany({
          where: { isActive: true },
          orderBy: [{ priority: 'asc' }, { lastUsedAt: 'asc' }],
          take: limit,
        });
        return rows.map(toWalletRow);
      },
      async findById(id: number): Promise<PaymentWalletRow | null> {
        const row = await prisma.oblPaymentWallet.findUnique({ where: { id: BigInt(id) } });
        return row ? toWalletRow(row) : null;
      },
      async create(data: WalletCreateInput): Promise<PaymentWalletRow> {
        const row = await prisma.oblPaymentWallet.create({
          data: {
            address: data.address,
            label: data.label,
            isActive: data.isActive,
            priority: data.priority,
          },
        });
        return toWalletRow(row);
      },
      async updateById(id: number, patch: Partial<PaymentWalletRow>): Promise<void> {
        const data: Prisma.OblPaymentWalletUpdateInput = {};
        if (patch.address !== undefined) data.address = patch.address;
        if (patch.label !== undefined) data.label = patch.label;
        if (patch.isActive !== undefined) data.isActive = patch.isActive;
        if (patch.priority !== undefined) data.priority = patch.priority;
        if (patch.totalOrders !== undefined) data.totalOrders = patch.totalOrders;
        if (patch.totalAmount !== undefined) data.totalAmount = patch.totalAmount;
        if (patch.lastUsedAt !== undefined) data.lastUsedAt = patch.lastUsedAt;
        await prisma.oblPaymentWallet.update({ where: { id: BigInt(id) }, data });
      },
      async deleteById(id: number): Promise<void> {
        await prisma.oblPaymentWallet.delete({ where: { id: BigInt(id) } });
      },
      async touchLastUsed(id: number, at: Date): Promise<void> {
        await prisma.oblPaymentWallet.update({
          where: { id: BigInt(id) },
          data: { lastUsedAt: at },
        });
      },
    },
    transaction: {
      async findOrCreateIncoming(
        txHash: string,
        defaults: Omit<
          PaymentTransactionRow,
          'id' | 'orderId' | 'orderNo' | 'matchedAt' | 'createdAt' | 'updatedAt'
        >,
      ): Promise<{ row: PaymentTransactionRow; created: boolean }> {
        const existing = await prisma.oblPaymentTransaction.findUnique({ where: { txHash } });
        if (existing) {
          return { row: toTxRow(existing), created: false };
        }
        try {
          const row = await prisma.oblPaymentTransaction.create({
            data: {
              txHash,
              fromAddress: defaults.fromAddress,
              toAddress: defaults.toAddress,
              amount: defaults.amount,
              amountInUsdt: defaults.amountInUSDT,
              blockNumber: BigInt(defaults.blockNumber),
              blockTimestamp: BigInt(defaults.blockTimestamp),
              isMatched: defaults.isMatched,
            },
          });
          return { row: toTxRow(row), created: true };
        } catch (e: any) {
          if (e?.code === 'P2002') {
            const again = await prisma.oblPaymentTransaction.findUnique({ where: { txHash } });
            if (again) return { row: toTxRow(again), created: false };
          }
          throw e;
        }
      },
      async updateById(id: number, patch: Partial<PaymentTransactionRow>): Promise<void> {
        const data: Prisma.OblPaymentTransactionUpdateInput = {};
        if (patch.fromAddress !== undefined) data.fromAddress = patch.fromAddress;
        if (patch.toAddress !== undefined) data.toAddress = patch.toAddress;
        if (patch.amount !== undefined) data.amount = patch.amount;
        if (patch.amountInUSDT !== undefined) data.amountInUsdt = patch.amountInUSDT;
        if (patch.blockNumber !== undefined) data.blockNumber = BigInt(patch.blockNumber);
        if (patch.blockTimestamp !== undefined) data.blockTimestamp = BigInt(patch.blockTimestamp);
        if (patch.orderId !== undefined) data.orderId = patch.orderId != null ? BigInt(patch.orderId) : null;
        if (patch.orderNo !== undefined) data.orderNo = patch.orderNo;
        if (patch.isMatched !== undefined) data.isMatched = patch.isMatched;
        if (patch.matchedAt !== undefined) data.matchedAt = patch.matchedAt;
        await prisma.oblPaymentTransaction.update({ where: { id: BigInt(id) }, data });
      },
      async count(): Promise<number> {
        return prisma.oblPaymentTransaction.count();
      },
    },
  };
}
