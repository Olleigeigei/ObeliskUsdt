/**
 * 支付模型注册
 *
 * @author Telegram @Mhuai8
 */

import type { Sequelize } from 'sequelize';
import PaymentWallet from './PaymentWallet';
import PaymentOrder from './PaymentOrder';
import PaymentTransaction from './PaymentTransaction';

export function registerModels(sequelize: Sequelize) {
  const Wallet = PaymentWallet.register(sequelize);
  const Order = PaymentOrder.register(sequelize);
  const Transaction = PaymentTransaction.register(sequelize);

  if (!(Order as any).associations?.wallet) {
    Order.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });
  }
  if (!(Transaction as any).associations?.order) {
    Transaction.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
  }

  return {
    PaymentWallet: Wallet,
    PaymentOrder: Order,
    PaymentTransaction: Transaction,
  };
}

export { PaymentWallet, PaymentOrder, PaymentTransaction };
