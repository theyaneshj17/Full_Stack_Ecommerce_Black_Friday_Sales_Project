#!/bin/bash

# Get cluster ID from config
CLUSTER_ID=$(grep "Cluster ID:" emr-config.txt | cut -d':' -f2 | tr -d ' ')
REGION="us-east-1"
BUCKET="ecommerce-eccproject"

echo "Submitting PySpark job to EMR cluster: ${CLUSTER_ID}"

aws emr add-steps \
    --cluster-id ${CLUSTER_ID} \
    --steps Type=Spark,Name="Black Friday Analysis",ActionOnFailure=CONTINUE,Args=[--deploy-mode,cluster,--master,yarn,s3://${BUCKET}/scripts/black-friday-analysis.py] \
    --region ${REGION}

