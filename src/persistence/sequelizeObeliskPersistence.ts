/**
 * Sequelize 实现的 ObeliskPersistence，供默认接入路径使用。
 *
 * @author Telegram @okgeceo
 */

import { Op } from 'sequelize';
import type { Sequelize } from 'sequelize';
import PaymentOrder from '../models/PaymentOrder';
import PaymentWallet from '../models/PaymentWallet';
import PaymentTransaction from '../models/PaymentTransaction';
import type {
  ObeliskPersistence,
  OrderCreateInput,
  PaymentOrderRow,
  PaymentTransactionRow,
  PaymentWalletRow,
  WalletCreateInput,
} from './obeliskPersistence';
import type { PaymentOrderStatus } from '../models/PaymentOrder';

function toOrderRow(m: PaymentOrder): PaymentOrderRow {
  return m.get({ plain: true }) as PaymentOrderRow;
}

function toWalletRow(m: PaymentWallet): PaymentWalletRow {
  return m.get({ plain: true }) as PaymentWalletRow;
}

function toTxRow(m: PaymentTransaction): PaymentTransactionRow {
  return m.get({ plain: true }) as PaymentTransactionRow;
}

/**
 * 使用已 register 的 Sequelize 模型构造持久化实现。
 */
export function createSequelizeObeliskPersistence(_sequelize: Sequelize): ObeliskPersistence {
  return {
    order: {
      async create(data: OrderCreateInput): Promise<PaymentOrderRow> {
        const row = await PaymentOrder.create(data as any);
        return toOrderRow(row);
      },
      async findByOrderNo(orderNo: string): Promise<PaymentOrderRow | null> {
        const row = await PaymentOrder.findOne({ where: { orderNo } });
        return row ? toOrderRow(row) : null;
      },
      async findActiveBizOrderDuplicate(bizOrderNo: string, now: Date): Promise<PaymentOrderRow | null> {
        const row = await PaymentOrder.findOne({
          where: {
            bizOrderNo,
            status: { [Op.in]: ['pending', 'paid', 'confirmed'] },
            expiresAt: { [Op.gt]: now },
          },
          order: [['createdAt', 'DESC']],
        });
        return row ? toOrderRow(row) : null;
      },
      async findById(id: number): Promise<PaymentOrderRow | null> {
        const row = await PaymentOrder.findByPk(id);
        return row ? toOrderRow(row) : null;
      },
      async updateById(id: number, patch: Partial<PaymentOrderRow>): Promise<void> {
        await PaymentOrder.update(patch as any, { where: { id } });
      },
      async cancelPendingByOrderNo(orderNo: string): Promise<{ affected: number; order: PaymentOrderRow | null }> {
        const order = await PaymentOrder.findOne({ where: { orderNo } });
        if (!order) return { affected: 0, order: null };
        const plain = toOrderRow(order);
        const [affected] = await PaymentOrder.update(
          { status: 'cancelled' },
          { where: { id: order.id, status: 'pending' } },
        );
        return { affected, order: plain };
      },
      async cancelPendingById(id: number): Promise<{ affected: number; order: PaymentOrderRow | null }> {
        const order = await PaymentOrder.findByPk(id);
        if (!order) return { affected: 0, order: null };
        const plain = toOrderRow(order);
        const [affected] = await PaymentOrder.update(
          { status: 'cancelled' },
          { where: { id: order.id, status: 'pending' } },
        );
        return { affected, order: plain };
      },
      async findPendingExpiredBefore(now: Date): Promise<PaymentOrderRow[]> {
        const rows = await PaymentOrder.findAll({
          where: { status: 'pending', expiresAt: { [Op.lt]: now } },
        });
        return rows.map(toOrderRow);
      },
      async findPendingForIncomingMatch(params: {
        walletAddress: string;
        actualAmount: string;
        now: Date;
      }): Promise<PaymentOrderRow | null> {
        const row = await PaymentOrder.findOne({
          where: {
            status: 'pending',
            walletAddress: params.walletAddress,
            actualAmount: params.actualAmount,
            expiresAt: { [Op.gt]: params.now },
          },
          order: [['createdAt', 'ASC']],
        });
        return row ? toOrderRow(row) : null;
      },
      async updateToPaidIfStillPending(
        id: number,
        patch: Pick<PaymentOrderRow, 'txHash' | 'blockNumber' | 'paidAt' | 'status'>,
      ): Promise<number> {
        const [affected] = await PaymentOrder.update(patch as any, { where: { id, status: 'pending' } });
        return affected;
      },
      async findPaidOrConfirmedWithTx(limit: number): Promise<PaymentOrderRow[]> {
        const rows = await PaymentOrder.findAll({
          where: {
            status: { [Op.in]: ['paid', 'confirmed'] },
            txHash: { [Op.ne]: null },
          },
          limit,
          order: [['updatedAt', 'ASC']],
        });
        return rows.map(toOrderRow);
      },
      async findPagedForAdmin(params: {
        page: number;
        pageSize: number;
        status?: PaymentOrderStatus;
        orderNoContains?: string;
      }): Promise<{ rows: PaymentOrderRow[]; total: number }> {
        const where: Record<string, unknown> = {};
        if (params.status) where.status = params.status;
        if (params.orderNoContains) {
          where.orderNo = { [Op.like]: `%${params.orderNoContains}%` };
        }
        const { rows, count } = await PaymentOrder.findAndCountAll({
          where,
          order: [['createdAt', 'DESC']],
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
        });
        return { rows: rows.map(toOrderRow), total: count };
      },
      async deleteById(id: number): Promise<void> {
        await PaymentOrder.destroy({ where: { id } });
      },
      async deleteFinishedBefore(deadline: Date, statuses: PaymentOrderStatus[]): Promise<number> {
        return PaymentOrder.destroy({
          where: {
            status: { [Op.in]: statuses },
            updatedAt: { [Op.lt]: deadline },
          },
        });
      },
      async count(): Promise<number> {
        return PaymentOrder.count();
      },
      async countByStatus(status: PaymentOrderStatus): Promise<number> {
        return PaymentOrder.count({ where: { status } });
      },
    },
    wallet: {
      async count(): Promise<number> {
        return PaymentWallet.count();
      },
      async countActive(): Promise<number> {
        return PaymentWallet.count({ where: { isActive: true } });
      },
      async listActiveAddresses(): Promise<string[]> {
        const rows = await PaymentWallet.findAll({
          where: { isActive: true },
          attributes: ['address'],
        });
        return rows.map((r) => r.address);
      },
      async listForAdminOrdered(): Promise<PaymentWalletRow[]> {
        const rows = await PaymentWallet.findAll({ order: [['priority', 'ASC'], ['createdAt', 'DESC']] });
        return rows.map(toWalletRow);
      },
      async listActiveForAllocation(limit: number): Promise<PaymentWalletRow[]> {
        const rows = await PaymentWallet.findAll({
          where: { isActive: true },
          order: [['priority', 'ASC'], ['lastUsedAt', 'ASC']],
          limit,
        });
        return rows.map(toWalletRow);
      },
      async findById(id: number): Promise<PaymentWalletRow | null> {
        const row = await PaymentWallet.findByPk(id);
        return row ? toWalletRow(row) : null;
      },
      async create(data: WalletCreateInput): Promise<PaymentWalletRow> {
        const row = await PaymentWallet.create(data as any);
        return toWalletRow(row);
      },
      async updateById(id: number, patch: Partial<PaymentWalletRow>): Promise<void> {
        await PaymentWallet.update(patch as any, { where: { id } });
      },
      async deleteById(id: number): Promise<void> {
        await PaymentWallet.destroy({ where: { id } });
      },
      async touchLastUsed(id: number, at: Date): Promise<void> {
        await PaymentWallet.update({ lastUsedAt: at }, { where: { id } });
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
        const [row, created] = await PaymentTransaction.findOrCreate({
          where: { txHash },
          defaults: {
            ...defaults,
            txHash,
          } as any,
        });
        return { row: toTxRow(row), created };
      },
      async updateById(id: number, patch: Partial<PaymentTransactionRow>): Promise<void> {
        await PaymentTransaction.update(patch as any, { where: { id } });
      },
      async count(): Promise<number> {
        return PaymentTransaction.count();
      },
    },
  };
}
