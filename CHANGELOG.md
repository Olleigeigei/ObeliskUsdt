# Changelog

## [0.2.1] - 2026-07-07

### 新增

- 数据库迁移按方言分目录：`database/migrations/mysql/`、`postgres/`、`sqlite/`。
- `runObeliskUSDTMigrations` 根据 `sequelize.getDialect()` 自动选择迁移目录与迁移记录表 DDL。
- PostgreSQL / SQLite 幂等错误码识别（如 `42P07`、`42701`、`23505`）。

### 变更

- `PaymentOrder.status` 改为 `STRING(32)`，与 PostgreSQL 迁移 `VARCHAR+CHECK` 对齐。
- 补全 `scripts/release-pack.sh` 发布打包脚本。

### 迁移说明

- 从 0.2.0 升级：无需改宿主代码；若此前在 PostgreSQL 上跑失败，请删除不完整的 `obl_*` 表后重启 payment 服务让其重新迁移。

## [Unreleased]

## [0.2.0] - 2026-04-15

### 新增

- `ObeliskPersistence` 数据访问抽象与 `createSequelizeObeliskPersistence`，`initObeliskUSDT` 支持 `sequelize` 或 `persistence` 二选一接入。
- 示例：`examples/backend/prisma-persistence.example.ts` 与 `examples/backend/prisma.schema.example.prisma`（Prisma 接入骨架）。

### 变更 / 迁移说明

- `runObeliskUSDTMigrations` 支持 `query` 通用 SQL 执行函数，与 `sequelize` 二选一。
- 使用自定义 `persistence` 时，`initObeliskUSDT` 返回的 `models` 可能为 `undefined`（仅 `sequelize` 初始化时提供模型类）。
- 升级：若仅使用 Sequelize，仍传入 `sequelize` 即可，行为与 0.1.x 一致；若改用自定义 `persistence`，需实现 `ObeliskPersistence` 并自行跑迁移。

## [0.1.2] - 2026-02-24

- 新增内置迁移执行器 `runObeliskUSDTMigrations`，支持迁移记录表与幂等跳过。
- 新增 `004_order_match_lookup_index.sql`，为订单匹配补充复合索引。
- 扫描器性能优化：钱包扫描并发池、配置短缓存、动态扫描间隔、交易区块信息短缓存。
- 扫描器稳定性优化：确认回调异步队列化（重试与死信）与熔断指标对外暴露。
