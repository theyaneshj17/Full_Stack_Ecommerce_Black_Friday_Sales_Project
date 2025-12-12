#!/bin/bash



if [ -z "$1" ]; then
    echo "Usage: ./monitor-load-test.sh <results-directory>"
    echo "Example: ./monitor-load-test.sh load-test-results/scenario1_20251210_120000"
    exit 1
fi

RESULTS_DIR="$1"
mkdir -p "${RESULTS_DIR}/monitoring"

capture_metrics() {
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    
    # Pod status
    kubectl get pods -o wide > "${RESULTS_DIR}/monitoring/pods_${1}.txt"
    
    # Resource usage
    kubectl top pods > "${RESULTS_DIR}/monitoring/pod-resources_${1}.txt" 2>/dev/null
    kubectl top nodes > "${RESULTS_DIR}/monitoring/node-resources_${1}.txt" 2>/dev/null
    
    # HPA status
    kubectl get hpa -o wide > "${RESULTS_DIR}/monitoring/hpa_${1}.txt" 2>/dev/null
    
    # Deployment replicas
    kubectl get deployment product-service order-service cart-service -o custom-columns=NAME:.metadata.name,REPLICAS:.spec.replicas,READY:.status.readyReplicas,AVAILABLE:.status.availableReplicas > "${RESULTS_DIR}/monitoring/replicas_${1}.txt"
    
    # Service logs (last 20 lines)
    kubectl logs deployment/product-service --tail=20 > "${RESULTS_DIR}/monitoring/product-logs_${1}.txt" 2>/dev/null
    kubectl logs deployment/api-gateway --tail=20 > "${RESULTS_DIR}/monitoring/gateway-logs_${1}.txt" 2>/dev/null
}

echo "Starting monitoring (capturing every 10 seconds)..."
echo ""

COUNTER=0

# Capture baseline
echo "[Baseline] Capturing initial state..."
capture_metrics "baseline"

while true; do
    sleep 10
    COUNTER=$((COUNTER + 1))
    

    # Show pod count
    echo "POD STATUS:"
    kubectl get pods | grep -E "product-service|cart-service|order-service|api-gateway"
    echo ""
    
    # Show HPA status
    echo "AUTO-SCALING STATUS:"
    kubectl get hpa 2>/dev/null || echo "No HPA configured"
    echo ""
    
    # Show resource usage
    echo " RESOURCE USAGE:"
    kubectl top pods 2>/dev/null | grep -E "NAME|product-service|cart-service|order-service|api-gateway"
    echo ""
    
    # Capture to file
    capture_metrics "${COUNTER}"
    
    echo " Captured sample ${COUNTER} to ${RESULTS_DIR}/monitoring/"
    echo ""
    echo "Press Ctrl+C to stop monitoring"
done