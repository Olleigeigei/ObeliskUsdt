-- 001: obl_payment_wallets
CREATE TABLE IF NOT EXISTS obl_payment_wallets (
    id BIGSERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,
    total_orders INT DEFAULT 0,
    total_amount DECIMAL(20, 6) DEFAULT 0.000000,
    last_used_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_active_priority ON obl_payment_wallets (is_active, priority);
CREATE INDEX IF NOT EXISTS idx_last_used ON obl_payment_wallets (last_used_at);
