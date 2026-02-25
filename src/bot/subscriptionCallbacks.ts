/**
 * 订阅回调处理器
 *
 * @author Telegram @Mhuai8
 */

import type { ObeliskUSDTDeps } from '../types';

interface CallbackContext {
  bot: {
    answerCallbackQuery: (id: string, options?: { text?: string; show_alert?: boolean }) => Promise<void>;
    sendMessage: (chatId: number, text: string, options?: any) => Promise<any>;
  };
  callbackQuery: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
  };
  user?: { id: number; telegramUserId?: number };
}

export function createSubscriptionCallbacks(
  deps: ObeliskUSDTDeps,
  _services: { orderService: any; botPaymentService: any },
  templates: { getMessage: (path: string) => string; getKeyboard: (path: string) => string },
) {
  return {
    async handle(context: CallbackContext): Promise<void> {
      const data = context.callbackQuery.data || '';
      const chatId = context.callbackQuery.message?.chat.id;

      if (!data.startsWith('sub_') || !chatId) {
        return;
      }

      try {
        if (data === 'sub_plans') {
          await context.bot.sendMessage(chatId, templates.getMessage('subscription.choose_plan'));
          await context.bot.answerCallbackQuery(context.callbackQuery.id);
          return;
        }

        if (data === 'sub_history') {
          await context.bot.sendMessage(chatId, templates.getMessage('subscription.history_title'));
          await context.bot.answerCallbackQuery(context.callbackQuery.id);
          return;
        }

        if (data.startsWith('sub_pay_')) {
          await context.bot.answerCallbackQuery(context.callbackQuery.id, {
            text: '商品支付能力由宿主项目触发，请由宿主创建订单后调用支付流程',
            show_alert: true,
          });
          return;
        }

        await context.bot.answerCallbackQuery(context.callbackQuery.id, { text: templates.getMessage('payment.errors.operation_failed') });
      } catch (error) {
        deps.logger.error('[ObeliskUSDT] 处理订阅回调失败', error);
        await context.bot.answerCallbackQuery(context.callbackQuery.id, {
          text: templates.getMessage('payment.errors.operation_failed'),
          show_alert: true,
        });
      }
    },
  };
}
