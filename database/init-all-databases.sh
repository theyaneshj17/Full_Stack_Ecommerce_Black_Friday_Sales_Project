#!/bin/bash


set -e

# Database configuration
DB_HOST="${DB_HOST:-ecommerce-postgres.c05iomkceu1o.us-east-1.rds.amazonaws.com}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-xxxxxxxx}"
export PGPASSWORD="${DB_PASSWORD}"

echo "Step 1: Creating databases..."

psql -h $DB_HOST -U $DB_USER -d postgres << 'EOF'
-- Create databases if they don't exist
SELECT 'CREATE DATABASE ecommerce_products'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce_products')\gexec

SELECT 'CREATE DATABASE ecommerce_orders'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce_orders')\gexec

SELECT 'CREATE DATABASE ecommerce_users'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce_users')\gexec
EOF

echo " Databases created"
echo ""

# ============================
echo "Step 2: Initializing Product Service Database..."

# Create schema (without CSV import)
psql -h $DB_HOST -U $DB_USER -d ecommerce_products << 'EOF'
-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    category_id VARCHAR(50) PRIMARY KEY,
    category_name VARCHAR(255) NOT NULL,
    parent_id VARCHAR(50) REFERENCES categories(category_id),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert categories
INSERT INTO categories (category_id, category_name, description) VALUES
('ABIS_BOOK', 'Books', 'Books and literature'),
('PET_FOOD', 'Pet Food', 'Food and supplies for pets'),
('GIFT_CARD', 'Gift Cards', 'Digital and physical gift cards'),
('SHIRT', 'Shirts', 'Clothing - Shirts'),
('ELECTRONIC_CABLE', 'Electronics', 'Electronic cables and accessories'),
('HEALTH_PERSONAL_CARE', 'Health & Personal Care', 'Health and personal care products'),
('NUTRITIONAL_SUPPLEMENT', 'Nutritional Supplements', 'Vitamins and supplements'),
('MEDICATION', 'Medications', 'Prescription and over-the-counter medications'),
('PANTS', 'Pants', 'Clothing - Pants'),
('CELLULAR_PHONE_CASE', 'Phone Cases', 'Mobile phone cases and accessories')
ON CONFLICT (category_id) DO NOTHING;

-- Staging table for CSV import
CREATE TABLE IF NOT EXISTS amazon_raw (
  order_date DATE,
  price NUMERIC(10,2),
  quantity NUMERIC(10,2),
  state TEXT,
  title TEXT,
  asin TEXT,
  category TEXT,
  survey_id TEXT
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  product_id SERIAL PRIMARY KEY,
  asin TEXT UNIQUE,
  title TEXT,
  category_id TEXT,
  base_price NUMERIC(10,2),
  image_url TEXT,
  description TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_asin ON products(asin);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(is_available) WHERE is_available = true;
EOF

echo " Product Service Database initialized"
echo ""

=

echo "Step 3: Initializing Order Service Database..."

psql -h $DB_HOST -U $DB_USER -d ecommerce_orders << 'EOF'
-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Shipping information
    shipping_name VARCHAR(255) NOT NULL,
    shipping_email VARCHAR(255) NOT NULL,
    shipping_address_line1 VARCHAR(255) NOT NULL,
    shipping_address_line2 VARCHAR(255),
    shipping_city VARCHAR(100) NOT NULL,
    shipping_state VARCHAR(100),
    shipping_postal_code VARCHAR(20) NOT NULL,
    shipping_country VARCHAR(100) NOT NULL,
    shipping_phone VARCHAR(50),

    -- Payment information
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_transaction_id VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_status CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    CONSTRAINT chk_payment_status CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'))
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

    -- Product information (snapshot at time of order)
    asin VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,

    -- Image URL
    image_url TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_quantity CHECK (quantity > 0),
    CONSTRAINT chk_price CHECK (price >= 0),
    CONSTRAINT chk_subtotal CHECK (subtotal >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_asin ON order_items(asin);
EOF

echo " Order Service Database initialized"
echo ""



echo "Step 4: Initializing User Service Database..."

psql -h $DB_HOST -U $DB_USER -d ecommerce_users << 'EOF'
-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- User addresses table
CREATE TABLE IF NOT EXISTS user_addresses (
    address_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
EOF

echo " User Service Database initialized"
echo ""
