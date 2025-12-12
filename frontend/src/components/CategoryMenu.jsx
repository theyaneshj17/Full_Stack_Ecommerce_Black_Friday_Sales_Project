import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const categories = [
  { id: 'ABIS_BOOK', name: 'Books'},
  { id: 'PET_FOOD', name: 'Pet Food'},
  { id: 'GIFT_CARD', name: 'Gift Cards'},
  { id: 'SHIRT', name: 'Shirts' },
  { id: 'ELECTRONIC_CABLE', name: 'Electronics' },
  { id: 'HEALTH_PERSONAL_CARE', name: 'Health & Personal Care'},
  { id: 'NUTRITIONAL_SUPPLEMENT', name: 'Nutritional Supplements' },
  { id: 'MEDICATION', name: 'Medications' },
  { id: 'PANTS', name: 'Pants' },
  { id: 'CELLULAR_PHONE_CASE', name: 'Phone Cases' },
]

const CategoryMenu = ({ mobile = false }) => {
  const { dispatch } = useApp()

  const handleCategoryClick = (categoryId) => {
    dispatch({ type: 'SET_CATEGORY', payload: categoryId })
  }

  const baseClasses = mobile
    ? 'flex flex-col space-y-2'
    : 'flex items-center space-x-6 overflow-x-auto py-2'

  return (
    <nav className={baseClasses}>
      {categories.map((category) => (
        <Link
          key={category.id}
          to={`/category/${category.id}`}
          onClick={() => handleCategoryClick(category.id)}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
        >
          
          <span className="text-sm font-medium">{category.name}</span>
        </Link>
      ))}
    </nav>
  )
}

export default CategoryMenu



