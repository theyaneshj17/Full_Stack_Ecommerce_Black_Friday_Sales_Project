import api from './api'

export const orderService = {
  createOrder: async (orderData) => {
    const response = await api.post('/orders', orderData)
    return response.data
  },

  getOrders: async () => {
    const response = await api.get('/orders')
    return response.data
  },

  getOrder: async (orderId) => {
    const response = await api.get(`/orders/${orderId}`)
    return response.data
  },

  cancelOrder: async (orderId) => {
    const response = await api.put(`/orders/${orderId}/cancel`)
    return response.data
  },
}