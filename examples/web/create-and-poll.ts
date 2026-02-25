/**
 * 网页端：创建订单并轮询状态示例
 *
 * @author Telegram @Mhuai8
 */

import crypto from 'crypto';

type CreateOrderResult = {
  orderNo: string;
  actualAmount: string;
  walletAddress: string;
  paymentPageUrl: string;
  expiresAt: string;
  orderToken: string;
};

type OrderStatusResult = {
  status: 'pending' | 'paid' | 'confirmed' | 'completed' | 'cancelled' | 'expired';
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

function buildSignature(payload: any, apiAuthToken: string): string {
  const picked: Record<string, string> = {};
  const fields = ['bizOrderNo', 'baseAmount', 'ts', 'nonce'];
  for (const f of fields) {
    const v = payload?.[f];
    const s = v === undefined || v === null ? '' : String(v).trim();
    if (s) picked[f] = s;
  }
  if (payload?.metadata && typeof payload.metadata === 'object') {
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
export async function createOrder(params: {
  apiBaseUrl: string;
  apiAuthToken: string;
  baseAmount: string;
  bizOrderNo: string;
}) {
  const payload = {
    bizOrderNo: params.bizOrderNo,
    baseAmount: params.baseAmount,
    ts: Math.floor(Date.now() / 1000),
    nonce: crypto.randomBytes(16).toString('hex'),
    metadata: { scene: 'web', channel: 'h5' },
  };
  const signature = buildSignature(payload, params.apiAuthToken);
  const response = await fetch(`${params.apiBaseUrl}/payment/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...payload, signature }),
  });

  if (!response.ok) {
    throw new Error(`创建订单失败: HTTP ${response.status}`);
  }

  return (await response.json()) as CreateOrderResult;
}

/**
 * 轮询订单状态，直到完成或超时
 */
export async function pollOrderStatus(params: {
  apiBaseUrl: string;
  orderNo: string;
  orderToken: string;
  intervalMs?: number;
  timeoutMs?: number;
}) {
  const intervalMs = params.intervalMs ?? 3000;
  const timeoutMs = params.timeoutMs ?? 5 * 60 * 1000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`${params.apiBaseUrl}/payment/status/${params.orderNo}`, {
      method: 'GET',
      headers: {
        'x-obl-order-token': params.orderToken,
      },
    });

    if (!response.ok) {
      throw new Error(`查询状态失败: HTTP ${response.status}`);
    }

    const result = (await response.json()) as OrderStatusResult;
    if (result.status === 'completed') {
      return result;
    }
    if (result.status === 'cancelled' || result.status === 'expired') {
      throw new Error(`订单状态异常: ${result.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('轮询超时，请稍后重试');
}
