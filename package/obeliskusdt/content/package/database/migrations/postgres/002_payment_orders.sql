-- 002: obl_payment_orders
CREATE TABLE IF NOT EXISTS obl_payment_orders (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(32) UNIQUE NOT NULL,
    biz_order_no VARCHAR(64) NOT NULL,
    base_amount DECIMAL(10, 2) NOT NULL,
    actual_amount DECIMAL(10, 4) NOT NULL,
    amount_in_sun VARCHAR(20) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    wallet_id BIGINT NOT NULL REFERENCES obl_payment_wallets(id),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    tx_hash VARCHAR(64) NULL,
    block_number BIGINT NULL,
    confirmations INT DEFAULT 0,
    required_confirmations INT DEFAULT 6,
    expires_at TIMESTAMP NOT NULL,
    paid_at TIMESTAMP NULL,
    confirmed_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    error_message TEXT NULL,
    metadata JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_obl_payment_orders_status CHECK (
        status IN ('pending', 'paid', 'confirmed', 'completed', 'expired', 'failed', 'cancelled')
    )
);

CREATE INDEX IF NOT EXISTS idx_order_no ON obl_payment_orders (order_no);
CREATE INDEX IF NOT EXISTS idx_biz_order_no ON obl_payment_orders (biz_order_no);
CREATE INDEX IF NOT EXISTS idx_status ON obl_payment_orders (status);
CREATE INDEX IF NOT EXISTS idx_wallet_amount ON obl_payment_orders (wallet_address, actual_amount);
CREATE INDEX IF NOT EXISTS idx_tx_hash ON obl_payment_orders (tx_hash);
CREATE INDEX IF NOT EXISTS idx_expires_at ON obl_payment_orders (expires_at);
CREATE INDEX IF NOT EXISTS idx_created_at ON obl_payment_orders (created_at);

-- 兼容 Sequelize create_all 旧表：补齐可能缺失的列
ALTER TABLE obl_payment_orders ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(64);
ALTER TABLE obl_payment_orders ADD COLUMN IF NOT EXISTS block_number BIGINT;
ALTER TABLE obl_payment_orders ADD COLUMN IF NOT EXISTS confirmations INT DEFAULT 0;
ALTER TABLE obl_payment_orders ADD COLUMN IF NOT EXISTS required_confirmations INT DEFAULT 6;
ALTER TABLE obl_payment_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE obl_payment_orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;
ALTER TABLE obl_payment_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE obl_payment_orders ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE obl_payment_orders ADD COLUMN IF NOT EXISTS metadata JSONB;
