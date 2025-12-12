#!/bin/bash



set -e

# Configuration
DB_HOST="${DB_HOST:-ecommerce-postgres.c05iomkceu1o.us-east-1.rds.amazonaws.com}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-xxxxxxxxx}"
S3_BUCKET="${S3_BUCKET:-ecommerce-eccproject}"
CSV_FILE="amazon-purchases.csv"


echo "Step 1: Downloading CSV from S3..."


TEMP_DIR="./temp-seed-data"
mkdir -p "$TEMP_DIR"

# Download using Docker with AWS CLI
docker run --rm \
    -v "$(pwd)/$TEMP_DIR:/data" \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    -e AWS_DEFAULT_REGION=us-east-1 \
    amazon/aws-cli s3 cp \
    "s3://${S3_BUCKET}/raw-data/${CSV_FILE}" \
    "/data/${CSV_FILE}" || \
docker run --rm \
    -v "$(pwd)/$TEMP_DIR:/data" \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    -e AWS_DEFAULT_REGION=us-east-1 \
    amazon/aws-cli s3 cp \
    "s3://${S3_BUCKET}/${CSV_FILE}" \
    "/data/${CSV_FILE}"


echo "Step 2: Loading CSV into PostgreSQL..."

# Run PostgreSQL container with CSV mounted
docker run --rm -i \
    -v "$(pwd)/$TEMP_DIR:/data" \
    -e PGPASSWORD="$DB_PASSWORD" \
    postgres:15 bash -c "
        # Load CSV into staging table
        psql -h $DB_HOST -U $DB_USER -d ecommerce_products << 'EOSQL'

-- Clear staging table
TRUNCATE TABLE amazon_raw;

-- Load CSV (using COPY from stdin since file is local to container)
\copy amazon_raw(order_date,price,quantity,state,title,asin,category,survey_id) FROM '/data/$CSV_FILE' DELIMITER ',' CSV HEADER

-- Show count
SELECT COUNT(*) || ' raw records loaded' AS status FROM amazon_raw;

-- Transform into products table
TRUNCATE TABLE products RESTART IDENTITY CASCADE;

INSERT INTO products (asin, title, category_id, base_price, image_url, description, is_available)
SELECT DISTINCT ON (asin)
  asin,
  COALESCE(NULLIF(TRIM(title), ''), 'Product ' || asin) AS title,
  CASE
    WHEN NULLIF(TRIM(category), '') IS NOT NULL THEN category
    ELSE 'UNKNOWN'
  END AS category_id,
  COALESCE(price, 0) AS base_price,
  CONCAT('https://picsum.photos/seed/', asin, '/600/600') AS image_url,
  CONCAT('Top selling product in category ', COALESCE(NULLIF(category,''), 'General')) AS description,
  true AS is_available
FROM amazon_raw
WHERE asin IS NOT NULL AND TRIM(asin) <> ''
ORDER BY asin, order_date DESC;

-- Show summary
SELECT COUNT(*) || ' products created' AS status FROM products;

SELECT
  'Category breakdown:' AS summary;

SELECT
  category_id,
  COUNT(*) AS product_count,
  ROUND(AVG(base_price), 2) AS avg_price,
  MIN(base_price) AS min_price,
  MAX(base_price) AS max_price
FROM products
GROUP BY category_id
ORDER BY product_count DESC
LIMIT 15;

EOSQL
    "

echo ""
echo "Step 3: Verifying products loaded..."

docker run --rm \
    -e PGPASSWORD="$DB_PASSWORD" \
    postgres:15 \
    psql -h "$DB_HOST" -U "$DB_USER" -d ecommerce_products -c \
    "SELECT
        COUNT(*) as total_products,
        COUNT(DISTINCT category_id) as categories,
        ROUND(AVG(base_price), 2) as avg_price,
        MIN(created_at) as first_created,
        MAX(created_at) as last_created
     FROM products
     WHERE is_available = true;"

