-- 004: 为订单匹配查询补充复合索引
ALTER TABLE obl_payment_orders
ADD INDEX idx_match_lookup (status, wallet_address, actual_amount, expires_at);
