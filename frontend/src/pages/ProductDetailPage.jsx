import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FiShoppingCart, FiStar, FiMinus, FiPlus } from 'react-icons/fi'
import { useApp } from '../context/AppContext'
import { productService } from '../services/productService'
import toast from 'react-hot-toast'

const ProductDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { dispatch } = useApp()
  const [product, setProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProduct()
  }, [id])

  const loadProduct = async () => {
    try {
      const response = await productService.getProduct(id)
      setProduct(response.product || generateMockProduct())
    } catch (error) {
      setProduct(generateMockProduct())
    } finally {
      setLoading(false)
    }
  }

  const generateMockProduct = () => ({
    product_id: id,
    title: 'Sample Product',
    description: 'This is a sample product description.',
    base_price: 29.99,
    image_url: 'https://picsum.photos/600/600?random=1',
    rating: 4.5,
    review_count: 123,
    category_id: 'PANTS',
  })

  const handleAddToCart = () => {
    dispatch({
      type: 'ADD_TO_CART',
      payload: {
        product_id: product.product_id,
        title: product.title,
        price: product.base_price,
        image_url: product.image_url,
        quantity,
      },
    })
    toast.success('Added to cart!')
  }

  const handleBuyNow = () => {
    handleAddToCart()
    navigate('/checkout')
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!product) {
    return <div className="container mx-auto px-4 py-8">Product not found</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          <img
            src={product.image_url}
            alt={product.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/600x600?text=Product'
            }}
          />
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-4">{product.title}</h1>
          <div className="flex items-center space-x-2 mb-4">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <FiStar
                  key={i}
                  className={`w-5 h-5 ${
                    i < Math.floor(product.rating || 0)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-gray-600 dark:text-gray-400">
              ({product.review_count} reviews)
            </span>
          </div>
          <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-6">
            ${(parseFloat(product.base_price) || 0).toFixed(2)}
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{product.description}</p>
          <div className="mb-6">
            <label className="block mb-2 font-semibold">Quantity</label>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FiMinus />
              </button>
              <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="p-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FiPlus />
              </button>
            </div>
          </div>
          <div className="flex space-x-4">
            <button onClick={handleAddToCart} className="btn-primary flex-1 flex items-center justify-center space-x-2">
              <FiShoppingCart className="w-5 h-5" />
              <span>Add to Cart</span>
            </button>
            <button onClick={handleBuyNow} className="btn-secondary flex-1">
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetailPage



