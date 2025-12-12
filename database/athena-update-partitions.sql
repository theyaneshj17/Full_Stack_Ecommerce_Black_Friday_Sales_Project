

-- 1. Create external table for incremental orders (if not exists)
CREATE EXTERNAL TABLE IF NOT EXISTS blackfriday_db.current_orders (
  `Order Date` TIMESTAMP,
  `Purchase Price Per Unit` DECIMAL(10,2),
  `Quantity` DECIMAL(10,2),
  `Shipping Address State` STRING,
  `Category` STRING,
  `ASIN` STRING,
  `Survey ResponseID` STRING,
  order_id INT,
  order_number STRING,
  status STRING,
  payment_status STRING,
  shipping_city STRING,
  shipping_country STRING,
  total_amount DECIMAL(10,2),
  etl_timestamp TIMESTAMP,
  data_source STRING,
  order_date DATE,
  week INT,
  quarter INT,
  day INT,
  is_black_friday_week INT,
  revenue DECIMAL(10,2)
)
PARTITIONED BY (
  year INT,
  month INT
)
STORED AS PARQUET
LOCATION 's3://ecommerce-eccproject/processed-data/incremental-orders/';

-- 2. Discover new partitions from incremental ETL
MSCK REPAIR TABLE blackfriday_db.current_orders;

-- 3. Verify new data loaded
SELECT
  year,
  month,
  COUNT(*) as order_count,
  SUM(revenue) as total_revenue,
  COUNT(DISTINCT order_id) as unique_orders,
  COUNT(DISTINCT `Survey ResponseID`) as unique_customers,
  MIN(order_date) as earliest_order,
  MAX(order_date) as latest_order
FROM blackfriday_db.current_orders
GROUP BY year, month
ORDER BY year DESC, month DESC
LIMIT 12;

-- 4. Create unified view: Historical + Current
CREATE OR REPLACE VIEW blackfriday_db.all_orders AS
-- Historical orders from CSV (2018-2022)
SELECT
  `Order Date`,
  `Purchase Price Per Unit`,
  `Quantity`,
  `Shipping Address State`,
  `Category`,
  `ASIN`,
  `Survey ResponseID`,
  CAST(YEAR(`Order Date`) AS INT) as year,
  CAST(MONTH(`Order Date`) AS INT) as month,
  CAST(DAY(`Order Date`) AS INT) as day,
  `Purchase Price Per Unit` * `Quantity` as revenue,
  'HISTORICAL_CSV' as data_source
FROM blackfriday_db.amazon_purchases

UNION ALL

-- Current orders from PostgreSQL (2025+)
SELECT
  `Order Date`,
  `Purchase Price Per Unit`,
  `Quantity`,
  `Shipping Address State`,
  'CURRENT_ORDERS' as Category,
  `ASIN`,
  `Survey ResponseID`,
  year,
  month,
  day,
  revenue,
  'CURRENT_OLTP' as data_source
FROM blackfriday_db.current_orders;

-- 5. Test unified view
SELECT
  data_source,
  year,
  COUNT(*) as order_count,
  SUM(revenue) as total_revenue,
  COUNT(DISTINCT `Survey ResponseID`) as unique_customers
FROM blackfriday_db.all_orders
GROUP BY data_source, year
ORDER BY year DESC, data_source;
