import { createContext, useContext, useReducer, useEffect } from 'react'

const AppContext = createContext()

const initialState = {
  user: null,
  cart: [],
  cartCount: 0,
  darkMode: localStorage.getItem('darkMode') === 'true',
  searchQuery: '',
  selectedCategory: null,
}

const appReducer = (state, action) => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload }
    case 'LOGOUT':
      return { ...state, user: null, cart: [], cartCount: 0 }
    case 'ADD_TO_CART':
      const existingItem = state.cart.find(item => item.product_id === action.payload.product_id)
      const cartItem = {
        ...action.payload,
        price: parseFloat(action.payload.price) || 0 
      }
      const updatedCart = existingItem
        ? state.cart.map(item =>
            item.product_id === action.payload.product_id
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item
          )
        : [...state.cart, cartItem]
      return {
        ...state,
        cart: updatedCart,
        cartCount: updatedCart.reduce((sum, item) => sum + item.quantity, 0),
      }
    case 'REMOVE_FROM_CART':
      const filteredCart = state.cart.filter(item => item.product_id !== action.payload)
      return {
        ...state,
        cart: filteredCart,
        cartCount: filteredCart.reduce((sum, item) => sum + item.quantity, 0),
      }
    case 'UPDATE_CART_ITEM':
      const updatedItems = state.cart.map(item =>
        item.product_id === action.payload.product_id
          ? { ...item, quantity: action.payload.quantity }
          : item
      )
      return {
        ...state,
        cart: updatedItems,
        cartCount: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
      }
    case 'CLEAR_CART':
      return { ...state, cart: [], cartCount: 0 }
    case 'TOGGLE_DARK_MODE':
      const newDarkMode = !state.darkMode
      localStorage.setItem('darkMode', newDarkMode)
      return { ...state, darkMode: newDarkMode }
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload }
    case 'SET_CATEGORY':
      return { ...state, selectedCategory: action.payload }
    default:
      return state
  }
}

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [state.darkMode])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}



