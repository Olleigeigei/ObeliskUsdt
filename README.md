# ObeliskUSDT

[![npm version](https://img.shields.io/npm/v/%40obeliskstudio%2Fobelisk-usdt?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/@obeliskstudio/obelisk-usdt)
[![Business Contact](https://img.shields.io/badge/Business-Telegram%20%40Mhuai8-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/mhuai8)
[![Studio Channel](https://img.shields.io/badge/Studio-Telegram%20%40ObeliskStudio-1D9BF0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/ObeliskStudio)

> 需要定制或开发支付业务，联系 Telegram：`@Mhuai8`（ObeliskStudio）

`ObeliskUSDT` 是一个专注 USDT-TRC20 的支付收款模块。  
面向开发者提供可快速接入的 USDT 收款能力，支持网站与机器人双端场景。

模块定位很明确：只负责支付链路（下单、收款、链上确认、回调），不侵入宿主业务系统（商品、订单履约、会员发放等）。

> 私有化部署，资金直达你的钱包。  
> 目标：让团队“少改代码、快速上线”完成 USDT 收款。

## 项目定位

- 核心目标：低改造、快接入、可扩展
- 适用对象：机器人项目、网站项目、SaaS、内容订阅、工具类付费功能
- 设计原则：支付模块独立，宿主业务解耦，避免后续维护互相牵连

## 为什么选择 ObeliskUSDT

- API 优先：通过 HTTP 路由快速接入，不绑定你的业务框架
- 自托管可控：部署在你自己的服务环境，数据与资金链路可审计
- 全流程闭环：下单、二维码、扫链、确认、回调一体化
- 双端复用：网页和机器人共用一套支付核心逻辑
- 对账友好：支持 `bizOrderNo` 透传，方便和宿主业务单关联

## 特性

- 支持网页与机器人两种支付入口
- 创建订单、生成二维码、链上扫描、确认回调全流程
- 交易哈希去重，避免重复入账
- 订单归属校验，用户仅可查询/取消自己的订单
- 支持宿主业务订单号透传：`bizOrderNo`
- 核心数据表统一 `obl_` 前缀，避免与宿主冲突

## 适用场景

- 你已有业务系统，只缺一个可落地的 USDT 收款能力
- 你希望机器人和网页共用同一套支付后端
- 你需要区分“业务订单号”和“支付订单号”，便于对账与审计
- 你希望后续可按项目扩展，不被单体支付逻辑绑死

## 边界职责（非常重要）

- 本模块负责：
  - 生成支付订单与收款金额
  - 分配收款钱包并返回支付二维码
  - 扫链确认交易并更新支付状态
  - 触发 `onOrderConfirmed` 回调
- 宿主项目负责：
  - 商品、定价、库存、会员时长等业务规则
  - 权益发放（必须幂等）
  - 用户系统与权限体系
  - 财务对账策略与内部报表

## 依赖要求

- Node.js 18+
- Sequelize（推荐，模块运行依赖；宿主可继续使用 TypeORM）
- Redis
- TronGrid / TronScan API Key

## 与同类网关的定位差异

- 我们不是通用商城系统，而是“可嵌入的支付能力模块”
- 我们不接管你的商品与履约逻辑，只处理支付本身
- 我们强调“稳定可维护”与“可复制接入”

## 安装与获取

### npm 安装（推荐）

```bash
npm i @obeliskstudio/obelisk-usdt
```

### 在线使用（生产推荐）

你可以直接在宿主项目通过 npm 在线拉取并使用，不需要 clone 本仓库：

```bash
npm i @obeliskstudio/obelisk-usdt@latest
```

安装后可用以下命令确认版本：

```bash
npm ls @obeliskstudio/obelisk-usdt
```

包地址：

- `https://www.npmjs.com/package/@obeliskstudio/obelisk-usdt`

## 5 分钟接入清单

1. 准备数据库并执行迁移脚本（`database/migrations`）。
2. 在宿主项目中初始化 `initObeliskUSDT(...)`。
3. 挂载 `paymentRouter` 与 `adminRouter`。
4. 配置并启动扫描器：`startScanner()`。
5. 实现 `onOrderConfirmed` 幂等发放逻辑。
6. 管理端先添加收款钱包，再开放支付入口。

## 示例目录（当前状态）

仓库提供与当前接口契约一致的最小示例：

- `examples/backend/host-init.ts`：宿主后端初始化与路由挂载
- `examples/backend/payment-api-client.ts`：服务端创建/查询/取消支付订单
- `examples/web/create-and-poll.ts`：网页端创建订单并轮询支付状态
- `examples/bot/create-order-with-qr.ts`：机器人创建订单并发送二维码
- `examples/README.md`：示例使用说明

示例按当前字段与路由编写，可直接作为接入参考。

## 快速接入

```ts
import { initObeliskUSDT } from '@obeliskstudio/obelisk-usdt';

const usdt = initObeliskUSDT({
  sequelize,
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
    // 宿主发放逻辑（必须幂等）
    await benefitService.grantByOrderNo(order.orderNo);
  },
});

app.use('/api', usdt.paymentRouter);
app.use('/api', usdt.adminRouter);

await usdt.startScanner();
usdt.registerScheduledTasks(cron);
```

## 完整支付流程（宿主视角）

1. 宿主先创建业务订单，得到 `bizOrderNo`。
2. 调用 `POST /payment/create` 创建支付订单，返回 `orderNo`、金额、钱包地址、二维码。
3. 用户转账后，扫描器监听链上交易并匹配订单。
4. 状态按 `pending -> paid -> confirmed -> completed` 推进。
5. 到达确认阈值后触发 `onOrderConfirmed`。
6. 宿主在回调里做幂等发放，并记录发放日志。

## 支付接口

用户接口：

- `POST /payment/create`
- `GET /payment/status/:orderNo`
- `POST /payment/cancel/:orderNo`

管理接口：

- `/admin/payment/wallets/*`
- `/admin/payment/orders/*`
- `/admin/payment/network*`

## 创建订单参数

```json
{
  "bizOrderNo": "HOST-ORDER-10001",
  "baseAmount": "99.00",
  "ts": 1700000000,
  "nonce": "e1b4f0f3b7d24e62a3d6c9f78b7a4b12",
  "metadata": { "biz": "obeliskcard", "plan": "vip_year" },
  "signature": "请看下方签名算法"
}
```

字段说明：

- `bizOrderNo`：必填，宿主业务订单号（用于对账与幂等发放）
- `baseAmount`：必填，支付基准金额（> 0，最多 2 位小数，建议用字符串传）
- `ts`：必填，签名时间戳（支持秒或毫秒）
- `nonce`：必填，签名随机串（建议 16-32 字节 hex）
- `metadata`：可选，宿主自定义字段（用于对账与回调发放）
- `signature`：必填，HMAC-SHA256 签名

说明：

- `POST /payment/create` 会返回 `orderToken`。
- `bizOrderNo` 幂等：同一 `bizOrderNo` 在“未过期 + 状态仍在支付中”时重复调用创建接口，会返回同一笔订单，不会重复创建与重复占用金额。
- 查询/取消订单时，需要带上 `orderToken`：
  - Header：`x-obl-order-token: <orderToken>`
  - 或 Query：`?token=<orderToken>`

## 签名算法（HMAC-SHA256）

`POST /payment/create` 默认要求签名，防止创建接口被刷单与参数被篡改。

同时启用 `ts + nonce` 防重放：

- `ts` 超出允许时间窗口会拒绝（默认 300 秒，可通过 `apiSignMaxSkewSeconds` 调整）
- `nonce` 会写入 Redis（`SET NX EX`），同一个 nonce 只能用一次

签名步骤：

1. 从请求体中取这些字段参与签名（字段不存在或为空字符串则跳过）：

`bizOrderNo`, `baseAmount`, `ts`, `nonce`, `metadata`

2. 将参与签名字段按 key 的 ASCII 字典序排序，拼成 `key=value&key=value` 的字符串。
3. value 会做 `encodeURIComponent`，其中 `metadata` 会先做稳定 JSON 序列化。
4. 使用 `apiAuthToken` 作为密钥，对拼接后的字符串做 HMAC-SHA256，输出 hex 小写，作为 `signature`。
签名示例（Node.js）：

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

## 网页接入建议

- 前端创建订单后展示二维码和倒计时
- 轮询 `GET /payment/status/:orderNo` 刷新状态
- 超时后提供“重新下单”与“联系客服”入口
- 支付成功页展示 `orderNo` 与 `bizOrderNo` 便于排查

## 机器人接入示例

```ts
const result = await usdt.bot.createOrderWithQR({
  bizOrderNo: 'HOST-ORDER-10001',
  baseAmount: '99.00',
  metadata: { scene: 'bot' },
});

await bot.sendPhoto(chatId, result.qrPngBuffer, {
  caption: `订单号: ${result.orderNo}\n金额: ${result.actualAmount} USDT\n地址: ${result.walletAddress}`,
});
```

## 上线前检查清单

- 已添加至少 2 个可用收款钱包（避免单点故障）
- `onOrderConfirmed` 已做幂等保护（防重复发放）
- 扫描器、任务调度已启动并可观测
- `.env` 已配置 API Key，代码中无硬编码密钥
- 对外查询/取消订单时，`orderToken` 必须作为校验凭证

## 安全基线

- 查询/取消接口必须校验订单归属
- `onOrderConfirmed` 发放逻辑必须幂等
- 密钥必须使用环境变量，禁止硬编码

## 数据表

- `obl_payment_wallets`
- `obl_payment_orders`
- `obl_payment_transactions`

## 订单状态流转

`pending -> paid -> confirmed -> completed`

## 使用说明

- 详细接入文档：`docs/使用说明-接入文档.md`
- 建议先看“用户使用流程（含加钱包）”章节再上线

## 版权与联系

- Copyright © 2026 ObeliskStudio. All rights reserved.
- 维护者：`@Mhuai8`（ObeliskStudio）
- 作者邮箱：`aniwaawa@gmail.com` / `mhuai8@outlook.com`
- 工作室 Telegram：`@ObeliskStudio`
- 工作室业务：承接定制开发、支付系统、机器人、网站与各类技术外包合作
- 业务合作：需要定制或开发，联系 `@Mhuai8`
