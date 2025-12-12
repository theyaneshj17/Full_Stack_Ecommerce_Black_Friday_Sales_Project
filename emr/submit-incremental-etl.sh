#!/bin/bash


# Submit Incremental ETL Job to EMR
# Syncs new orders from PostgreSQL to S3


set -e

REGION="us-east-1"
BUCKET="ecommerce-eccproject"
CLUSTER_ID="${1:-$(grep "Cluster ID:" emr-config.txt 2>/dev/null | cut -d':' -f2 | tr -d ' ')}"

if [ -z "$CLUSTER_ID" ]; then
    echo " Error: EMR Cluster ID not found"
    echo "Usage: $0 <cluster-id>"
    echo "Or ensure emr-config.txt exists with Cluster ID"
    exit 1
fi

# Upload script to S3 if not already there
echo "Uploading ETL script to S3..."
aws s3 cp incremental-orders-etl.py s3://${BUCKET}/scripts/

# Submit Spark job to EMR
echo "Submitting job to EMR..."

STEP_ID=$(aws emr add-steps \
    --cluster-id ${CLUSTER_ID} \
    --steps Type=Spark,Name="Incremental-OLTP-to-OLAP-Sync",ActionOnFailure=CONTINUE,Args=[--deploy-mode,cluster,--master,yarn,--jars,/usr/share/java/postgresql-jdbc.jar,s3://${BUCKET}/scripts/incremental-orders-etl.py] \
    --region ${REGION} \
    --query 'StepIds[0]' \
    --output text)

echo ""
echo "Job submitted successfully!"
echo "Step ID: ${STEP_ID}"
echo ""
echo "Monitor progress:"
echo "1. AWS Console: EMR → Clusters → ${CLUSTER_ID} → Steps"
echo "2. Command line:"
echo "   aws emr describe-step --cluster-id ${CLUSTER_ID} --step-id ${STEP_ID} --region ${REGION}"
echo ""
echo "Check logs:"
echo "   aws emr describe-step --cluster-id ${CLUSTER_ID} --step-id ${STEP_ID} --query 'Step.Status' --region ${REGION}"
echo ""
