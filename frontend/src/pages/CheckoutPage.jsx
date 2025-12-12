import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { orderService } from '../services/orderService'
import toast from 'react-hot-toast'

const CheckoutPage = () => {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zipCode: '',
    paymentMethod: 'credit_card',
  })

  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Prepare order data
      const orderData = {
        total_amount: total,
        shipping: {
          name: state.user?.full_name || 'Guest User',
          email: state.user?.email || 'guest@example.com',
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: 'US',
          phone: state.user?.phone || 'N/A',
          paymentMethod: formData.paymentMethod
        },
        items: state.cart.map(item => ({
          product_id: item.product_id || item.asin,
          asin: item.asin || item.product_id,
          title: item.title,
          quantity: item.quantity,
          price: parseFloat(item.price || item.base_price),
          image_url: item.image_url || item.image
        }))
      }

      // Call order service
      const response = await orderService.createOrder(orderData)
      
      // Clear cart
      dispatch({ type: 'CLEAR_CART' })
      
      // Show success message
      toast.success('Order placed successfully!')
      
      // Navigate to confirmation page
      navigate(`/order-confirmation/${response.order.order_number}`)
    } catch (error) {
      console.error('Order error:', error)
      
      // If authentication error, show login prompt
      if (error.response?.status === 401) {
        toast.error('Please login to place an order')
        navigate('/login')
      } else {
        toast.error(error.response?.data?.message || 'Failed to place order')
      }
    } finally {
      setLoading(false)
    }
  }

  if (state.cart.length === 0) {
    navigate('/cart')
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-2xl font-bold mb-4">Shipping Address</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Address"
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="City"
                className="px-4 py-2 border rounded-lg dark:bg-gray-700"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="State"
                className="px-4 py-2 border rounded-lg dark:bg-gray-700"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                required
              />
            </div>
            <input
              type="text"
              placeholder="ZIP Code"
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              value={formData.zipCode}
              onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              required
            />
          </div>
          <h2 className="text-2xl font-bold mb-4 mt-8">Payment Method</h2>
          <select
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
          >
            <option value="credit_card">Credit Card</option>
            <option value="debit_card">Debit Card</option>
            <option value="upi">UPI</option>
            <option value="wallet">Wallet</option>
          </select>
        </div>
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24">
            <h2 className="text-2xl font-bold mb-4">Order Summary</h2>
            <div className="space-y-2 mb-4">
              {state.cart.map((item) => (
                <div key={item.product_id || item.asin} className="flex justify-between text-sm">
                  <span>{item.title} x{item.quantity}</span>
                  <span>${(parseFloat(item.price || item.base_price) * item.quantity || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 space-y-2">
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
            <button 
              type="submit" 
              className="btn-primary w-full mt-4"
              disabled={loading}
            >
              {loading ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default CheckoutPage