/**
 * API 签名校验中间件
 *
 * @author Telegram @Mhuai8
 */

import crypto from 'crypto';
import type { RequestHandler } from 'express';
import { fail } from './response';

const moneyRegex = /^\d+(\.\d{1,2})?$/;

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(Number.isFinite(value) ? value : null);
  if (typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const items = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
    return `{${items.join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function buildCanonicalQuery(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return keys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
}

function hmacSha256Hex(secret: string, content: string): string {
  return crypto.createHmac('sha256', secret).update(content).digest('hex');
}

function getSignatureFromRequest(req: any): string {
  const headerSigRaw = (req.headers?.['x-obl-signature'] || req.headers?.['x-signature']) as
    | string
    | string[]
    | undefined;
  const headerSig = Array.isArray(headerSigRaw) ? headerSigRaw[0] : headerSigRaw;
  const bodySig = req.body?.signature ? String(req.body.signature) : '';
  const querySig = req.query?.signature ? String(req.query.signature) : '';
  return String(headerSig || bodySig || querySig || '').trim();
}

function parseTsToMs(value: unknown): number {
  const raw = typeof value === 'string' ? value.trim() : value;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return NaN;
  if (parsed <= 0) return NaN;
  if (parsed > 1e12) return Math.floor(parsed);
  return Math.floor(parsed * 1000);
}

function pickCreateFields(body: any): Record<string, string> {
  const result: Record<string, string> = {};

  const bizOrderNo = body?.bizOrderNo ? String(body.bizOrderNo).trim() : '';
  const baseAmountRaw = body?.baseAmount !== undefined && body?.baseAmount !== null ? String(body.baseAmount).trim() : '';
  const tsRaw = body?.ts !== undefined && body?.ts !== null ? String(body.ts).trim() : '';
  const nonceRaw = body?.nonce !== undefined && body?.nonce !== null ? String(body.nonce).trim() : '';
  const metadata = body?.metadata;

  if (bizOrderNo) result.bizOrderNo = bizOrderNo;
  if (baseAmountRaw) result.baseAmount = baseAmountRaw;
  if (tsRaw) result.ts = tsRaw;
  if (nonceRaw) result.nonce = nonceRaw;

  if (metadata && typeof metadata === 'object') {
    const raw = stableStringify(metadata);
    if (raw && raw !== '{}' && raw !== '[]') {
      result.metadata = raw;
    }
  }

  return result;
}

export function createSignMiddleware(params: {
  getSignMode: () => Promise<'off' | 'hmac-sha256'>;
  getAuthToken: () => Promise<string>;
  getMaxSkewSeconds: () => Promise<number>;
  getRedis: () => Promise<any>;
}): RequestHandler {
  return async (req, res, next) => {
    try {
      const mode = await params.getSignMode();
      if (mode === 'off') {
        next();
        return;
      }

      const token = await params.getAuthToken();
      if (!token) {
        fail(res, 'MISCONFIGURED_SIGNING', '签名配置缺失', 500);
        return;
      }

      const signature = getSignatureFromRequest(req);
      if (!signature) {
        fail(res, 'SIGNATURE_REQUIRED', '缺少签名', 401);
        return;
      }

      const body = req.body || {};
      const bizOrderNo = body?.bizOrderNo ? String(body.bizOrderNo).trim() : '';
      const baseAmountRaw = body?.baseAmount !== undefined && body?.baseAmount !== null ? String(body.baseAmount).trim() : '';
      const tsRaw = body?.ts !== undefined && body?.ts !== null ? String(body.ts).trim() : '';
      const nonce = body?.nonce !== undefined && body?.nonce !== null ? String(body.nonce).trim() : '';

      if (!bizOrderNo || !baseAmountRaw || !tsRaw || !nonce) {
        fail(res, 'SIGNATURE_PARAMS_REQUIRED', '缺少签名必填参数', 400);
        return;
      }
      if (bizOrderNo.length > 64) {
        fail(res, 'SIGNATURE_BIZ_ORDER_NO_INVALID', '业务单号长度不能超过64', 400);
        return;
      }
      if (!moneyRegex.test(baseAmountRaw)) {
        fail(res, 'SIGNATURE_AMOUNT_INVALID', '支付金额格式无效（仅支持最多 2 位小数）', 400);
        return;
      }

      const maxSkewSecondsRaw = await params.getMaxSkewSeconds();
      const maxSkewSeconds = Number.isFinite(Number(maxSkewSecondsRaw)) && Number(maxSkewSecondsRaw) > 0
        ? Math.min(3600, Math.floor(Number(maxSkewSecondsRaw)))
        : 300;

      const tsMs = parseTsToMs(tsRaw);
      if (!Number.isFinite(tsMs)) {
        fail(res, 'SIGNATURE_TS_INVALID', '签名时间戳无效', 400);
        return;
      }
      const nowMs = Date.now();
      if (Math.abs(nowMs - tsMs) > maxSkewSeconds * 1000) {
        fail(res, 'SIGNATURE_TS_EXPIRED', '签名时间戳已过期', 401);
        return;
      }

      const nonceTrimmed = nonce.trim();
      if (nonceTrimmed.length < 8 || nonceTrimmed.length > 128) {
        fail(res, 'SIGNATURE_NONCE_INVALID', '签名随机串无效', 400);
        return;
      }

      const redis = await params.getRedis();
      if (!redis) {
        fail(res, 'SIGNATURE_REPLAY_STORAGE_MISSING', '防重放存储不可用', 500);
        return;
      }
      const nonceKey = `obl:usdt:api-sign:nonce:${nonceTrimmed}`;
      try {
        const ttlSeconds = Math.max(60, Math.min(7200, maxSkewSeconds * 2));
        const setRes = await redis.set(nonceKey, '1', 'EX', ttlSeconds, 'NX');
        if (setRes !== 'OK') {
          fail(res, 'SIGNATURE_REPLAYED', '签名已使用，请重试', 401);
          return;
        }
      } catch (error) {
        fail(res, 'SIGNATURE_REPLAY_STORAGE_FAILED', '防重放校验失败', 500);
        return;
      }

      const canonical = buildCanonicalQuery(pickCreateFields(body));
      const expected = hmacSha256Hex(token, canonical);

      if (String(signature).toLowerCase() !== expected.toLowerCase()) {
        fail(res, 'SIGNATURE_INVALID', '签名无效', 401);
        return;
      }

      next();
    } catch (error: any) {
      fail(res, 'SIGNATURE_CHECK_FAILED', error?.message || '签名校验失败', 500);
    }
  };
}

