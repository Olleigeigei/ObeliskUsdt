-- 003: obl_payment_transactions
CREATE TABLE IF NOT EXISTS obl_payment_transactions (
    id BIGSERIAL PRIMARY KEY,
    tx_hash VARCHAR(64) UNIQUE NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount VARCHAR(20) NOT NULL,
    amount_in_usdt DECIMAL(10, 4) NOT NULL,
    block_number BIGINT NOT NULL,
    block_timestamp BIGINT NOT NULL,
    order_id BIGINT NULL REFERENCES obl_payment_orders(id),
    order_no VARCHAR(32) NULL,
    is_matched BOOLEAN DEFAULT FALSE,
    matched_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tx_hash ON obl_payment_transactions (tx_hash);
CREATE INDEX IF NOT EXISTS idx_to_address ON obl_payment_transactions (to_address);
CREATE INDEX IF NOT EXISTS idx_order_id ON obl_payment_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_is_matched ON obl_payment_transactions (is_matched);
CREATE INDEX IF NOT EXISTS idx_block_number ON obl_payment_transactions (block_number);
