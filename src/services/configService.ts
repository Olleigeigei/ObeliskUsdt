/**
 * 支付配置服务
 *
 * @author Telegram @Mhuai8
 */

import type { ObeliskUSDTDeps } from '../types';

type SettingStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

const MEMORY_STORE = new Map<string, string>();

function createFallbackStore(_config: ObeliskUSDTDeps['config']): SettingStore {
  return {
    async get(key: string): Promise<string | null> {
      return MEMORY_STORE.get(key) ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      MEMORY_STORE.set(key, value);
    },
  };
}

export function createPaymentConfigService(deps: ObeliskUSDTDeps) {
  const store = deps.configStore || createFallbackStore(deps.config);

  return {
    async get(key: string): Promise<string | null> {
      return store.get(key);
    },
    async set(key: string, value: string): Promise<void> {
      await store.set(key, value);
    },
    async initializeDefaults(): Promise<void> {
      const defaults: Record<string, string> = {
        payment_network_mode: deps.config.network || 'mainnet',
        payment_order_expire_minutes: String(deps.config.orderExpirationMinutes || 15),
        payment_required_confirmations_mainnet: '6',
        payment_required_confirmations_testnet: '3',
        payment_scan_mode_mainnet: 'wallet',
        payment_scan_mode_testnet: 'wallet',
        payment_scan_interval_mainnet: '5000',
        payment_scan_interval_testnet: '3000',
        payment_lock_ttl_mainnet: '900',
        payment_lock_ttl_testnet: '600',
        payment_trongrid_api_key: deps.config.trongridApiKey || '',
        payment_tronscan_api_key: deps.config.tronscanApiKey || '',
        payment_scan_time_window_ms: String(20 * 60 * 1000),
        payment_scan_trc20_limit: '200',
        payment_qr_logo_url: deps.config.logo || '',
        payment_qr_top_text: 'ObeliskUSDT',
        payment_qr_bottom_text: '支付 {amount} USDT',
      };
      for (const [k, v] of Object.entries(defaults)) {
        const current = await store.get(k);
        if (current === null) {
          await store.set(k, v);
        }
      }
    },
    async getNetworkMode(): Promise<'mainnet' | 'testnet'> {
      const mode = await store.get('payment_network_mode');
      return mode === 'testnet' ? 'testnet' : 'mainnet';
    },
    async setNetworkMode(mode: 'mainnet' | 'testnet'): Promise<void> {
      await store.set('payment_network_mode', mode);
    },
    async getOrderExpireMinutes(): Promise<number> {
      const raw = await store.get('payment_order_expire_minutes');
      const parsed = parseInt(raw || String(deps.config.orderExpirationMinutes || 15), 10);
      return Number.isNaN(parsed) ? 15 : Math.max(5, Math.min(60, parsed));
    },
    async getRequiredConfirmations(): Promise<number> {
      const mode = await this.getNetworkMode();
      const key = `payment_required_confirmations_${mode}`;
      const raw = await store.get(key);
      const parsed = parseInt(raw || (mode === 'mainnet' ? '6' : '3'), 10);
      return Number.isNaN(parsed) ? 6 : Math.max(1, Math.min(20, parsed));
    },
    async getScanMode(): Promise<'wallet' | 'block'> {
      const mode = await this.getNetworkMode();
      const key = `payment_scan_mode_${mode}`;
      const raw = await store.get(key);
      return raw === 'block' ? 'block' : 'wallet';
    },
    async getScanInterval(): Promise<number> {
      const mode = await this.getNetworkMode();
      const key = `payment_scan_interval_${mode}`;
      const raw = await store.get(key);
      const fallback = mode === 'mainnet' ? '5000' : '3000';
      const parsed = parseInt(raw || fallback, 10);
      return Number.isNaN(parsed) ? 5000 : Math.max(1000, parsed);
    },
    async getLockTTL(): Promise<number> {
      const mode = await this.getNetworkMode();
      const key = `payment_lock_ttl_${mode}`;
      const raw = await store.get(key);
      const fallback = mode === 'mainnet' ? '900' : '600';
      const parsed = parseInt(raw || fallback, 10);
      return Number.isNaN(parsed) ? 900 : Math.max(60, parsed);
    },
    async getUSDTContractAddress(): Promise<string> {
      const mode = await this.getNetworkMode();
      return mode === 'testnet'
        ? 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs'
        : 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    },
    async getTronGridApiUrl(): Promise<string> {
      const mode = await this.getNetworkMode();
      return mode === 'testnet' ? 'https://api.shasta.trongrid.io' : 'https://api.trongrid.io';
    },
    async getTronscanApiUrl(): Promise<string> {
      const mode = await this.getNetworkMode();
      return mode === 'testnet' ? 'https://shastapi.tronscan.org' : 'https://apilist.tronscanapi.com';
    },
    async getTronGridApiKey(): Promise<string> {
      const val = await store.get('payment_trongrid_api_key');
      return val || deps.config.trongridApiKey || '';
    },
    async getTronscanApiKey(): Promise<string> {
      const val = await store.get('payment_tronscan_api_key');
      return val || deps.config.tronscanApiKey || '';
    },
    async getScanTimeWindowMs(): Promise<number> {
      const raw = await store.get('payment_scan_time_window_ms');
      const parsed = parseInt(raw || String(20 * 60 * 1000), 10);
      return Number.isNaN(parsed) ? 20 * 60 * 1000 : Math.max(60_000, parsed);
    },
    async getScanTrc20Limit(): Promise<number> {
      const raw = await store.get('payment_scan_trc20_limit');
      const parsed = parseInt(raw || '200', 10);
      return Number.isNaN(parsed) ? 200 : Math.max(20, Math.min(1000, parsed));
    },
    async getQrLogoUrl(): Promise<string> {
      return (await store.get('payment_qr_logo_url')) || deps.config.logo || '';
    },
    async getQrTopText(): Promise<string> {
      return (await store.get('payment_qr_top_text')) || 'ObeliskUSDT';
    },
    async getQrBottomText(): Promise<string> {
      return (await store.get('payment_qr_bottom_text')) || '支付 {amount} USDT';
    },
    async getApiSignMode(): Promise<'off' | 'hmac-sha256'> {
      const mode = deps.config.apiSignMode || '';
      return mode === 'off' ? 'off' : 'hmac-sha256';
    },
    async getApiAuthToken(): Promise<string> {
      const fromStore = await store.get('payment_api_auth_token');
      return (fromStore || deps.config.apiAuthToken || '').trim();
    },
    async getApiSignMaxSkewSeconds(): Promise<number> {
      const raw = await store.get('payment_api_sign_max_skew_seconds');
      const fromStore = raw ? parseInt(String(raw), 10) : NaN;
      const fromConfig = deps.config.apiSignMaxSkewSeconds !== undefined ? Number(deps.config.apiSignMaxSkewSeconds) : NaN;
      const val = Number.isFinite(fromStore) ? fromStore : fromConfig;
      if (!Number.isFinite(val) || val <= 0) return 300;
      return Math.min(3600, Math.floor(val));
    },
    getNetworkPresets(): Record<string, unknown> {
      return {
        mainnet: {
          label: '主网',
          tronscanApiUrl: 'https://apilist.tronscanapi.com',
          trongridApiUrl: 'https://api.trongrid.io',
          requiredConfirmations: 6,
          scanMode: 'wallet',
        },
        testnet: {
          label: '测试网',
          tronscanApiUrl: 'https://shastapi.tronscan.org',
          trongridApiUrl: 'https://api.shasta.trongrid.io',
          requiredConfirmations: 3,
          scanMode: 'wallet',
        },
      };
    },
  };
}
