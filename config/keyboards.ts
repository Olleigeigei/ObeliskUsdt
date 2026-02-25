/**
 * 支付模块默认按钮模板
 *
 * @author Telegram @Mhuai8
 */

export const defaultPaymentKeyboards = {
  subscription: {
    plans: '套餐列表',
    history: '购买历史',
    refresh: '刷新状态',
    close: '关闭',
  },
  payment: {
    open_in_browser: '在浏览器打开支付页面',
    check_status: '检查支付状态',
    cancel_order: '取消订单',
  },
} as const;

export type PaymentKeyboards = typeof defaultPaymentKeyboards;
