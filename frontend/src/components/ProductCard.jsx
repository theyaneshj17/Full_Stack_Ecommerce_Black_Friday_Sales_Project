import { Link } from 'react-router-dom'
import { FiShoppingCart, FiStar } from 'react-icons/fi'
import { useApp } from '../context/AppContext'
import toast from 'react-hot-toast'

const ProductCard = ({ product }) => {
  const { dispatch } = useApp()

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch({
      type: 'ADD_TO_CART',
      payload: {
        product_id: product.product_id || product.asin,
        title: product.title,
        price: product.price || product.base_price,
        image_url: product.image_url || product.image,
        quantity: 1,
      },
    })
    toast.success('Added to cart!')
  }

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating || 0)
    const hasHalfStar = (rating || 0) % 1 >= 0.5

    for (let i = 0; i < fullStars; i++) {
      stars.push(<FiStar key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)
    }
    if (hasHalfStar) {
      stars.push(<FiStar key="half" className="w-4 h-4 fill-yellow-400 text-yellow-400 opacity-50" />)
    }
    for (let i = stars.length; i < 5; i++) {
      stars.push(<FiStar key={i} className="w-4 h-4 text-gray-300" />)
    }
    return stars
  }

  // Support both API field names: price (from API) and base_price (from mock data)
  const displayPrice = product.price || product.base_price || 0
  const productImage = product.image_url || product.image || '/placeholder-product.jpg'

  return (
    <Link to={`/products/${product.product_id || product.asin}`} className="card p-4 group">
      <div className="relative aspect-square mb-4 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
        <img
          src={productImage}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/300x300?text=Product'
          }}
        />
      </div>
      <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {product.title}
      </h3>
      <div className="flex items-center space-x-1 mb-2">
        {renderStars(product.rating || 4.5)}
        <span className="text-sm text-gray-600 dark:text-gray-400">
          ({product.review_count || Math.floor(Math.random() * 1000)})
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            ${(parseFloat(displayPrice) || 0).toFixed(2)}
          </span>
          {product.original_price && parseFloat(product.original_price) > parseFloat(displayPrice) && (
            <span className="ml-2 text-sm text-gray-500 line-through">
              ${parseFloat(product.original_price).toFixed(2)}
            </span>
          )}
        </div>
        <button
          onClick={handleAddToCart}
          className="btn-primary flex items-center space-x-1"
          aria-label="Add to cart"
        >
          <FiShoppingCart className="w-5 h-5" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>
    </Link>
  )
}

export default ProductCard