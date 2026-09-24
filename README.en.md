<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/语言-简体中文-EE1C25?style=flat-square" alt="简体中文"></a>
  <a href="README.en.md"><img src="https://img.shields.io/badge/lang-English-007EC6?style=flat-square" alt="English"></a>
</p>

<div align="center">

<img src="assets/obelisk-usdt-logo.png" width="640" alt="ObeliskUSDT" />

<br />

### Embeddable USDT-TRC20 payment module

*Self-hosted payment pipeline for web and Telegram — funds go to your wallets.*

<br />

[![npm version](https://img.shields.io/npm/v/%40obeliskstudio%2Fobelisk-usdt?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/@obeliskstudio/obelisk-usdt) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE) [![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/) [![USDT-TRC20](https://img.shields.io/badge/Chain-USDT--TRC20-26A17B?style=for-the-badge&logo=tether&logoColor=white)](https://tron.network/) [![Self-hosted](https://img.shields.io/badge/Deploy-Self--hosted-555?style=for-the-badge&logo=docker&logoColor=white)](#overview)

<br />

[![GitHub stars](https://img.shields.io/github/stars/Olleigeigei/ObeliskUsdt?style=for-the-badge&logo=github)](https://github.com/Olleigeigei/ObeliskUsdt/stargazers) [![GitHub forks](https://img.shields.io/github/forks/Olleigeigei/ObeliskUsdt?style=for-the-badge&logo=github)](https://github.com/Olleigeigei/ObeliskUsdt/network/members) [![Last commit](https://img.shields.io/github/last-commit/Olleigeigei/ObeliskUsdt?style=for-the-badge&logo=git)](https://github.com/Olleigeigei/ObeliskUsdt/commits/master)

<br />

[![Business Contact](https://img.shields.io/badge/Business-Telegram%20%40okgeceo-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/okgeceo) [![Studio Channel](https://img.shields.io/badge/Studio-Telegram%20%40ObeliskStudio-1D9BF0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/ObeliskStudio) [![npm package](https://img.shields.io/badge/npm-%40obeliskstudio%2Fobelisk--usdt-CB3837?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/@obeliskstudio/obelisk-usdt)

</div>

---

## Table of contents

- [Overview](#overview)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Scope](#scope)
- [Features](#features)
- [Quick start](#quick-start)
- [Payment flow](#payment-flow)
- [Order lifecycle](#order-lifecycle)
- [HTTP API](#http-api)
- [Environment](#environment)
- [Create order & signing](#create-and-sign)
- [Security & reliability](#security-and-reliability)
- [Examples & docs](#examples-and-docs)
- [Pre-launch checklist](#pre-launch)
- [License & contact](#license-and-contact)

> Full integration guide (Chinese): **[docs/使用说明-接入文档.md](docs/使用说明-接入文档.md)** · Simplified Chinese README: **[README.md](README.md)**

---

<a id="overview"></a>

## Overview

**ObeliskUSDT** is a **USDT-TRC20** payment module: create orders, QR codes, on-chain scanning, and `onOrderConfirmed` callbacks.  
It is **not** a storefront — it embeds into your app; catalog, pricing, and entitlements stay in the host.

| | |
|------|------|
| Goal | Low-friction integration; payment decoupled from business logic |
| Use cases | Websites, Telegram bots, SaaS, subscriptions, paid tools |
| Reconciliation | Pass through `bizOrderNo`; payment `orderNo` is separate |
| Deployment | Self-hosted; funds land in **your** wallets |

The npm package ships compiled **JavaScript** without `.d.ts`. TypeScript hosts can add `declare module '@obeliskstudio/obelisk-usdt'`.

---

<a id="tech-stack"></a>

## Tech stack

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Redis](https://img.shields.io/badge/Redis-Required-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![MySQL](https://img.shields.io/badge/MySQL-Dialect-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Dialect-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Dialect-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Sequelize](https://img.shields.io/badge/Sequelize-Optional-52B0E7?style=flat-square&logo=sequelize&logoColor=white)](https://sequelize.org/)
[![Prisma](https://img.shields.io/badge/Prisma-via_persistence-2D3748?style=flat-square&logo=prisma&logoColor=white)](examples/backend/prisma-persistence.example.ts)
[![Tron](https://img.shields.io/badge/TronGrid_%2B_Tronscan-API-FF0013?style=flat-square&logo=tron&logoColor=white)](https://developers.tron.network/)

</div>

Persistence: either pass **`sequelize`** (built-in) or a custom **`persistence`** implementing `ObeliskPersistence` (e.g. Prisma).

---

<a id="architecture"></a>

## Architecture

```mermaid
flowchart LR
  subgraph host [HostApp]
    Web[WebOrAPI]
    Bot[TelegramBot]
    Grant[onOrderConfirmed_Idempotent]
  end
  subgraph module [ObeliskUSDT]
    Router[paymentRouter_adminRouter]
    Scanner[blockScanner]
    OrderSvc[orderService]
  end
  subgraph infra [Infra]
    DB[(obl_tables)]
    Redis[(Redis_nonce_cache)]
    Chain[TronGrid_Tronscan]
  end
  Web --> Router
  Bot --> Router
  Router --> OrderSvc
  Scanner --> Chain
  Scanner --> OrderSvc
  OrderSvc --> DB
  Router --> Redis
  Scanner --> Grant
```

---

<a id="scope"></a>

## Scope

| Module | Host app |
|--------|----------|
| Payment orders and payable amounts | Products, pricing, inventory |
| Wallet assignment and QR codes | Entitlements (**must be idempotent**) |
| Chain matching and status updates | Users and authorization |
| `onOrderConfirmed` callback | Finance and internal reporting |

Tables use prefix **`obl_`**: `obl_payment_wallets`, `obl_payment_orders`, `obl_payment_transactions`.

---

<a id="features"></a>

## Features

| | |
|---|------|
| ![API](https://img.shields.io/badge/API-First-007EC6?style=flat-square) | HTTP routes; no framework lock-in |
| ![Self-hosted](https://img.shields.io/badge/Self--hosted-Audit-555?style=flat-square) | Deploy on your infra; auditable flow |
| ![Web+Bot](https://img.shields.io/badge/Web_%2B_Bot-Shared-5865F2?style=flat-square) | One core for web and bot |
| ![Hash](https://img.shields.io/badge/Tx-Dedup-2EA043?style=flat-square) | Tx hash dedup |
| ![Token](https://img.shields.io/badge/orderToken-Ownership-8957E5?style=flat-square) | Status/cancel scoped by `orderToken` |
| ![Sign](https://img.shields.io/badge/HMAC-Anti_abuse-CB3837?style=flat-square) | HMAC on create + `ts`/`nonce` anti-replay |

---

<a id="quick-start"></a>

## Quick start

### Install

```bash
npm i @obeliskstudio/obelisk-usdt@latest
npm ls @obeliskstudio/obelisk-usdt
```

### Checklist

- [ ] Run DB migrations (`runObeliskUSDTMigrations`)
- [ ] `initObeliskUSDT(...)` and mount `paymentRouter` / `adminRouter`
- [ ] `startScanner()` + `registerScheduledTasks(cron)`
- [ ] Idempotent `onOrderConfirmed`
- [ ] Add **at least 2** receiving wallets in admin before going live

### Migrations

```ts
import { runObeliskUSDTMigrations, initObeliskUSDT } from '@obeliskstudio/obelisk-usdt';

await runObeliskUSDTMigrations({ sequelize, logger });
// or runObeliskUSDTMigrations({ query: myQueryFn, logger });
```

- Migration table: `obl_usdt_schema_migrations`; applied scripts are skipped  
- **`initObeliskUSDT` does not migrate** — run migrations in your deploy step

### Initialize

```ts
const usdt = initObeliskUSDT({
  sequelize, // or persistence: createPrismaObeliskPersistence(prisma)
  redis,
  logger,
  config: {
    network: 'mainnet',
    webUrl: process.env.WEB_URL || '',
    botUsername: process.env.BOT_USERNAME || '',
    trongridApiKey: process.env.TRONGRID_API_KEY,
    tronscanApiKey: process.env.TRONSCAN_API_KEY,
    apiAuthToken: process.env.OBL_USDT_API_AUTH_TOKEN || '',
  },
  authMiddleware: {
    optional: optionalAuth,
    required: requireAuth,
    admin: requireAdminAuth,
  },
  onOrderConfirmed: async (order) => {
    await benefitService.grantByOrderNo(order.orderNo); // idempotent
  },
});

app.use('/api', usdt.paymentRouter);
app.use('/api', usdt.adminRouter);
await usdt.startScanner();
usdt.registerScheduledTasks(cron);
```

---

<a id="payment-flow"></a>

## Payment flow

```mermaid
sequenceDiagram
  participant Host as HostApp
  participant API as paymentRouter
  participant User as UserWallet
  participant Scan as blockScanner
  participant CB as onOrderConfirmed

  Host->>API: POST /payment/create bizOrderNo baseAmount signature
  API-->>Host: orderNo wallet QR orderToken
  User->>User: USDT TRC20 transfer
  Scan->>Scan: TronGrid primary Tronscan fallback
  Scan->>API: match order update status
  Note over Scan,API: pending to paid to confirmed to completed
  Scan->>CB: confirmed threshold reached
  CB->>Host: idempotent grant
```

---

<a id="order-lifecycle"></a>

## Order lifecycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid: chain matched
  paid --> confirmed: confirmations OK
  confirmed --> completed: callback done
  pending --> cancelled: user cancel or timeout
```

| Status | Meaning |
|--------|---------|
| `pending` | Awaiting payment |
| `paid` | Matched on chain |
| `confirmed` | Confirmations OK |
| `completed` | Callback finished |

---

<a id="http-api"></a>

## HTTP API

### User routes

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/payment/create` | HMAC signature required |
| `GET` | `/payment/status/:orderNo` | Requires `orderToken` |
| `POST` | `/payment/cancel/:orderNo` | Requires `orderToken` |

`orderToken`: header `x-obl-order-token` or query `?token=`

### Admin routes

| Prefix | Notes |
|--------|-------|
| `/admin/payment/wallets/*` | Wallet CRUD |
| `/admin/payment/orders/*` | Order management |
| `/admin/payment/network*` | Network / scanner config |
| `GET /admin/payment/stats` | Scanner health (circuit breaker, queue) |

---

<a id="environment"></a>

## Environment

| Variable | Purpose |
|----------|---------|
| `TRONGRID_API_KEY` | TronGrid (primary) |
| `TRONSCAN_API_KEY` | Tronscan fallback (separate key) |
| `OBL_USDT_API_AUTH_TOKEN` | HMAC secret for create |
| `WEB_URL` | Web base URL |
| `BOT_USERNAME` | Bot username (bot scenarios) |

Never hardcode secrets. Status/cancel must verify order ownership.

---

<a id="create-and-sign"></a>

## Create order & signing

### Request body

```json
{
  "bizOrderNo": "HOST-ORDER-10001",
  "baseAmount": "99.00",
  "ts": 1700000000,
  "nonce": "e1b4f0f3b7d24e62a3d6c9f78b7a4b12",
  "metadata": { "biz": "obeliskcard", "plan": "vip_year" },
  "signature": "<hmac_hex_lowercase>"
}
```

### Fields

| Field | Required | Notes |
|-------|----------|-------|
| `bizOrderNo` | yes | Host order id; idempotent while pending and not expired |
| `baseAmount` | yes | > 0, max 2 decimals, string recommended |
| `ts` | yes | Seconds or ms; default skew 300s (`apiSignMaxSkewSeconds`) |
| `nonce` | yes | Redis `SET NX` per `bizOrderNo+nonce` |
| `metadata` | no | Included in signature (stable JSON) |
| `signature` | yes | HMAC-SHA256 hex lowercase |

### Signing (summary)

1. Fields: `bizOrderNo`, `baseAmount`, `ts`, `nonce`, `metadata` (skip if empty)  
2. Sort keys ASCII; join `key=encodeURIComponent(value)&...`  
3. `stableStringify` metadata before encoding  
4. HMAC-SHA256; compare with `timingSafeEqual`

Details: **[docs/使用说明-接入文档.md](docs/使用说明-接入文档.md)** §6, §6.1 (Chinese).

<details>
<summary><strong>Node.js signing example</strong></summary>

```ts
import crypto from 'crypto';

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

export function buildSignature(payload: any, apiAuthToken: string) {
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
```

</details>

### Web & bot

- **Web**: show QR and countdown; poll `GET /payment/status/:orderNo`  
- **Bot**: `usdt.bot.createOrderWithQR({ bizOrderNo, baseAmount, metadata })` → `qrPngBuffer`

---

<a id="security-and-reliability"></a>

## Security & reliability

| Topic | Notes |
|-------|-------|
| Chain data | TronGrid first; **valid array (even empty) stops**; Tronscan only on failure/invalid body |
| API keys | Separate keys for TronGrid and Tronscan |
| Circuit breaker | Short backoff on upstream failures |
| Scanner | Wallet pool, config cache, slower polling when idle |
| Callbacks | Async queue after confirm (retry + DLQ) |

---

<a id="examples-and-docs"></a>

## Examples & docs

| Path | Notes |
|------|-------|
| [examples/backend/host-init.ts](examples/backend/host-init.ts) | Host init and routes |
| [examples/backend/prisma-persistence.example.ts](examples/backend/prisma-persistence.example.ts) | Prisma persistence |
| [examples/backend/payment-api-client.ts](examples/backend/payment-api-client.ts) | Create / query / cancel |
| [examples/web/create-and-poll.ts](examples/web/create-and-poll.ts) | Web polling |
| [examples/bot/create-order-with-qr.ts](examples/bot/create-order-with-qr.ts) | Bot QR order |
| [docs/使用说明-接入文档.md](docs/使用说明-接入文档.md) | Full integration (Chinese) |

---

<a id="pre-launch"></a>

## Pre-launch checklist

- [ ] ≥ 2 active receiving wallets  
- [ ] Idempotent `onOrderConfirmed`  
- [ ] Scanner and cron running and observable  
- [ ] `.env`: TronGrid, Tronscan, `apiAuthToken`  
- [ ] Status/cancel always use `orderToken`  

---

<a id="license-and-contact"></a>

## License & contact

<div align="center">

[![MIT License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Telegram @okgeceo](https://img.shields.io/badge/Custom_dev-%40okgeceo-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/okgeceo)

</div>

Copyright © 2026 ObeliskStudio. All rights reserved.

- Maintainer: `@okgeceo` (ObeliskStudio) · Studio TG: `@ObeliskStudio`  
- Email: `okgeceo@gmail.com`  
- Custom payments, bots, and web work: **`@okgeceo`**
