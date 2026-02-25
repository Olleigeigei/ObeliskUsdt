/**
 * Bot 命令与回调桥接
 *
 * @author Telegram @Mhuai8
 */

import type { ObeliskUSDTDeps } from '../types';
import { createSubscriptionCallbacks } from './subscriptionCallbacks';
import { createTemplateResolver } from './templateResolver';
import type { CreateOrderWithQRParams, CreateOrderWithQRResult } from '../services/botPaymentService';

interface CommandContext {
  bot: { sendMessage: (chatId: number, text: string, options?: any) => Promise<any> };
  msg: { chat: { id: number } };
  user?: { id: number };
}

export function createBotBridge(
  deps: ObeliskUSDTDeps,
  services: { botPaymentService: any; orderService: any },
) {
  const templates = createTemplateResolver(deps);
  const callbacks = createSubscriptionCallbacks(
    deps,
    { orderService: services.orderService, botPaymentService: services.botPaymentService },
    templates,
  );
  const command = {
    name: 'subscription',
    description: '订阅与支付',
    execute: async (ctx: CommandContext) => {
      await ctx.bot.sendMessage(ctx.msg.chat.id, templates.getMessage('subscription.title'), {
        reply_markup: {
          inline_keyboard: [
            [{ text: templates.getKeyboard('subscription.plans'), callback_data: 'sub_plans' }],
            [{ text: templates.getKeyboard('subscription.history'), callback_data: 'sub_history' }],
          ],
        },
      });
    },
  };

  return {
    registerCallbacks(handler: any): void {
      if (handler && typeof handler.register === 'function') {
        handler.register('sub_', callbacks);
      }
    },
    registerCommands(registry: any): void {
      if (registry && typeof registry.register === 'function') {
        registry.register('subscription', command);
      }
    },
    async createOrderWithQR(params: CreateOrderWithQRParams): Promise<CreateOrderWithQRResult> {
      return services.botPaymentService.createOrderWithQR(params);
    },
    templates,
  };
}
