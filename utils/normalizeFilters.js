const normalizeFilters = (filters) => {
    const filterKey = Object.keys(filters).sort()

    const normalized = {}

    filterKey.forEach(key => {
        normalized[key] = filters[key]
    })

    return normalized
}

module.exports = normalizeFilters