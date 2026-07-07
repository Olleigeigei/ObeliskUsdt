-- 004: 为订单匹配查询补充复合索引
CREATE INDEX IF NOT EXISTS idx_match_lookup ON obl_payment_orders (status, wallet_address, actual_amount, expires_at);
