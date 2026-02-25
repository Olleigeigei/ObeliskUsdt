/**
 * 认证中间件适配
 *
 * @author Telegram @Mhuai8
 */

import type { RequestHandler } from 'express';
import type { ObeliskUSDTDeps } from '../types';

export function resolveAuthMiddleware(deps: ObeliskUSDTDeps): {
  optional: RequestHandler;
  required: RequestHandler;
  admin: RequestHandler;
} {
  const empty: RequestHandler = (_req, _res, next) => next();
  return deps.authMiddleware || {
    optional: empty,
    required: empty,
    admin: empty,
  };
}
