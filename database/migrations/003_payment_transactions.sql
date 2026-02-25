-- 003: obl_payment_transactions
CREATE TABLE IF NOT EXISTS obl_payment_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tx_hash VARCHAR(64) UNIQUE NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount VARCHAR(20) NOT NULL,
    amount_in_usdt DECIMAL(10, 4) NOT NULL,
    block_number BIGINT NOT NULL,
    block_timestamp BIGINT NOT NULL,
    order_id BIGINT NULL,
    order_no VARCHAR(32) NULL,
    is_matched BOOLEAN DEFAULT FALSE,
    matched_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES obl_payment_orders(id),
    INDEX idx_tx_hash (tx_hash),
    INDEX idx_to_address (to_address),
    INDEX idx_order_id (order_id),
    INDEX idx_is_matched (is_matched),
    INDEX idx_block_number (block_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
