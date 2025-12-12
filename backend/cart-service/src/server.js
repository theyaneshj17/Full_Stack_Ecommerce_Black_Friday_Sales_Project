const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const redis = require('redis')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 8003

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

// Redis connection
const redisClient = redis.createClient({ 
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    tls: process.env.REDIS_TLS === 'true',
    rejectUnauthorized: false
  }
})

redisClient.connect().catch(console.error)
redisClient.on('error', (err) => console.log('Redis Client Error', err))
redisClient.on('connect', () => console.log('Redis Client Connected'))

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'Access token required' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' })
    }
    req.user = user
    next()
  })
}

// Health check
app.get('/health', async (req, res) => {
  try {
    await redisClient.ping()
    res.json({ 
      status: 'ok', 
      service: 'cart-service',
      redis: 'connected'
    })
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      service: 'cart-service',
      error: error.message 
    })
  }
})


const getCartKey = (userId) => `cart:${userId}`

const getCart = async (userId) => {
  try {
    const cartData = await redisClient.get(getCartKey(userId))
    return cartData ? JSON.parse(cartData) : { items: [], totalItems: 0, totalPrice: 0 }
  } catch (error) {
    console.error('Error getting cart:', error)
    return { items: [], totalItems: 0, totalPrice: 0 }
  }
}

const saveCart = async (userId, cart) => {
  try {
    // Calculate totals
    cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)
    cart.totalPrice = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    cart.updatedAt = new Date().toISOString()
    
    await redisClient.setEx(
      getCartKey(userId), 
      86400, // 24 hours expiry
      JSON.stringify(cart)
    )
    return cart
  } catch (error) {
    console.error('Error saving cart:', error)
    throw error
  }
}

// Get user's cart
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const cart = await getCart(req.user.userId)
    res.json({ cart })
  } catch (error) {
    console.error('Error fetching cart:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Add item to cart
app.post('/api/cart/add', authenticateToken, async (req, res) => {
  try {
    const { asin, title, price, image, quantity = 1 } = req.body

    // Validation
    if (!asin || !title || !price) {
      return res.status(400).json({ message: 'Missing required fields: asin, title, price' })
    }

    const cart = await getCart(req.user.userId)
    
    // Check if item already exists
    const existingItemIndex = cart.items.findIndex(item => item.asin === asin)
    
    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity
    } else {
      // Add new item
      cart.items.push({
        asin,
        title,
        price: parseFloat(price),
        image,
        quantity: parseInt(quantity),
        addedAt: new Date().toISOString()
      })
    }

    const updatedCart = await saveCart(req.user.userId, cart)
    
    res.json({ 
      message: 'Item added to cart',
      cart: updatedCart
    })
  } catch (error) {
    console.error('Error adding to cart:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Update item quantity
app.put('/api/cart/update', authenticateToken, async (req, res) => {
  try {
    const { asin, quantity } = req.body

    if (!asin || quantity === undefined) {
      return res.status(400).json({ message: 'Missing required fields: asin, quantity' })
    }

    const cart = await getCart(req.user.userId)
    const itemIndex = cart.items.findIndex(item => item.asin === asin)

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' })
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      cart.items.splice(itemIndex, 1)
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = parseInt(quantity)
    }

    const updatedCart = await saveCart(req.user.userId, cart)
    
    res.json({ 
      message: 'Cart updated',
      cart: updatedCart
    })
  } catch (error) {
    console.error('Error updating cart:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Remove item from cart
app.delete('/api/cart/remove/:asin', authenticateToken, async (req, res) => {
  try {
    const { asin } = req.params

    const cart = await getCart(req.user.userId)
    const itemIndex = cart.items.findIndex(item => item.asin === asin)

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' })
    }

    cart.items.splice(itemIndex, 1)
    const updatedCart = await saveCart(req.user.userId, cart)
    
    res.json({ 
      message: 'Item removed from cart',
      cart: updatedCart
    })
  } catch (error) {
    console.error('Error removing from cart:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Clear entire cart
app.delete('/api/cart/clear', authenticateToken, async (req, res) => {
  try {
    await redisClient.del(getCartKey(req.user.userId))
    
    res.json({ 
      message: 'Cart cleared',
      cart: { items: [], totalItems: 0, totalPrice: 0 }
    })
  } catch (error) {
    console.error('Error clearing cart:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Get cart item count (for badge)
app.get('/api/cart/count', authenticateToken, async (req, res) => {
  try {
    const cart = await getCart(req.user.userId)
    res.json({ count: cart.totalItems || 0 })
  } catch (error) {
    console.error('Error getting cart count:', error)
    res.status(500).json({ count: 0 })
  }
})

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: 'Something went wrong!' })
})

// Start server
app.listen(PORT, () => {
  console.log(`Cart service running on port ${PORT}`)
  console.log(`Redis: ${process.env.REDIS_URL}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...')
  await redisClient.quit()
  process.exit(0)
})