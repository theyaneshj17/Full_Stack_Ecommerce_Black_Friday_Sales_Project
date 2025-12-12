import { useParams, Link } from 'react-router-dom'
import { FiCheckCircle } from 'react-icons/fi'

const OrderConfirmationPage = () => {
  const { orderId } = useParams()

  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <FiCheckCircle className="w-24 h-24 text-green-500 mx-auto mb-6" />
      <h1 className="text-4xl font-bold mb-4">Order Confirmed!</h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
        Your order has been placed successfully.
      </p>
      <p className="text-lg mb-8">
        Order ID: <span className="font-semibold">{orderId}</span>
      </p>
      <div className="flex justify-center space-x-4">
        <Link to="/orders" className="btn-primary">
          View Orders
        </Link>
        <Link to="/products" className="btn-secondary">
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}

export default OrderConfirmationPage



