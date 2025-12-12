const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 8000

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Rate limiting
//const limiter = rateLimit({
 // windowMs: 15 * 60 * 1000, // 15 minutes
 // max: 100, // limit each IP to 100 requests per windowMs
//})
//app.use('/api/', limiter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' })
})

// Service URLs (in production, these would be Kubernetes service names)
const services = {
  users: process.env.USER_SERVICE_URL || 'http://localhost:8001',
  products: process.env.PRODUCT_SERVICE_URL || 'http://product-service:8002',
  cart: process.env.CART_SERVICE_URL || 'http://cart-service:8003',
  orders: process.env.ORDER_SERVICE_URL || 'http://order-service:8004',
  payments: process.env.PAYMENT_SERVICE_URL || 'http://localhost:8005',
  inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:8006',
}

// Proxy middleware for each service
app.use(
  '/api/users',
  createProxyMiddleware({
    target: services.users,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '' },
    timeout: 0, // No timeout
    proxyTimeout: 0, // No proxy timeout
  })
)

app.use(
  '/api/products',
  createProxyMiddleware({
    target: services.products,
    changeOrigin: true,
    pathRewrite: { '^/api/products': '' },
    timeout: 0,
    proxyTimeout: 0,
  })
)

app.use(
  '/api/cart',
  createProxyMiddleware({
    target: services.cart,
    changeOrigin: true,
    pathRewrite: { '^/api/cart': '' },
    timeout: 0,
    proxyTimeout: 0,
  })
)

app.use(
  '/api/orders',
  createProxyMiddleware({
    target: services.orders,
    changeOrigin: true,
    pathRewrite: { '^/api/orders': '' },
    timeout: 0, // Infinite timeout
    proxyTimeout: 0, // Infinite proxy timeout
    onProxyReq: (proxyReq, req, res) => {
      // Ensure request body is properly forwarded
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.status(500).json({ 
        message: 'Proxy error', 
        error: err.message 
      });
    }
  })
)

app.use(
  '/api/payments',
  createProxyMiddleware({
    target: services.payments,
    changeOrigin: true,
    pathRewrite: { '^/api/payments': '' },
    timeout: 0,
    proxyTimeout: 0,
  })
)

app.use(
  '/api/inventory',
  createProxyMiddleware({
    target: services.inventory,
    changeOrigin: true,
    pathRewrite: { '^/api/inventory': '' },
    timeout: 0,
    proxyTimeout: 0,
  })
)

const server = app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`)
})

// Set infinite timeout on the server itself
server.timeout = 0
server.keepAliveTimeout = 0
server.headersTimeout = 0