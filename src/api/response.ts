/**
 * API 统一响应工具
 *
 * @author Telegram @Mhuai8
 */

import type { Response } from 'express';

export function success<T>(res: Response, data: T, message = 'success', status = 200): void {
  res.status(status).json({ success: true, data, message });
}

export function fail(res: Response, code: string, message: string, status = 400, details?: unknown): void {
  res.status(status).json({ success: false, error: { code, message, details } });
}
