-- 002: obl_payment_orders
CREATE TABLE IF NOT EXISTS obl_payment_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(32) UNIQUE NOT NULL,
    biz_order_no VARCHAR(64) NOT NULL,
    base_amount DECIMAL(10, 2) NOT NULL,
    actual_amount DECIMAL(10, 4) NOT NULL,
    amount_in_sun VARCHAR(20) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    wallet_id INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    tx_hash VARCHAR(64) NULL,
    block_number INTEGER NULL,
    confirmations INT DEFAULT 0,
    required_confirmations INT DEFAULT 6,
    expires_at DATETIME NOT NULL,
    paid_at DATETIME NULL,
    confirmed_at DATETIME NULL,
    completed_at DATETIME NULL,
    error_message TEXT NULL,
    metadata TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_id) REFERENCES obl_payment_wallets(id),
    CHECK (status IN ('pending', 'paid', 'confirmed', 'completed', 'expired', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_order_no ON obl_payment_orders (order_no);
CREATE INDEX IF NOT EXISTS idx_biz_order_no ON obl_payment_orders (biz_order_no);
CREATE INDEX IF NOT EXISTS idx_status ON obl_payment_orders (status);
CREATE INDEX IF NOT EXISTS idx_wallet_amount ON obl_payment_orders (wallet_address, actual_amount);
CREATE INDEX IF NOT EXISTS idx_tx_hash ON obl_payment_orders (tx_hash);
CREATE INDEX IF NOT EXISTS idx_expires_at ON obl_payment_orders (expires_at);
CREATE INDEX IF NOT EXISTS idx_created_at ON obl_payment_orders (created_at);
