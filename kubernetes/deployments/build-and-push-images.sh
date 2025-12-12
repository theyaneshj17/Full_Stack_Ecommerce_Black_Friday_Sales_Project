#!/bin/bash

# ============================================
# Build and Push Docker Images to ECR
# ============================================

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo -e "$AWS Account:${NC} ${AWS_ACCOUNT_ID}"
echo -e "$Region:${NC} ${AWS_REGION}"
echo -e "$ECR Registry:${NC} ${ECR_REGISTRY}"
echo ""

# Authenticate Docker to ECR
echo -e "$Authenticating Docker to ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}
echo -e "$Docker authenticated to ECR${NC}"
echo ""

# Function to build and push image
build_and_push() {
    local service=$1
    local dockerfile=$2
    local context=$3
    

    
    local image_name="${ECR_REGISTRY}/ecommerce/${service}"
    local git_sha=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
    
    # Build image
    echo "Building Docker image..."
    docker build -t ${image_name}:${git_sha} -t ${image_name}:latest -f ${dockerfile} ${context}
    
    # Push both tags
    echo "Pushing to ECR..."
    docker push ${image_name}:${git_sha}
    docker push ${image_name}:latest
    
    echo -e "$${service} pushed successfully${NC}"
    echo -e "$   Image: ${image_name}:latest${NC}"
    echo ""
}

# ============================================
# Build Frontend
# ============================================


ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "${ROOT_DIR}"

if [ -d "frontend" ]; then
    echo -e "$ Building Frontend...${NC}"
    


backend_services=("api-gateway"  "product-service" "cart-service" "order-service" )

for service in "${backend_services[@]}"; do
    service_dir="backend/${service}"
    if [ -d "${service_dir}" ]; then
        echo -e "$ Building ${service}...${NC}"
       
        
        build_and_push "${service}" "${service_dir}/Dockerfile" "${service_dir}"
    else
        echo -e "$  Directory ${service_dir} not found, skipping...${NC}"
    fi
done
