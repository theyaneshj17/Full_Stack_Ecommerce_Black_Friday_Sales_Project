import { Link } from 'react-router-dom'

const OrderHistoryPage = () => {
  // Mock orders data
  const orders = [
    {
      order_id: 'ORD-123456',
      order_date: '2024-01-15',
      total_amount: 129.99,
      status: 'DELIVERED',
      items: [{ title: 'Product 1', quantity: 2 }],
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Order History</h1>
      {orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">No orders yet</p>
          <Link to="/products" className="btn-primary">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.order_id} className="card p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Order #{order.order_id}</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Placed on {new Date(order.order_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl">${order.total_amount.toFixed(2)}</p>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                    {order.status}
                  </span>
                </div>
              </div>
              <Link
                to={`/orders/${order.order_id}`}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                View Details →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default OrderHistoryPage



