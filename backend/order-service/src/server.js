const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 8004

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ecommerce_orders',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
})

// Authentication middleware 
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' })
    req.user = user
    next()
  })
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' })
})

// Create order
app.post('/', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { items, total_amount, shipping } = req.body
    const user_id = 1 
    
    // Generate unique order number
    const order_number = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    console.log('Creating order:', { user_id, order_number, total_amount, items, shipping })

    // Create order with proper schema
    const orderResult = await client.query(
      `INSERT INTO orders (
        user_id, order_number, status, total_amount, currency,
        shipping_name, shipping_email, shipping_address_line1, 
        shipping_city, shipping_state, shipping_postal_code, shipping_country,
        shipping_phone, payment_method, payment_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING order_id, order_number, created_at, total_amount, status`,
      [
        user_id,
        order_number,
        'pending',
        total_amount,
        'USD',
        shipping?.name || 'Guest User',
        shipping?.email || 'guest@example.com',
        shipping?.address || 'N/A',
        shipping?.city || 'N/A',
        shipping?.state || 'N/A',
        shipping?.zipCode || '00000',
        shipping?.country || 'US',
        shipping?.phone || 'N/A',
        shipping?.paymentMethod || 'credit_card',
        'pending'
      ]
    )

    const order = orderResult.rows[0]

    // Create order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, asin, title, price, quantity, subtotal, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.order_id, 
          item.product_id || item.asin, 
          item.title || 'Product', 
          item.price, 
          item.quantity, 
          item.price * item.quantity,
          item.image_url || item.image || null
        ]
      )
    }

    await client.query('COMMIT')
    console.log('Order created successfully:', order.order_id, order.order_number)
    res.status(201).json({ message: 'Order created successfully', order })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Order creation error:', error)
    res.status(500).json({ message: 'Internal server error', error: error.message })
  } finally {
    client.release()
  }
})

// Get user orders 
app.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, 
       (SELECT json_agg(json_build_object(
         'product_id', oi.product_id,
         'quantity', oi.quantity,
         'price_at_purchase', oi.price_at_purchase,
         'subtotal', oi.subtotal
       )) FROM order_items oi WHERE oi.order_id = o.order_id) as items
       FROM orders o
       ORDER BY o.order_date DESC`
    )

    res.json({ orders: result.rows })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Get order by ID 
app.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      `SELECT o.*, 
       (SELECT json_agg(json_build_object(
         'product_id', oi.product_id,
         'quantity', oi.quantity,
         'price_at_purchase', oi.price_at_purchase,
         'subtotal', oi.subtotal
       )) FROM order_items oi WHERE oi.order_id = o.order_id) as items
       FROM orders o
       WHERE o.order_id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' })
    }

    res.json({ order: result.rows[0] })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Cancel order
app.put('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      `UPDATE orders 
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE order_id = $1 AND status IN ('PENDING', 'CONFIRMED')
       RETURNING *`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found or cannot be cancelled' })
    }

    res.json({ message: 'Order cancelled successfully', order: result.rows[0] })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.listen(PORT, () => {
  console.log(`Order service running on port ${PORT}`)
  console.log(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`)
})