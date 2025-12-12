import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import FilterSidebar from '../components/FilterSidebar'
import { productService } from '../services/productService'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const ProductListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
    limit: 30
  })
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || searchParams.get('q') || null,
    minPrice: null,
    maxPrice: null,
    sortBy: 'relevance',
  })

  useEffect(() => {
    const page = parseInt(searchParams.get('page')) || 1
    loadProducts(page)
  }, [searchParams])

  const loadProducts = async (page = 1) => {
    setLoading(true)
    try {
      const category = searchParams.get('category')
      const query = searchParams.get('q')
      
      let response
      const params = { 
        limit: pagination.limit,
        page: page
      }

      if (category) {
        response = await productService.getProductsByCategory(category, params)
      } else if (query) {
        response = await productService.searchProducts(query, params)
      } else {
        response = await productService.getProducts(params)
      }
      
      setProducts(response.products || generateMockProducts(20))
      
      // Update pagination info
      if (response.pagination) {
        setPagination({
          currentPage: response.pagination.page || page,
          totalPages: response.pagination.totalPages || 1,
          totalProducts: response.pagination.total || response.total || 0,
          limit: response.pagination.limit || pagination.limit
        })
      } else {
        // If no pagination info, calculate from total
        const total = response.total || response.products?.length || 0
        setPagination({
          currentPage: page,
          totalPages: Math.ceil(total / pagination.limit),
          totalProducts: total,
          limit: pagination.limit
        })
      }
    } catch (error) {
      console.error('Error loading products:', error)
      setProducts(generateMockProducts(20))
    } finally {
      setLoading(false)
    }
  }

  const generateMockProducts = (count) => {
    const categories = ['PANTS', 'CELLULAR_PHONE_CASE', 'HEALTH_PERSONAL_CARE', 'NUTRITIONAL_SUPPLEMENT']
    return Array.from({ length: count }, (_, i) => ({
      product_id: `mock-${i + 1}`,
      title: `Product ${i + 1}`,
      base_price: parseFloat((Math.random() * 100 + 10).toFixed(2)),
      image_url: `https://picsum.photos/300/300?random=${i + 1}`,
      rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
      review_count: Math.floor(Math.random() * 1000),
      category_id: categories[i % categories.length],
    }))
  }

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    
    // Update URL with new page
    const params = new URLSearchParams(searchParams)
    params.set('page', newPage)
    setSearchParams(params)
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderPagination = () => {
    const { currentPage, totalPages } = pagination
    
    if (totalPages <= 1) return null

    const pages = []
    const maxVisiblePages = 5
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    return (
      <div className="flex items-center justify-center gap-2 mt-8">
        {/* Previous Button */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FiChevronLeft />
          Previous
        </button>

        {/* First Page */}
        {startPage > 1 && (
          <>
            <button
              onClick={() => handlePageChange(1)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              1
            </button>
            {startPage > 2 && <span className="px-2">...</span>}
          </>
        )}

        {/* Page Numbers */}
        {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((page) => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`px-4 py-2 border rounded-lg ${
              page === currentPage
                ? 'bg-primary-600 text-white border-primary-600'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {page}
          </button>
        ))}

        {/* Last Page */}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2">...</span>}
            <button
              onClick={() => handlePageChange(totalPages)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next Button */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Next
          <FiChevronRight />
        </button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <FilterSidebar filters={filters} setFilters={setFilters} />
        </aside>
        <main className="flex-1">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">
              {searchParams.get('q') ? `Search: "${searchParams.get('q')}"` : 'All Products'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {pagination.totalProducts} products found
              {pagination.totalPages > 1 && ` • Page ${pagination.currentPage} of ${pagination.totalPages}`}
            </p>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.product_id || product.asin} product={product} />
                ))}
              </div>
              
              {renderPagination()}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default ProductListPage