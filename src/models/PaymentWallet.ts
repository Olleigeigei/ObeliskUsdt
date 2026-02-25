/**
 * 支付钱包模型
 *
 * @author Telegram @Mhuai8
 */

import { DataTypes, Model, Optional, type Sequelize } from 'sequelize';

export interface PaymentWalletAttributes {
  id: number;
  address: string;
  label: string;
  isActive: boolean;
  priority: number;
  totalOrders: number;
  totalAmount: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentWalletCreationAttributes
  extends Optional<PaymentWalletAttributes, 'id' | 'totalOrders' | 'totalAmount' | 'lastUsedAt' | 'createdAt' | 'updatedAt'> {}

class PaymentWallet
  extends Model<PaymentWalletAttributes, PaymentWalletCreationAttributes>
  implements PaymentWalletAttributes
{
  public id!: number;
  public address!: string;
  public label!: string;
  public isActive!: boolean;
  public priority!: number;
  public totalOrders!: number;
  public totalAmount!: string;
  public lastUsedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static register(sequelize: Sequelize): typeof PaymentWallet {
    if (!sequelize.models.PaymentWallet) {
      PaymentWallet.init(
        {
          id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
          address: {
            type: DataTypes.STRING(42),
            allowNull: false,
            unique: true,
            validate: { is: /^T[A-Za-z1-9]{33}$/ },
          },
          label: { type: DataTypes.STRING(100), allowNull: false },
          isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
          priority: { type: DataTypes.INTEGER, defaultValue: 0 },
          totalOrders: { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_orders' },
          totalAmount: { type: DataTypes.DECIMAL(20, 6), defaultValue: '0.000000', field: 'total_amount' },
          lastUsedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_used_at' },
          createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'created_at' },
          updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'updated_at' },
        },
        {
          sequelize,
          tableName: 'obl_payment_wallets',
          indexes: [
            { fields: ['is_active', 'priority'] },
            { fields: ['last_used_at'] },
          ],
        },
      );
    }
    return PaymentWallet;
  }
}

export default PaymentWallet;
