/**
 * Bot 模板解析器
 *
 * @author Telegram @Mhuai8
 */

import { defaultPaymentMessages } from '../../config/messages';
import { defaultPaymentKeyboards } from '../../config/keyboards';
import { deepMerge } from '../utils/deepMerge';
import type { ObeliskUSDTDeps } from '../types';

export function createTemplateResolver(deps: ObeliskUSDTDeps) {
  const messages = deepMerge(defaultPaymentMessages, deps.config.messages as any);
  const keyboards = deepMerge(defaultPaymentKeyboards, deps.config.keyboards as any);

  return {
    messages,
    keyboards,
    getMessage(path: string): string {
      const parts = path.split('.');
      let current: any = messages;
      for (const part of parts) {
        current = current?.[part];
      }
      if (typeof current === 'string') {
        return current;
      }
      return path;
    },
    getKeyboard(path: string): string {
      const parts = path.split('.');
      let current: any = keyboards;
      for (const part of parts) {
        current = current?.[part];
      }
      if (typeof current === 'string') {
        return current;
      }
      return path;
    },
  };
}
