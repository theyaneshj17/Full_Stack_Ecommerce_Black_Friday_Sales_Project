from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.window import Window

# Initialize Spark
spark = SparkSession.builder \
    .appName("Complete-BlackFriday-Analysis") \
    .config("spark.sql.adaptive.enabled", "true") \
    .getOrCreate()

# Configuration
BUCKET = "ecommerce-eccproject"



print("\nLoading data from S3...")
df = spark.read.csv(f"s3://{BUCKET}/amazon-purchases.csv", header=True, inferSchema=True)

# Basic counts
total_rows = df.count()
print(f"Data loaded successfully: {total_rows:,} records")

# Parse dates and add dimensions
print("\n[Step 1.2] Processing dates and creating dimensions...")
df = df.withColumn("order_date", to_date(col("Order Date")))
df = df.withColumn("year", year("order_date"))
df = df.withColumn("month", month("order_date"))
df = df.withColumn("day", dayofmonth("order_date"))
df = df.withColumn("week", weekofyear("order_date"))
df = df.withColumn("quarter", quarter("order_date"))

# Black Friday flag
df = df.withColumn("is_black_friday_week",
    when((col("month") == 11) & (col("day").between(22, 28)), 1).otherwise(0))

# Calculate revenue
df = df.withColumn("revenue", col("Purchase Price Per Unit") * col("Quantity"))

# Clean data
df = df.withColumn("state", 
    when(col("Shipping Address State").isNull(), "Unknown")
    .otherwise(upper(trim(col("Shipping Address State")))))

df = df.withColumn("category",
    when(col("Category").isNull(), "Unknown")
    .otherwise(col("Category")))



# Save aggregations
print("\n Creating daily aggregations...")
daily_agg = df.groupBy("year", "month", "day", "is_black_friday_week").agg(
    count("*").alias("order_count"),
    sum("Quantity").alias("total_quantity"),
    sum("revenue").alias("total_revenue"),
    avg("revenue").alias("avg_order_value"),
    countDistinct("Survey ResponseID").alias("unique_customers")
)

daily_agg.write.mode("overwrite").partitionBy("year", "month") \
    .parquet(f"s3://{BUCKET}/processed-data/daily_sales/")
print("Saved successfully: daily_sales")

print("\n Creating state aggregations...")
state_agg = df.groupBy("year", "state", "is_black_friday_week").agg(
    count("*").alias("order_count"),
    sum("Quantity").alias("total_quantity"),
    sum("revenue").alias("total_revenue"),
    countDistinct("Survey ResponseID").alias("unique_customers")
)

state_agg.write.mode("overwrite").partitionBy("year") \
    .parquet(f"s3://{BUCKET}/processed-data/state_sales/")
print("Saved successfully: state_sales")

print("\n Creating category aggregations...")
category_agg = df.groupBy("year", "category", "is_black_friday_week").agg(
    count("*").alias("order_count"),
    sum("Quantity").alias("total_quantity"),
    sum("revenue").alias("total_revenue")
)

category_agg.write.mode("overwrite").partitionBy("year") \
    .parquet(f"s3://{BUCKET}/processed-data/category_sales/")
print("Saved successfully: category_sales")

print("\nCreating multi-dimensional OLAP cube...")
olap_cube = df.groupBy(
    "year", "month", "week", "day",
    "is_black_friday_week",
    "state", "category"
).agg(
    count("*").alias("order_count"),
    sum("Quantity").alias("total_quantity"),
    sum("revenue").alias("total_revenue"),
    avg("revenue").alias("avg_order_value")
)

olap_cube.write.mode("overwrite").partitionBy("year", "month") \
    .parquet(f"s3://{BUCKET}/processed-data/olap_cube/")
print("Saved successfully: olap_cube")

spark.stop()