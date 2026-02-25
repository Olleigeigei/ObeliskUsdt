/**
 * 支付订单模型
 *
 * @author Telegram @Mhuai8
 */

import { DataTypes, Model, Optional, type Sequelize } from 'sequelize';

export type PaymentOrderStatus = 'pending' | 'paid' | 'confirmed' | 'completed' | 'expired' | 'failed' | 'cancelled';

export interface PaymentOrderAttributes {
  id: number;
  orderNo: string;
  bizOrderNo: string;
  baseAmount: string;
  actualAmount: string;
  amountInSun: string;
  walletAddress: string;
  walletId: number;
  status: PaymentOrderStatus;
  txHash: string | null;
  blockNumber: number | null;
  confirmations: number;
  requiredConfirmations: number;
  expiresAt: Date;
  paidAt: Date | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentOrderCreationAttributes
  extends Optional<PaymentOrderAttributes, 'id' | 'txHash' | 'blockNumber' | 'confirmations' | 'paidAt' | 'confirmedAt' | 'completedAt' | 'errorMessage' | 'metadata' | 'createdAt' | 'updatedAt'> {}

class PaymentOrder
  extends Model<PaymentOrderAttributes, PaymentOrderCreationAttributes>
  implements PaymentOrderAttributes
{
  public id!: number;
  public orderNo!: string;
  public bizOrderNo!: string;
  public baseAmount!: string;
  public actualAmount!: string;
  public amountInSun!: string;
  public walletAddress!: string;
  public walletId!: number;
  public status!: PaymentOrderStatus;
  public txHash!: string | null;
  public blockNumber!: number | null;
  public confirmations!: number;
  public requiredConfirmations!: number;
  public expiresAt!: Date;
  public paidAt!: Date | null;
  public confirmedAt!: Date | null;
  public completedAt!: Date | null;
  public errorMessage!: string | null;
  public metadata!: Record<string, unknown> | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static register(sequelize: Sequelize): typeof PaymentOrder {
    if (!sequelize.models.PaymentOrder) {
      PaymentOrder.init(
        {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          orderNo: { type: DataTypes.STRING(32), allowNull: false, unique: true, field: 'order_no' },
          bizOrderNo: { type: DataTypes.STRING(64), allowNull: false, field: 'biz_order_no' },
          baseAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'base_amount' },
          actualAmount: { type: DataTypes.DECIMAL(10, 4), allowNull: false, field: 'actual_amount' },
          amountInSun: { type: DataTypes.STRING(20), allowNull: false, field: 'amount_in_sun' },
          walletAddress: { type: DataTypes.STRING(42), allowNull: false, field: 'wallet_address' },
          walletId: { type: DataTypes.BIGINT, allowNull: false, field: 'wallet_id' },
          status: { type: DataTypes.ENUM('pending', 'paid', 'confirmed', 'completed', 'expired', 'failed', 'cancelled'), defaultValue: 'pending' },
          txHash: { type: DataTypes.STRING(64), allowNull: true, field: 'tx_hash' },
          blockNumber: { type: DataTypes.BIGINT, allowNull: true, field: 'block_number' },
          confirmations: { type: DataTypes.INTEGER, defaultValue: 0 },
          requiredConfirmations: { type: DataTypes.INTEGER, defaultValue: 6, field: 'required_confirmations' },
          expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
          paidAt: { type: DataTypes.DATE, allowNull: true, field: 'paid_at' },
          confirmedAt: { type: DataTypes.DATE, allowNull: true, field: 'confirmed_at' },
          completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
          errorMessage: { type: DataTypes.TEXT, allowNull: true, field: 'error_message' },
          metadata: { type: DataTypes.JSON, allowNull: true },
          createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' },
          updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'updated_at' },
        },
        {
          sequelize,
          tableName: 'obl_payment_orders',
          indexes: [
            { fields: ['order_no'], unique: true },
            { name: 'idx_biz_order_no', fields: ['biz_order_no'] },
            { fields: ['status'] },
            { fields: ['wallet_address', 'actual_amount'] },
            { fields: ['tx_hash'] },
            { fields: ['expires_at'] },
            { fields: ['created_at'] },
          ],
        },
      );
    }
    return PaymentOrder;
  }
}

export default PaymentOrder;
