const FilterSidebar = ({ filters, setFilters }) => {
  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold mb-4">Filters</h2>
      <div className="space-y-6">
        <div>
          <label className="block font-semibold mb-2">Price Range</label>
          <div className="flex space-x-2">
            <input
              type="number"
              placeholder="Min"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
              value={filters.minPrice || ''}
              onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
            />
            <input
              type="number"
              placeholder="Max"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
              value={filters.maxPrice || ''}
              onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-2">Sort By</label>
          <select
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
          >
            <option value="relevance">Relevance</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default FilterSidebar



