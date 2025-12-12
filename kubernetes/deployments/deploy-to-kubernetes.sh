#!/bin/bash

# Deploy E-Commerce Services to Kubernetes


kubectl apply -f k8s-deployments.yaml


sleep 10

kubectl wait --for=condition=ready pod -l app=product-service --timeout=300s 2>/dev/null || echo "Product service pods starting..."
kubectl wait --for=condition=ready pod -l app=cart-service --timeout=300s 2>/dev/null || echo "Cart service pods starting..."
kubectl wait --for=condition=ready pod -l app=order-service --timeout=300s 2>/dev/null || echo "Order service pods starting..."

echo -e "$Checking deployment status...${NC}"
echo ""

echo "Pods:"
kubectl get pods
echo ""

echo "Services:"
kubectl get svc
echo ""

echo "HPAs:"
kubectl get hpa
echo ""
