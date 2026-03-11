# Changelog

## [Unreleased]

## [0.1.2] - 2026-02-24

- 新增内置迁移执行器 `runObeliskUSDTMigrations`，支持迁移记录表与幂等跳过。
- 新增 `004_order_match_lookup_index.sql`，为订单匹配补充复合索引。
- 扫描器性能优化：钱包扫描并发池、配置短缓存、动态扫描间隔、交易区块信息短缓存。
- 扫描器稳定性优化：确认回调异步队列化（重试与死信）与熔断指标对外暴露。
