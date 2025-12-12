"""
Incremental OLTP to OLAP ETL - Sync New Orders 
Reads new orders from PostgreSQL RDS and appends to S3 for OLAP analytics


"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from datetime import datetime, timedelta

# Initialize Spark
spark = SparkSession.builder \
    .appName("Incremental-Orders-ETL") \
    .config("spark.jars.packages", "org.postgresql:postgresql:42.5.0") \
    .config("spark.sql.adaptive.enabled", "true") \
    .config("spark.sql.shuffle.partitions", "200") \
    .getOrCreate()


# RDS PostgreSQL (OLTP)
RDS_HOST = "ecommerce-postgres.c05iomkceu1o.us-east-1.rds.amazonaws.com"
RDS_PORT = "5432"
RDS_DB = "ecommerce_orders"
RDS_USER = "postgres"
RDS_PASSWORD = "#####"

# S3 OLAP Data Lake
BUCKET = "ecommerce-eccproject"
S3_OUTPUT = f"s3://{BUCKET}/processed-data/incremental-orders/"
S3_CHECKPOINT = f"s3://{BUCKET}/processed-data/etl-checkpoint/"

# Date range to process 
END_DATE = datetime.now().date()
START_DATE = (datetime.now() - timedelta(days=1)).date()


print("CChecking last ETL checkpoint...")

try:
    checkpoint_df = spark.read.parquet(S3_CHECKPOINT)
    last_synced_order_id = checkpoint_df.agg(max("last_order_id")).collect()[0][0]
    last_synced_date = checkpoint_df.agg(max("last_synced_date")).collect()[0][0]
    print(f"Last checkpoint: Order ID {last_synced_order_id}, Date {last_synced_date}")
except:
    last_synced_order_id = 0
    last_synced_date = "1900-01-01"
    print(f"No checkpoint found. Processing all historical orders...")



print("\nExtracting new orders from PostgreSQL RDS...")

jdbc_url = f"jdbc:postgresql://{RDS_HOST}:{RDS_PORT}/{RDS_DB}"


orders_query = f"""
(SELECT
    o.order_id,
    o.user_id,
    o.order_number,
    o.status,
    o.total_amount,
    o.currency,
    o.shipping_name,
    o.shipping_email,
    o.shipping_address_line1,
    o.shipping_address_line2,
    o.shipping_city,
    o.shipping_state,
    o.shipping_postal_code,
    o.shipping_country,
    o.shipping_phone,
    o.payment_method,
    o.payment_status,
    o.payment_transaction_id,
    o.created_at,
    o.updated_at
FROM orders o
WHERE o.order_id > {last_synced_order_id}
  OR DATE(o.created_at) >= '{START_DATE}'
) AS new_orders
"""

orders_df = spark.read \
    .format("jdbc") \
    .option("url", jdbc_url) \
    .option("dbtable", orders_query) \
    .option("user", RDS_USER) \
    .option("password", RDS_PASSWORD) \
    .option("driver", "org.postgresql.Driver") \
    .option("fetchsize", "1000") \
    .load()

order_count = orders_df.count()
print(f"✓ Extracted {order_count:,} new orders")

if order_count == 0:
    print(" No new orders to process. Exiting.")
    spark.stop()
    exit(0)

print("\n Extracting order items...")

order_items_query = f"""
(SELECT
    oi.order_item_id,
    oi.order_id,
    oi.asin,
    oi.title,
    oi.price,
    oi.quantity,
    oi.subtotal,
    oi.image_url,
    oi.created_at
FROM order_items oi
WHERE oi.order_id > {last_synced_order_id}
   OR DATE(oi.created_at) >= '{START_DATE}'
) AS new_order_items
"""

order_items_df = spark.read \
    .format("jdbc") \
    .option("url", jdbc_url) \
    .option("dbtable", order_items_query) \
    .option("user", RDS_USER) \
    .option("password", RDS_PASSWORD) \
    .option("driver", "org.postgresql.Driver") \
    .option("fetchsize", "1000") \
    .load()

item_count = order_items_df.count()
print(f" Extracted {item_count:,} order items")



print("\nTransforming to OLAP-compatible format...")

# Join orders with items
combined_df = orders_df.join(
    order_items_df.select("order_id", "asin", "title", "price", "quantity", "subtotal", "image_url"),
    "order_id",
    "inner"
)

olap_format_df = combined_df.select(
    
    col("created_at").alias("Order Date"),
    col("price").alias("Purchase Price Per Unit"),
    col("quantity").alias("Quantity"),
    coalesce(col("shipping_state"), lit("UNKNOWN")).alias("Shipping Address State"), 
    lit("CURRENT_ORDERS").alias("Category"), 
    col("asin").alias("ASIN"),
    col("user_id").cast("string").alias("Survey ResponseID"),

   
    col("order_id"),
    col("order_number"),
    col("status"),
    col("payment_status"),
    coalesce(col("shipping_city"), lit("UNKNOWN")).alias("shipping_city"),
    coalesce(col("shipping_country"), lit("US")).alias("shipping_country"),
    col("shipping_address_line1"),
    col("shipping_postal_code"),
    col("total_amount"),
    col("title").alias("product_title"),
    col("image_url"),

    # ETL metadata
    lit(current_timestamp()).alias("etl_timestamp"),
    lit("OLTP_SYNC").alias("data_source")
)

olap_format_df = olap_format_df \
    .withColumn("order_date", to_date(col("Order Date"))) \
    .withColumn("year", year("order_date")) \
    .withColumn("month", month("order_date")) \
    .withColumn("day", dayofmonth("order_date")) \
    .withColumn("week", weekofyear("order_date")) \
    .withColumn("quarter", quarter("order_date")) \
    .withColumn("day_of_week", dayofweek("order_date")) \
    .withColumn("is_weekend", when(col("day_of_week").isin([1, 7]), 1).otherwise(0)) \
    .withColumn("is_black_friday_week",
        when((col("month") == 11) & (col("day").between(22, 28)), 1).otherwise(0)) \
    .withColumn("revenue", col("Purchase Price Per Unit") * col("Quantity"))

print(f" Transformed {olap_format_df.count():,} records")


# Partition by year and month for efficient Athena queries
olap_format_df.write \
    .mode("append") \
    .partitionBy("year", "month") \
    .option("compression", "snappy") \
    .parquet(S3_OUTPUT)

print(f" Data written to {S3_OUTPUT}")


print("\n Updating ETL checkpoint...")

# Get max order ID and date from this run
max_order_id = orders_df.agg(max("order_id")).collect()[0][0]
max_order_date = orders_df.agg(max("created_at")).collect()[0][0]

checkpoint_data = [(max_order_id, str(max_order_date), str(datetime.now()))]
new_checkpoint_df = spark.createDataFrame(
    checkpoint_data,
    ["last_order_id", "last_synced_date", "etl_run_time"]
)

new_checkpoint_df.write \
    .mode("overwrite") \
    .parquet(S3_CHECKPOINT)

print(f"Checkpoint updated: Order ID {max_order_id}, Date {max_order_date}")


spark.stop()