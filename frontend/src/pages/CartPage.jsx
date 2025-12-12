import { Link } from 'react-router-dom'
import { FiTrash2, FiMinus, FiPlus } from 'react-icons/fi'
import { useApp } from '../context/AppContext'
import toast from 'react-hot-toast'

const CartPage = () => {
  const { state, dispatch } = useApp()

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      dispatch({ type: 'REMOVE_FROM_CART', payload: productId })
      toast.success('Item removed from cart')
    } else {
      dispatch({ type: 'UPDATE_CART_ITEM', payload: { product_id: productId, quantity: newQuantity } })
    }
  }

  const removeItem = (productId) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: productId })
    toast.success('Item removed from cart')
  }

  const subtotal = state.cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  if (state.cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Your cart is empty</h2>
        <Link to="/products" className="btn-primary inline-block">
          Continue Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {state.cart.map((item) => (
            <div key={item.product_id} className="card p-4 flex gap-4">
              <img
                src={item.image_url || 'https://via.placeholder.com/150'}
                alt={item.title}
                className="w-24 h-24 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-primary-600 dark:text-primary-400 font-bold mb-4">
                  ${(parseFloat(item.price) || 0).toFixed(2)}
                </p>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 border rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <FiMinus />
                    </button>
                    <span className="px-4">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <FiPlus />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24">
            <h2 className="text-2xl font-bold mb-4">Order Summary</h2>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
            <Link to="/checkout" className="btn-primary w-full text-center block">
              Proceed to Checkout
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CartPage



