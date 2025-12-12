import api from './api'

export const authService = {
  register: async (userData) => {
    const response = await api.post('/users/register', userData)
    return response.data
  },

  login: async (email, password) => {
    const response = await api.post('/users/login', { email, password })
    if (response.data.token) {
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
    return response.data
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },

  getProfile: async () => {
    const response = await api.get('/users/profile')
    return response.data
  },

  updateProfile: async (userData) => {
    const response = await api.put('/users/profile', userData)
    return response.data
  },
}



