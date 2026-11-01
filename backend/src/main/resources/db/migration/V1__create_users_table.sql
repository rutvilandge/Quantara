-- =====================================================
-- QUANTARA — DATABASE MIGRATION V1
-- CREATE USERS TABLE
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    full_name VARCHAR(100) NOT NULL,

    email VARCHAR(255) NOT NULL,

    password_hash VARCHAR(255) NOT NULL,

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_email_not_blank
        CHECK (LENGTH(TRIM(email)) > 0),

    CONSTRAINT users_full_name_not_blank
        CHECK (LENGTH(TRIM(full_name)) > 0)
);

-- =====================================================
-- UNIQUE EMAIL INDEX
-- =====================================================

CREATE UNIQUE INDEX idx_users_email_unique
ON users (LOWER(email));

-- =====================================================
-- CREATED AT INDEX
-- =====================================================

CREATE INDEX idx_users_created_at
ON users (created_at DESC);