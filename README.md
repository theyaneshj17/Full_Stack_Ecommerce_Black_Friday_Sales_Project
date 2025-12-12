# Ecommerce_OLTP_OLAP_Project


## 📁 Current Repository Structure

```
Full_Stack_Ecommerce_Black_Friday_Sales_Project/
│
├── README.md                                              
├── backend/                           # Node.js + Express microservices
│   ├── api-gateway/                   # Routing, CORS, entry point
│   ├── product-service/               # Product catalog 
│   ├── cart-service/                  # Shopping cart 
│   └── order-service/                 # Order processing (PostgreSQL)
│       └── [Each: src/server.js, Dockerfile, package.json]
│
├── frontend/                          # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── components/               
│   │   ├── pages/                    
│   │   └── services/                 
│   └── [Dockerfile, nginx.conf, vite.config.js, tailwind.config.js]
│
├── database/                         # SQL scripts
│   ├── create-table.sql              # Schema definitions
│   ├── seed-products-docker.sh       # Data seeding
│   ├── init-all-databases.sh         # Setup script
│   └── athena-update-partitions.sql  # OLAP partitions
│
├── emr/                               # Spark analytics (OLAP)
│   ├── scripts/
│   │   ├── black-friday-analysis.py  # Main analytics (1.8M+ records)
│   │   └── incremental-orders-etl.py # Incremental ETL
│   └── emr-pipeline.sh               # Orchestration
│
├── kubernetes/                        # K8s deployments
│   └── deployments/
│       ├── k8s-deployments.yaml      # Services + HPA
│       ├── build-and-push-images.sh  # Docker automation
│       └── deploy-to-kubernetes.sh   # EKS deployment
│
└── loadtest/                          # JMeter testing
    ├── load-test-results/            # Performance results
    └── monitor-load.sh               # Monitoring
```