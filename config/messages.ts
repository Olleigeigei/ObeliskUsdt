/**
 * 支付模块默认消息模板
 *
 * @author Telegram @Mhuai8
 */

export const defaultPaymentMessages = {
  payment: {
    bot: {
      open_in_browser: '在浏览器打开支付页面',
      qr_caption: '请使用钱包扫码完成支付',
      payment_created: '订单已创建，请按提示完成支付',
      payment_waiting_confirm: '已检测到支付，等待链上确认',
      payment_completed: '支付已确认，服务已开通',
      payment_failed: '支付处理失败，请联系管理员',
      no_active_package: '当前没有可用商品',
    },
    errors: {
      invalid_user: '缺少访问凭证',
      invalid_amount: '支付金额无效',
      order_not_found: '订单不存在',
      package_not_found: '商品不存在或未启用',
      operation_failed: '操作失败，请稍后重试',
    },
  },
  subscription: {
    title: '订阅与支付',
    choose_plan: '请选择套餐',
    history_title: '购买历史',
  },
} as const;

export type PaymentMessages = typeof defaultPaymentMessages;
