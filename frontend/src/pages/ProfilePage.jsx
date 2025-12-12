import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { authService } from '../services/authService'
import toast from 'react-hot-toast'

const ProfilePage = () => {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
  })

  useEffect(() => {
    const user = state.user || JSON.parse(localStorage.getItem('user') || 'null')
    if (!user) {
      navigate('/login')
      return
    }
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
    })
  }, [state.user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await authService.updateProfile(formData)
      toast.success('Profile updated successfully!')
    } catch (error) {
      toast.error(error.response?.data?.message || 'An error occurred')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Profile</h1>
      <div className="max-w-2xl card p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold mb-2">Full Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-2">Email</label>
            <input
              type="email"
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-2">Phone</label>
            <input
              type="tel"
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn-primary">
            Update Profile
          </button>
        </form>
      </div>
    </div>
  )
}

export default ProfilePage



