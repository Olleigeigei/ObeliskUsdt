-- 001: obl_payment_wallets
CREATE TABLE IF NOT EXISTS obl_payment_wallets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,
    total_orders INT DEFAULT 0,
    total_amount DECIMAL(20, 6) DEFAULT 0.000000,
    last_used_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active_priority (is_active, priority),
    INDEX idx_last_used (last_used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
