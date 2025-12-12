import api from './api'

export const productService = {
  getProducts: async (params = {}) => {
    const response = await api.get('/products', { params })
    return response.data
  },

  getProduct: async (id) => {
    const response = await api.get(`/products/${id}`)
    return response.data
  },

  searchProducts: async (query, params = {}) => {
    const response = await api.get('/products/search', {
      params: { q: query, ...params },
    })
    return response.data
  },

  getProductsByCategory: async (category, params = {}) => {
    const response = await api.get(`/products/category/${category}`, { params })
    return response.data
  },
}



