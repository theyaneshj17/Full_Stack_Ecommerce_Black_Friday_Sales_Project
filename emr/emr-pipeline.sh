#!/bin/bash


set -e

REGION="us-east-1"
ACCOUNT_ID="070238434866"
S3_BUCKET="ecommerce-eccproject"
EMR_CLUSTER_NAME="ecommerce-data-pipeline"

TEMP_DIR="./temp-emr-setup"
mkdir -p "$TEMP_DIR"



echo "Step 1: Setting up S3 bucket structure..."

aws s3api put-object --bucket ${S3_BUCKET} --key raw-data/ --region ${REGION}
aws s3api put-object --bucket ${S3_BUCKET} --key processed-data/ --region ${REGION}
aws s3api put-object --bucket ${S3_BUCKET} --key scripts/ --region ${REGION}
aws s3api put-object --bucket ${S3_BUCKET} --key logs/ --region ${REGION}
aws s3api put-object --bucket ${S3_BUCKET} --key athena-results/ --region ${REGION}

# Copy  existing data to raw-data folder
echo "Copying amazon-purchases.csv to S3..."
aws s3 cp s3://${S3_BUCKET}/amazon-purchases.csv s3://${S3_BUCKET}/raw-data/amazon-purchases.csv --region ${REGION}


echo "Step 2: Creating IAM roles for EMR..."

# EMR Service Role
cat > "${TEMP_DIR}/emr-trust-policy.json" << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "elasticmapreduce.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create EMR service role
if ! aws iam get-role --role-name EMR_DefaultRole 2>/dev/null; then
    aws iam create-role \
        --role-name EMR_DefaultRole \
        --assume-role-policy-document "file://${TEMP_DIR}/emr-trust-policy.json"
    
    aws iam attach-role-policy \
        --role-name EMR_DefaultRole \
        --policy-arn arn:aws:iam::aws:policy/service-role/AmazonElasticMapReduceRole
    
    echo " Created EMR_DefaultRole"
else
    echo " EMR_DefaultRole already exists"
fi

# EC2 Instance Profile for EMR
cat > "${TEMP_DIR}/ec2-trust-policy.json" << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create EC2 role for EMR
if ! aws iam get-role --role-name EMR_EC2_DefaultRole 2>/dev/null; then
    aws iam create-role \
        --role-name EMR_EC2_DefaultRole \
        --assume-role-policy-document "file://${TEMP_DIR}/ec2-trust-policy.json"
    
    aws iam attach-role-policy \
        --role-name EMR_EC2_DefaultRole \
        --policy-arn arn:aws:iam::aws:policy/service-role/AmazonElasticMapReduceforEC2Role
    
    echo " Created EMR_EC2_DefaultRole"
else
    echo " EMR_EC2_DefaultRole already exists"
fi

# Create instance profile
if ! aws iam get-instance-profile --instance-profile-name EMR_EC2_DefaultRole 2>/dev/null; then
    aws iam create-instance-profile \
        --instance-profile-name EMR_EC2_DefaultRole
    
    aws iam add-role-to-instance-profile \
        --instance-profile-name EMR_EC2_DefaultRole \
        --role-name EMR_EC2_DefaultRole
    
    echo " Created EMR_EC2_DefaultRole instance profile"
else
    echo " EMR_EC2_DefaultRole instance profile already exists"
fi

# Add S3 access policy to EC2 role
cat > "${TEMP_DIR}/s3-access-policy.json" << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${S3_BUCKET}",
        "arn:aws:s3:::${S3_BUCKET}/*"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
    --role-name EMR_EC2_DefaultRole \
    --policy-name S3AccessPolicy \
    --policy-document "file://${TEMP_DIR}/s3-access-policy.json"

echo " Added S3 access policy"
echo ""




echo "Step 3: Getting VPC and subnet information..."

# Get EKS cluster VPC and subnet
VPC_ID=$(aws eks describe-cluster --name ecommerce-cluster --region ${REGION} \
    --query 'cluster.resourcesVpcConfig.vpcId' --output text)

# Get public subnet for EMR
SUBNET_ID=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=${VPC_ID}" \
    --query 'Subnets[?MapPublicIpOnLaunch==`true`] | [0].SubnetId' \
    --region ${REGION} \
    --output text)

echo "VPC ID: ${VPC_ID}"
echo "Subnet ID: ${SUBNET_ID}"
echo ""



echo "Step 4: Creating EMR security groups..."

# Master security group
MASTER_SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=emr-master-sg" "Name=vpc-id,Values=${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' \
    --region ${REGION} \
    --output text 2>/dev/null)

if [ "$MASTER_SG_ID" == "None" ] || [ -z "$MASTER_SG_ID" ]; then
    MASTER_SG_ID=$(aws ec2 create-security-group \
        --group-name emr-master-sg \
        --description "Security group for EMR master node" \
        --vpc-id ${VPC_ID} \
        --region ${REGION} \
        --query 'GroupId' \
        --output text)
    echo " Created master security group"
fi

# Slave security group
SLAVE_SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=emr-slave-sg" "Name=vpc-id,Values=${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' \
    --region ${REGION} \
    --output text 2>/dev/null)

if [ "$SLAVE_SG_ID" == "None" ] || [ -z "$SLAVE_SG_ID" ]; then
    SLAVE_SG_ID=$(aws ec2 create-security-group \
        --group-name emr-slave-sg \
        --description "Security group for EMR slave nodes" \
        --vpc-id ${VPC_ID} \
        --region ${REGION} \
        --query 'GroupId' \
        --output text)
    echo " Created slave security group"
fi

echo "Master SG: ${MASTER_SG_ID}"
echo "Slave SG: ${SLAVE_SG_ID}"
echo ""

echo "Step 5: Creating EMR cluster..."


# Create cluster configuration file
cat > "${TEMP_DIR}/emr-config.json" << EOF
{
  "InstanceProfile": "EMR_EC2_DefaultRole",
  "SubnetId": "${SUBNET_ID}",
  "EmrManagedMasterSecurityGroup": "${MASTER_SG_ID}",
  "EmrManagedSlaveSecurityGroup": "${SLAVE_SG_ID}"
}
EOF

EMR_CLUSTER_ID=$(aws emr create-cluster \
    --name "${EMR_CLUSTER_NAME}" \
    --release-label emr-7.0.0 \
    --applications Name=Spark Name=Hadoop Name=Hive \
    --ec2-attributes "file://${TEMP_DIR}/emr-config.json" \
    --instance-type m5.xlarge \
    --instance-count 3 \
    --service-role EMR_DefaultRole \
    --log-uri s3://${S3_BUCKET}/logs/ \
    --region ${REGION} \
    --query 'ClusterId' \
    --output text)

echo " EMR Cluster created!"
echo "Cluster ID: ${EMR_CLUSTER_ID}"
echo ""

# Save configuration
cat > emr-config.txt << EOF
EMR Configuration
=================
Created: $(date)

Cluster ID: ${EMR_CLUSTER_ID}
Cluster Name: ${EMR_CLUSTER_NAME}
Region: ${REGION}
S3 Bucket: s3://${S3_BUCKET}

Data Locations:
- Raw Data: s3://${S3_BUCKET}/raw-data/amazon-purchases.csv
- Processed Data: s3://${S3_BUCKET}/processed-data/
- Scripts: s3://${S3_BUCKET}/scripts/
- Logs: s3://${S3_BUCKET}/logs/
- Athena Results: s3://${S3_BUCKET}/athena-results/

Useful Commands:
----------------
# Check cluster status
aws emr describe-cluster --cluster-id ${EMR_CLUSTER_ID} --region ${REGION}

# List steps
aws emr list-steps --cluster-id ${EMR_CLUSTER_ID} --region ${REGION}

# Terminate cluster (when done)
aws emr terminate-clusters --cluster-ids ${EMR_CLUSTER_ID} --region ${REGION}
EOF

echo " Configuration saved to emr-config.txt"
echo ""

# Clean up temp directory
rm -rf "$TEMP_DIR"
echo " Cleaned up temporary files"
echo ""
