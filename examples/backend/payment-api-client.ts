/**
 * 宿主服务端调用支付接口示例
 *
 * @author Telegram @Mhuai8
 */

import crypto from 'crypto';

export type CreatePaymentPayload = {
  bizOrderNo: string;
  baseAmount: string | number;
  ts?: number;
  nonce?: string;
  metadata?: Record<string, unknown> | null;
};

function stableStringify(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(Number.isFinite(value) ? value : null);
  if (typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function buildSignature(payload: CreatePaymentPayload, apiAuthToken: string): string {
  const picked: Record<string, string> = {};
  const fields = ['bizOrderNo', 'baseAmount', 'ts', 'nonce'];
  for (const f of fields) {
    const v = (payload as any)?.[f];
    const s = v === undefined || v === null ? '' : String(v).trim();
    if (s) picked[f] = s;
  }
  if (payload.metadata && typeof payload.metadata === 'object') {
    const raw = stableStringify(payload.metadata);
    if (raw && raw !== '{}' && raw !== '[]') picked.metadata = raw;
  }

  const canonical = Object.keys(picked)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(picked[k])}`)
    .join('&');

  return crypto.createHmac('sha256', apiAuthToken).update(canonical).digest('hex');
}

/**
 * 创建支付订单
 */
export async function createPaymentOrder(params: {
  apiBaseUrl: string;
  payload: CreatePaymentPayload;
  apiAuthToken: string;
}) {
  if (!params.payload.ts) {
    params.payload.ts = Math.floor(Date.now() / 1000);
  }
  if (!params.payload.nonce) {
    params.payload.nonce = crypto.randomBytes(16).toString('hex');
  }
  const signature = buildSignature(params.payload, params.apiAuthToken);
  const response = await fetch(`${params.apiBaseUrl}/payment/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...params.payload, signature }),
  });

  if (!response.ok) {
    throw new Error(`创建支付订单失败: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * 查询支付状态
 */
export async function getPaymentStatus(params: {
  apiBaseUrl: string;
  orderNo: string;
  orderToken: string;
}) {
  const response = await fetch(`${params.apiBaseUrl}/payment/status/${params.orderNo}`, {
    method: 'GET',
    headers: {
      'x-obl-order-token': params.orderToken,
    },
  });

  if (!response.ok) {
    throw new Error(`查询支付状态失败: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * 取消支付订单
 */
export async function cancelPaymentOrder(params: {
  apiBaseUrl: string;
  orderNo: string;
  orderToken: string;
}) {
  const response = await fetch(`${params.apiBaseUrl}/payment/cancel/${params.orderNo}`, {
    method: 'POST',
    headers: {
      'x-obl-order-token': params.orderToken,
    },
  });

  if (!response.ok) {
    throw new Error(`取消支付订单失败: HTTP ${response.status}`);
  }

  return response.json();
}
