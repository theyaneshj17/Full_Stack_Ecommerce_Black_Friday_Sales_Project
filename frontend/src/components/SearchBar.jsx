import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import { useApp } from '../context/AppContext'

const SearchBar = () => {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { dispatch } = useApp()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) {
      dispatch({ type: 'SET_SEARCH_QUERY', payload: query })
      navigate(`/products?q=${encodeURIComponent(query)}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for products..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
        />
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
      </div>
    </form>
  )
}

export default SearchBar



