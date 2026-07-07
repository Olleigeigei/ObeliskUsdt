-- 003: obl_payment_transactions
CREATE TABLE IF NOT EXISTS obl_payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_hash VARCHAR(64) UNIQUE NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount VARCHAR(20) NOT NULL,
    amount_in_usdt DECIMAL(10, 4) NOT NULL,
    block_number INTEGER NOT NULL,
    block_timestamp INTEGER NOT NULL,
    order_id INTEGER NULL,
    order_no VARCHAR(32) NULL,
    is_matched BOOLEAN DEFAULT 0,
    matched_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES obl_payment_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_tx_hash ON obl_payment_transactions (tx_hash);
CREATE INDEX IF NOT EXISTS idx_to_address ON obl_payment_transactions (to_address);
CREATE INDEX IF NOT EXISTS idx_order_id ON obl_payment_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_is_matched ON obl_payment_transactions (is_matched);
CREATE INDEX IF NOT EXISTS idx_block_number ON obl_payment_transactions (block_number);
