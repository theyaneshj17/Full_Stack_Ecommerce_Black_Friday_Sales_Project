#!/bin/bash


# Creates EKS, RDS

set -e  # Exit on error

# Configuration
CLUSTER_NAME="ecommerce-cluster"
REGION="us-east-1"
DB_PASSWORD="" #Replace with actual or get from .env
PROJECT_TAG="Ecommerce"



# 1. Create EKS Cluster

cat > /tmp/cluster-config.yaml << EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: ${CLUSTER_NAME}
  region: ${REGION}
  version: "1.34"

vpc:
  cidr: 10.0.0.0/16
  nat:
    gateway: Single

managedNodeGroups:
  - name: standard-workers
    instanceType: t3.small          
    minSize: 2                      
    maxSize: 10                      
    desiredCapacity: 2              
    volumeSize: 30                  
    ssh:
      allow: false
    labels:
      role: worker
      environment: production
    tags:
      k8s.io/cluster-autoscaler/enabled: "true"
      k8s.io/cluster-autoscaler/${CLUSTER_NAME}: "owned"
      Project: ${PROJECT_TAG}
    iam:
      withAddonPolicies:
        autoScaler: true
        cloudWatch: true
        ebs: true
        albIngress: true



cloudWatch:
  clusterLogging:
    enableTypes: ["api", "audit", "authenticator", "controllerManager", "scheduler"]
EOF

if eksctl get cluster --name ${CLUSTER_NAME} --region ${REGION} &> /dev/null; then
    echo -e "$Cluster ${CLUSTER_NAME} already exists. Skipping creation.${NC}"
else
    eksctl create cluster -f /tmp/cluster-config.yaml
    echo -e "$EKS Cluster created successfully!${NC}"
fi

# Update kubeconfig
aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${REGION}
echo ""

# VPC Configuration

echo -e "Getting VPC information...${NC}"

VPC_ID=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${REGION} \
    --query 'cluster.resourcesVpcConfig.vpcId' --output text)

SUBNET_IDS=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${REGION} \
    --query 'cluster.resourcesVpcConfig.subnetIds[*]' --output text)

SUBNET_ID1=$(echo $SUBNET_IDS | cut -d' ' -f1)
SUBNET_ID2=$(echo $SUBNET_IDS | cut -d' ' -f2)

echo -e "$VPC ID: ${VPC_ID}${NC}"
echo -e "$Subnet IDs: ${SUBNET_ID1}, ${SUBNET_ID2}${NC}"
echo ""

echo -e "Creating RDS PostgreSQL Database...${NC}"

# Create security group for RDS
RDS_SG_NAME="ecommerce-rds-sg"

# Check if security group exists (with VPC filter!)
RDS_SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${RDS_SG_NAME}" "Name=vpc-id,Values=${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' \
    --region ${REGION} \
    --output text 2>/dev/null)

# Create if doesn't exist
if [ "$RDS_SG_ID" == "None" ] || [ -z "$RDS_SG_ID" ]; then
    echo "Creating RDS security group..."
    RDS_SG_ID=$(aws ec2 create-security-group \
        --group-name ${RDS_SG_NAME} \
        --description "Security group for RDS PostgreSQL" \
        --vpc-id ${VPC_ID} \
        --region ${REGION} \
        --query 'GroupId' --output text)
    
    if [ $? -ne 0 ] || [ -z "$RDS_SG_ID" ]; then
        echo -e "$Failed to create RDS security group${NC}"
        exit 1
    fi
    echo -e "$ Created RDS Security Group: ${RDS_SG_ID}${NC}"
else
    echo -e "$ Found existing RDS Security Group: ${RDS_SG_ID}${NC}"
fi

# Get EKS cluster security group
CLUSTER_SG=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${REGION} \
    --query 'cluster.resourcesVpcConfig.clusterSecurityGroupId' --output text)

echo -e "$Cluster Security Group: ${CLUSTER_SG}${NC}"

# Allow PostgreSQL traffic from EKS cluster
echo "Configuring security group ingress rules..."
aws ec2 authorize-security-group-ingress \
    --group-id ${RDS_SG_ID} \
    --protocol tcp \
    --port 5432 \
    --source-group ${CLUSTER_SG} \
    --region ${REGION} 2>&1 | grep -v "already exists" || true

# Create DB subnet group
echo "Creating DB subnet group..."
if ! aws rds describe-db-subnet-groups \
    --db-subnet-group-name ecommerce-subnet-group \
    --region ${REGION} &>/dev/null; then
    
    aws rds create-db-subnet-group \
        --db-subnet-group-name ecommerce-subnet-group \
        --db-subnet-group-description "Subnet group for ecommerce database" \
        --subnet-ids ${SUBNET_ID1} ${SUBNET_ID2} \
        --region ${REGION} \
        --tags Key=Project,Value=${PROJECT_TAG}
    
    if [ $? -ne 0 ]; then
        echo -e "$ Failed to create DB subnet group${NC}"
        exit 1
    fi
    echo -e "$Created DB subnet group${NC}"
else
    echo -e "$DB subnet group already exists${NC}"
fi

# Check if RDS instance exists
if aws rds describe-db-instances \
    --db-instance-identifier ecommerce-postgres \
    --region ${REGION} &>/dev/null; then
    
    echo -e "$  RDS instance 'ecommerce-postgres' already exists${NC}"
    RDS_STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier ecommerce-postgres \
        --region ${REGION} \
        --query 'DBInstances[0].DBInstanceStatus' --output text)
    echo -e "$Current status: ${RDS_STATUS}${NC}"
else
    # Create RDS instance
    echo "Creating RDS instance (this takes 5-10 minutes)..."
    aws rds create-db-instance \
        --db-instance-identifier ecommerce-postgres \
        --db-instance-class db.t3.micro \
        --engine postgres \
        --master-username postgres \
        --master-user-password "${DB_PASSWORD}" \
        --allocated-storage 20 \
        --storage-type gp3 \
        --vpc-security-group-ids ${RDS_SG_ID} \
        --db-subnet-group-name ecommerce-subnet-group \
        --no-multi-az \
        --no-publicly-accessible \
        --region ${REGION} \
        --tags Key=Project,Value=${PROJECT_TAG}

    
    if [ $? -ne 0 ]; then
        echo -e "$ Failed to create RDS instance${NC}"
        echo -e "$Check the error message above${NC}"
        exit 1
    fi
    echo -e "$RDS instance creation initiated${NC}"
fi

# Wait for RDS to be available
echo "Waiting for RDS to be available (this may take several minutes)..."
if aws rds wait db-instance-available \
    --db-instance-identifier ecommerce-postgres \
    --region ${REGION}; then
    
    RDS_ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier ecommerce-postgres \
        --region ${REGION} \
        --query 'DBInstances[0].Endpoint.Address' --output text)
    
    echo -e "$RDS PostgreSQL is ready!${NC}"
    echo -e "$Endpoint: ${RDS_ENDPOINT}${NC}"
else
    echo -e "$ RDS failed to become available${NC}"
    echo -e "$Check AWS Console for details: RDS → Databases → ecommerce-postgres${NC}"
    exit 1
fi

echo ""


echo -e "$Creating ElastiCache Redis...${NC}"

# Create cache subnet group
aws elasticache create-cache-subnet-group \
    --cache-subnet-group-name ecommerce-cache-subnet \
    --cache-subnet-group-description "Subnet group for Redis" \
    --subnet-ids ${SUBNET_ID1} ${SUBNET_ID2} \
    --region ${REGION} 2>/dev/null || echo "Cache subnet group already exists"

# Create security group for Redis
REDIS_SG_NAME="ecommerce-redis-sg"

REDIS_SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${REDIS_SG_NAME}" "Name=vpc-id,Values=${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' \
    --region ${REGION} \
    --output text 2>/dev/null)

if [ "$REDIS_SG_ID" == "None" ] || [ -z "$REDIS_SG_ID" ]; then
    REDIS_SG_ID=$(aws ec2 create-security-group \
        --group-name ${REDIS_SG_NAME} \
        --description "Security group for Redis" \
        --vpc-id ${VPC_ID} \
        --region ${REGION} \
        --query 'GroupId' --output text)
fi

# Allow Redis traffic from EKS
aws ec2 authorize-security-group-ingress \
    --group-id ${REDIS_SG_ID} \
    --protocol tcp \
    --port 6379 \
    --source-group ${CLUSTER_SG} \
    --region ${REGION} 2>/dev/null || echo "Ingress rule already exists"

# Check if Redis cluster exists
REDIS_EXISTS=$(aws elasticache describe-replication-groups \
    --replication-group-id ecommerce-redis \
    --region ${REGION} \
    --query 'ReplicationGroups[0].ReplicationGroupId' \
    --output text 2>/dev/null)

if [ "$REDIS_EXISTS" != "ecommerce-redis" ]; then
    echo "Creating Redis cluster..."
    aws elasticache create-replication-group \
        --replication-group-id ecommerce-redis \
        --replication-group-description "Redis cluster for e-commerce" \
        --engine redis \
        --cache-node-type cache.t3.micro \
        --num-cache-clusters 1 \
        --cache-subnet-group-name ecommerce-cache-subnet \
        --security-group-ids ${REDIS_SG_ID} \
        --region ${REGION} \
        --tags Key=Project,Value=${PROJECT_TAG}
    
    if [ $? -ne 0 ]; then
        echo -e "$Failed to create Redis cluster${NC}"
        exit 1
    fi
else
    echo "Redis cluster already exists"
fi

# Wait for Redis to be available
echo "Waiting for Redis to be available (10-15 minutes)..."
MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    REDIS_STATUS=$(aws elasticache describe-replication-groups \
        --replication-group-id ecommerce-redis \
        --region ${REGION} \
        --query 'ReplicationGroups[0].Status' \
        --output text 2>/dev/null)
    
    if [ "$REDIS_STATUS" == "available" ]; then
        echo -e "$Redis cluster is available!${NC}"
        break
    else
        echo "Current status: ${REDIS_STATUS} (attempt $((ATTEMPT+1))/${MAX_ATTEMPTS})"
        sleep 15
        ATTEMPT=$((ATTEMPT+1))
    fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "$Timeout waiting for Redis${NC}"
    exit 1
fi

# Get Redis endpoint
REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
    --replication-group-id ecommerce-redis \
    --region ${REGION} \
    --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
    --output text)

echo -e "$ElastiCache Redis created!${NC}"
echo -e "$Endpoint: ${REDIS_ENDPOINT}${NC}"
echo ""


#Create ECR Repository

echo -e "$Creating ECR repositories...${NC}"

services=("frontend" "product-service" "inventory-service" "cart-service" "order-service" "payment-service" "api-gateway")

for service in "${services[@]}"; do
    aws ecr create-repository \
        --repository-name ecommerce/${service} \
        --image-scanning-configuration scanOnPush=true \
        --tags Key=Project,Value=${PROJECT_TAG} \
        --region ${REGION} 2>/dev/null || echo "Repository ecommerce/${service} already exists"
done

echo -e "$ECR repositories created!${NC}"
echo ""


EOF
