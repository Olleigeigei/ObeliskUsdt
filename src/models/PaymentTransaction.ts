/**
 * 支付交易模型
 *
 * @author Telegram @Mhuai8
 */

import { DataTypes, Model, Optional, type Sequelize } from 'sequelize';

export interface PaymentTransactionAttributes {
  id: number;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountInUSDT: string;
  blockNumber: number;
  blockTimestamp: number;
  orderId: number | null;
  orderNo: string | null;
  isMatched: boolean;
  matchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentTransactionCreationAttributes
  extends Optional<PaymentTransactionAttributes, 'id' | 'orderId' | 'orderNo' | 'isMatched' | 'matchedAt' | 'createdAt' | 'updatedAt'> {}

class PaymentTransaction
  extends Model<PaymentTransactionAttributes, PaymentTransactionCreationAttributes>
  implements PaymentTransactionAttributes
{
  public id!: number;
  public txHash!: string;
  public fromAddress!: string;
  public toAddress!: string;
  public amount!: string;
  public amountInUSDT!: string;
  public blockNumber!: number;
  public blockTimestamp!: number;
  public orderId!: number | null;
  public orderNo!: string | null;
  public isMatched!: boolean;
  public matchedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static register(sequelize: Sequelize): typeof PaymentTransaction {
    if (!sequelize.models.PaymentTransaction) {
      PaymentTransaction.init(
        {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          txHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'tx_hash' },
          fromAddress: { type: DataTypes.STRING(42), allowNull: false, field: 'from_address' },
          toAddress: { type: DataTypes.STRING(42), allowNull: false, field: 'to_address' },
          amount: { type: DataTypes.STRING(20), allowNull: false },
          amountInUSDT: { type: DataTypes.DECIMAL(10, 4), allowNull: false, field: 'amount_in_usdt' },
          blockNumber: { type: DataTypes.BIGINT, allowNull: false, field: 'block_number' },
          blockTimestamp: { type: DataTypes.BIGINT, allowNull: false, field: 'block_timestamp' },
          orderId: { type: DataTypes.BIGINT, allowNull: true, field: 'order_id' },
          orderNo: { type: DataTypes.STRING(32), allowNull: true, field: 'order_no' },
          isMatched: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_matched' },
          matchedAt: { type: DataTypes.DATE, allowNull: true, field: 'matched_at' },
          createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' },
          updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'updated_at' },
        },
        {
          sequelize,
          tableName: 'obl_payment_transactions',
          indexes: [
            { fields: ['tx_hash'], unique: true },
            { fields: ['to_address'] },
            { fields: ['order_id'] },
            { fields: ['is_matched'] },
            { fields: ['block_number'] },
          ],
        },
      );
    }
    return PaymentTransaction;
  }
}

export default PaymentTransaction;
