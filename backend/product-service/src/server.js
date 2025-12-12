const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { Pool } = require('pg')
const redis = require('redis')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 8002

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  

  max: 7, // 10 pods × 7 = 70 connections 
  min: 2,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 0, // Infinite
  
  query_timeout: 0, // Infinite
  statement_timeout: 0, // Infinite
  
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  ssl: process.env.PGSSLMODE === 'require' ? {
    rejectUnauthorized: false
  } : false,
})

pool.on('error', (err, client) => {
  console.error('Pool error:', err)
})
// Redis connection 
let redisClient
if (process.env.REDIS_URL) {
  redisClient = redis.createClient({ 
    url: process.env.REDIS_URL,
    socket: {
      tls: process.env.REDIS_TLS === 'true',
      rejectUnauthorized: false
    }
  })
  redisClient.connect().catch(console.error)
  redisClient.on('error', (err) => console.log('Redis Client Error', err))
}

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ 
      status: 'ok', 
      service: 'product-service',
      database: 'connected',
      redis: redisClient?.isOpen ? 'connected' : 'disconnected'
    })
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      service: 'product-service',
      error: error.message 
    })
  }
})


app.get('/category/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params
    const { page = 1, limit = 20, sort = 'title' } = req.query
    const offset = (page - 1) * limit

    // Check cache first
    const cacheKey = `category:${categoryId}:page:${page}:limit:${limit}:sort:${sort}`
    if (redisClient?.isOpen) {
      try {
        const cached = await redisClient.get(cacheKey)
        if (cached) {
          console.log(`Cache HIT: ${cacheKey}`)
          return res.json(JSON.parse(cached))
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError)
      }
    }

    // Validate sort parameter
    const validSorts = ['title', 'price_asc', 'price_desc', 'newest']
    const sortField = validSorts.includes(sort) ? sort : 'title'
    
    let orderBy = 'title ASC'
    switch (sortField) {
      case 'price_asc':
        orderBy = 'base_price ASC'
        break
      case 'price_desc':
        orderBy = 'base_price DESC'
        break
      case 'newest':
        orderBy = 'created_at DESC'
        break
    }

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM products WHERE category_id = $1 AND is_available = true',
      [categoryId]
    )
    const total = parseInt(countResult.rows[0].total)


    const result = await pool.query(
      `SELECT 
        asin,
        title,
        base_price as price,
        category_id as category,
        image_url as image
       FROM products 
       WHERE category_id = $1 AND is_available = true 
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [categoryId, parseInt(limit), parseInt(offset)]
    )

    const response = {
      products: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      },
      category: categoryId
    }

    // Cache for 5 minutes
    if (redisClient?.isOpen) {
      try {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(response))
        console.log(`Cached: ${cacheKey}`)
      } catch (cacheError) {
        console.error('Cache set error:', cacheError)
      }
    }

    res.json(response)
  } catch (error) {
    console.error('Error in /category/:categoryId:', error)
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message 
    })
  }
})

app.get('/sample', (req, res) => {
  console.log(`[STATIC TEST] Request from ${req.ip}`);
  
  // Return static data - NO DATABASE QUERY- USED FOR LOCAL STRESS TESTING USING JMETER
  res.json({
    "products": [
      {"asin": "B000RM1BWM", "title": "#000 Kraft Bubble Mailers", "price": "22.49", "category": "ENVELOPE", "image": "https://picsum.photos/seed/B000RM1BWM/600/600"},
      {"asin": "B094R9HN8H", "title": "001-2000 Pieces Inventory Stickers", "price": "9.99", "category": "LABEL", "image": "https://picsum.photos/seed/B094R9HN8H/600/600"},
      {"asin": "B075RH52LK", "title": "001 hair fragrance | amika", "price": "30.00", "category": "HAIR_STYLING_AGENT", "image": "https://picsum.photos/seed/B075RH52LK/600/600"},
      {"asin": "B000MNBOGY", "title": "002 Buna O-Ring", "price": "10.56", "category": "O_RINGS", "image": "https://picsum.photos/seed/B000MNBOGY/600/600"},
      {"asin": "B01AJP4CMW", "title": "Thermador Range Hood Filter", "price": "19.99", "category": "HVAC_AIR_FILTER", "image": "https://picsum.photos/seed/B01AJP4CMW/600/600"},
      {"asin": "B08BHSYNBN", "title": "Line String Trimmer Spool", "price": "14.34", "category": "OUTDOOR_LIVING", "image": "https://picsum.photos/seed/B08BHSYNBN/600/600"},
      {"asin": "B07XBPCGKM", "title": "Video Game Retro T-Shirt", "price": "17.99", "category": "SHIRT", "image": "https://picsum.photos/seed/B07XBPCGKM/600/600"},
      {"asin": "B00VXKJIAO", "title": "Antimo Caputo Pasta Flour", "price": "17.94", "category": "NOODLE", "image": "https://picsum.photos/seed/B00VXKJIAO/600/600"},
      {"asin": "B07NXP8S9W", "title": "Laptop Battery for Lenovo", "price": "24.74", "category": "BATTERY", "image": "https://picsum.photos/seed/B07NXP8S9W/600/600"},
      {"asin": "B07PVYM15L", "title": "0-10V Dimmer Switch", "price": "25.63", "category": "LIGHT_FIXTURE", "image": "https://picsum.photos/seed/B07PVYM15L/600/600"},
      {"asin": "B08LR785Z7", "title": "Flame Sensor Replacement", "price": "8.99", "category": "MAJOR_HOME_APPLIANCES", "image": "https://picsum.photos/seed/B08LR785Z7/600/600"},
      {"asin": "B0051XYMQ4", "title": "014 Buna-N O-Ring", "price": "2.88", "category": "O_RINGS", "image": "https://picsum.photos/seed/B0051XYMQ4/600/600"},
      {"asin": "B07KG7RVVH", "title": "pH Electrode Probe", "price": "16.90", "category": "PRECISION_MEASURING", "image": "https://picsum.photos/seed/B07KG7RVVH/600/600"},
      {"asin": "B07HM2KH47", "title": "Laptop Battery Replacement", "price": "43.26", "category": "BATTERY", "image": "https://picsum.photos/seed/B07HM2KH47/600/600"},
      {"asin": "B08P7P4BGY", "title": "Hiking Pole Tip", "price": "11.94", "category": "WALKING_STICK", "image": "https://picsum.photos/seed/B08P7P4BGY/600/600"},
      {"asin": "B07XD91349", "title": "Petit Gundam Figure", "price": "12.95", "category": "TOY_FIGURE", "image": "https://picsum.photos/seed/B07XD91349/600/600"},
      {"asin": "B00CLXLGFC", "title": "Female Disconnect Terminal", "price": "13.20", "category": "ELECTRONIC_COMPONENT_TERMINAL", "image": "https://picsum.photos/seed/B00CLXLGFC/600/600"},
      {"asin": "B0786ZV3T2", "title": "O-Ring Quantity 10", "price": "10.49", "category": "O_RINGS", "image": "https://picsum.photos/seed/B0786ZV3T2/600/600"},
      {"asin": "B082QZLF5V", "title": "Ruby Tungsten Ring", "price": "279.00", "category": "RING", "image": "https://picsum.photos/seed/B082QZLF5V/600/600"},
      {"asin": "B08R276P17", "title": "Derma Roller Microneedle", "price": "13.99", "category": "BEAUTY", "image": "https://picsum.photos/seed/B08R276P17/600/600"}
    ],
    "pagination": {"page": 1, "limit": 20, "total": 873263, "totalPages": 43664}
  });
});




























// ============================================
// Get all products with pagination
// ============================================
// ============================================
// Get all products with pagination - REPLACE lines 157-187 in server.js
// ============================================
app.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, featured } = req.query
    const offset = (page - 1) * limit

    let countQuery = `SELECT COUNT(*) as total
                      FROM products
                      WHERE is_available = true
                      AND base_price > 0
                      AND LENGTH(title) > 5
                      AND title !~ '^[÷=?&.+×−-]+$'
                      AND title NOT LIKE 'Product %'`
    
    let query = `SELECT asin, title, base_price as price, category_id as category, image_url as image
                 FROM products
                 WHERE is_available = true
                 AND base_price > 0
                 AND LENGTH(title) > 5
                 AND title !~ '^[÷=?&.+×−-]+$'
                 AND title NOT LIKE 'Product %'`
    
    const params = []
    const countParams = []
    let paramIndex = 1

    if (category) {
      query += ` AND category_id = $${paramIndex}`
      countQuery += ` AND category_id = $1`
      params.push(category)
      countParams.push(category)
      paramIndex++
    }

    if (featured) {
      query += ' ORDER BY created_at DESC'
    } else {
      query += ' ORDER BY title'
    }

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(parseInt(limit), parseInt(offset))

    // Get total count
    const countResult = await pool.query(countQuery, countParams)
    const totalProducts = parseInt(countResult.rows[0].total)

    // Get products for current page
    const result = await pool.query(query, params)
    
    res.json({ 
      products: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalProducts,
        totalPages: Math.ceil(totalProducts / parseInt(limit))
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Internal server error', error: error.message })
  }
})

// ============================================
// Get product by ASIN (detailed view)
// ============================================
app.get('/product/:asin', async (req, res) => {
  try {
    const { asin } = req.params

    // Try cache first
    if (redisClient?.isOpen) {
      try {
        const cached = await redisClient.get(`product:${asin}`)
        if (cached) {
          return res.json(JSON.parse(cached))
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError)
      }
    }

    const result = await pool.query(
      'SELECT asin, title, description, base_price as price, category_id as category, image_url as image, is_available FROM products WHERE asin = $1',
      [asin]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const product = result.rows[0]

    // Cache for 1 hour
    if (redisClient?.isOpen) {
      try {
        await redisClient.setEx(`product:${asin}`, 3600, JSON.stringify({ product }))
      } catch (cacheError) {
        console.error('Cache set error:', cacheError)
      }
    }

    res.json({ product })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ============================================
// Search products
// ============================================
app.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query
    
    if (!q) {
      return res.status(400).json({ message: 'Search query required' })
    }

    const offset = (page - 1) * limit

    const result = await pool.query(
      `SELECT asin, title, base_price as price, category_id as category, image_url as image
       FROM products 
       WHERE is_available = true 
       AND (title ILIKE $1 OR description ILIKE $1)
       ORDER BY title
       LIMIT $2 OFFSET $3`,
      [`%${q}%`, limit, offset]
    )

    res.json({ products: result.rows, total: result.rows.length, query: q })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ============================================
// Get list of categories
// ============================================
app.get('/categories', async (req, res) => {
  try {
    // Check cache
    if (redisClient?.isOpen) {
      try {
        const cached = await redisClient.get('categories:list')
        if (cached) {
          return res.json(JSON.parse(cached))
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError)
      }
    }

    const result = await pool.query(
      `SELECT 
        category_id as id,
        category_id as name,
        COUNT(*) as product_count
       FROM products 
       WHERE is_available = true
       GROUP BY category_id
       ORDER BY product_count DESC, category_id`
    )

    const response = { categories: result.rows }

    // Cache for 1 hour
    if (redisClient?.isOpen) {
      try {
        await redisClient.setEx('categories:list', 3600, JSON.stringify(response))
      } catch (cacheError) {
        console.error('Cache set error:', cacheError)
      }
    }

    res.json(response)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: 'Something went wrong!' })
})

// Start server
app.listen(PORT, () => {
  console.log(`Product service running on port ${PORT}`)
  console.log(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`)
  console.log(`Redis: ${redisClient?.isOpen ? 'Connected' : 'Disconnected'}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...')
  await pool.end()
  if (redisClient?.isOpen) {
    await redisClient.quit()
  }
  process.exit(0)
})