import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import ProductCard from '../components/ProductCard'
import { productService } from '../services/productService'




const banners = [
  {
    id: 1,
    title: 'Summer Sale - Up to 50% Off',
    subtitle: 'Shop the latest deals',
    image: 'https://via.placeholder.com/1200x400?text=Summer+Sale',
    link: '/products?category=SHIRT',
  },
  {
    id: 2,
    title: 'New Electronics Arrival',
    subtitle: 'Latest tech at best prices',
    image: 'https://via.placeholder.com/1200x400?text=Electronics',
    link: '/category/ELECTRONIC_CABLE',
  },
  {
    id: 3,
    title: 'Free Shipping on Orders Over $50',
    subtitle: 'Shop now and save',
    image: 'https://via.placeholder.com/1200x400?text=Free+Shipping',
    link: '/products',
  },
]

const HomePage = () => {
  const [currentBanner, setCurrentBanner] = useState(0)
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFeaturedProducts()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadFeaturedProducts = async () => {
    try {
      setLoading(true)
      
      const response = await productService.getProducts({ limit: 12, featured: true })
      if (response && response.products && Array.isArray(response.products) && response.products.length > 0) {
        setFeaturedProducts(response.products)
      } else {
        console.warn('API returned empty products, using mock data')
        setFeaturedProducts(generateMockProducts(12))
      }
    } catch (error) {
      console.warn('API request failed, using mock data:', error.message)
     
      setFeaturedProducts(generateMockProducts(12))
    } finally {
      setLoading(false)
    }
  }

  const generateMockProducts = (count) => {
    const mockCategories = ['PANTS', 'CELLULAR_PHONE_CASE', 'HEALTH_PERSONAL_CARE', 'NUTRITIONAL_SUPPLEMENT']
    return Array.from({ length: count }, (_, i) => ({
      product_id: `mock-${i + 1}`,
      title: `Product ${i + 1} - ${mockCategories[i % mockCategories.length]}`,
      base_price: Math.random() * 100 + 10, 
      image_url: `https://picsum.photos/300/300?random=${i + 1}`,
      rating: (Math.random() * 2 + 3).toFixed(1),
      review_count: Math.floor(Math.random() * 1000),
      category_id: mockCategories[i % mockCategories.length],
    }))
  }

  const nextBanner = () => {
    setCurrentBanner((prev) => (prev + 1) % banners.length)
  }

  const prevBanner = () => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Banner Carousel */}
      <section className="mb-12 relative">
        <div className="relative h-64 md:h-96 rounded-lg overflow-hidden">
          {banners.map((banner, index) => (
            <Link
              key={banner.id}
              to={banner.link}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentBanner ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div
                className="w-full h-full bg-cover bg-center flex items-center justify-center"
                style={{ backgroundImage: `url(${banner.image})` }}
              >
                <div className="text-center text-white bg-black bg-opacity-50 px-8 py-4 rounded-lg">
                  <h2 className="text-3xl md:text-5xl font-bold mb-2">{banner.title}</h2>
                  <p className="text-xl md:text-2xl">{banner.subtitle}</p>
                </div>
              </div>
            </Link>
          ))}
          <button
            onClick={prevBanner}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Previous banner"
          >
            <FiChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={nextBanner}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Next banner"
          >
            <FiChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentBanner(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentBanner ? 'bg-white' : 'bg-white opacity-50'
                }`}
                aria-label={`Go to banner ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Shop by Category Grid */}
      <section className="mb-12">
        <h2 className="text-3xl font-bold mb-6">Shop by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/category/${category.id}`}
              className={`${category.color} p-6 rounded-lg text-center hover:scale-105 transition-transform duration-200 card`}
            >
              <div className="text-5xl mb-3">{category.icon}</div>
              <h3 className="font-semibold text-sm md:text-base">{category.name}</h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">Featured Products</h2>
          <Link
            to="/products"
            className="text-primary-600 dark:text-primary-400 hover:underline font-semibold"
          >
            View All →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.product_id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Categories Section */}
      <section>
        <h2 className="text-3xl font-bold mb-6">Browse Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/category/${category.id}`}
              className="card p-6 text-center hover:shadow-xl transition-shadow"
            >
              <div className="text-4xl mb-3">{category.icon}</div>
              <h3 className="font-semibold">{category.name}</h3>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

export default HomePage



