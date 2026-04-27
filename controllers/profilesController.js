const pool = require('../db/db')
const parseNaturalQuery = require('../utils/queryParser')

const getAllProfiles = async (req, res) => {
    const page = req.query.page || 1
    const limit = Math.min(req.query.limit || 10, 50)
    const sortBy = req.query.sort_by || 'created_at'
    const order = req.query.order || 'asc'

    const allowedGenders = ['male', 'female']
    const allowedAgeGroups = ['child', 'teenager', 'adult', 'senior']
    const allowedSortFields = ['created_at', 'age', 'gender_probability']
    const allowedOrder = ['asc', 'desc']

    if (
        (req.query.gender && !allowedGenders.includes(req.query.gender)) || 
        (req.query.age_group && !allowedAgeGroups.includes(req.query.age_group))
    ) {
        return res.status(422).json({
            "status": "error",
            "message": "Invalid query parameters"
        })
    }

    if (!allowedSortFields.includes(sortBy) || !allowedOrder.includes(order)) {
        return res.status(400).json({
            "status": "error",
            "message": "Invalid query parameters"
        })
    }

    if (isNaN(page) || isNaN(limit)) {
        return res.status(422).json({
            "status": "error",
            "message": "Page and limit must be numbers"
        })
    }

    const offset = (page - 1) * limit

    try {
        const conditions = []
        const values = []

        if (req.query.gender) {
            conditions.push(`gender = $${conditions.length + 1}`)
            values.push(req.query.gender)
        }

        if (req.query.age_group) {
            conditions.push(`age_group = $${conditions.length + 1}`)
            values.push(req.query.age_group)
        }

        if (req.query.country_id) {
            conditions.push(`country_id = $${conditions.length + 1}`)
            values.push(req.query.country_id)
        }

        if (req.query.min_age) {
            if (isNaN(req.query.min_age)) {
                return res.status(422).json({
                    "status": "error",
                    "message": "min_age must be a number"
                })
            }

            conditions.push(`age >= $${conditions.length + 1}`)
            values.push(req.query.min_age)
        }

        if (req.query.max_age) {
            if (isNaN(req.query.max_age)) {
                return res.status(422).json({
                    "status": "error",
                    "message": "max_age must be a number"
                })
            }

            conditions.push(`age <= $${conditions.length + 1}`)
            values.push(req.query.max_age)
        }

        if (req.query.min_gender_probability) {
            if (isNaN(req.query.min_gender_probability)) {
                return res.status(422).json({
                    "status": "error",
                    "message": "min_gender_probability must be a number"
                })
            }

            conditions.push(`gender_probability >= $${conditions.length + 1}`)
            values.push(req.query.min_gender_probability)
        }

        if (req.query.min_country_probability) {
            if (isNaN(req.query.min_country_probability)) {
                return res.status(422).json({
                    "status": "error",
                    "message": "min_country_probability must be a number"
                })
            }

            conditions.push(`country_probability >= $${conditions.length + 1}`)
            values.push(req.query.min_country_probability)
        }

        // Join conditions with AND and prepend WHERE if there are any conditions
        const whereClause = conditions.length > 0 
            ? `WHERE ${conditions.join(' AND ')}` 
            : ''

        //Push limit and offset after all filters
        values.push(limit, offset)

        const result = await pool.query(
            `SELECT * FROM profiles ${whereClause} ORDER BY ${sortBy} ${order} LIMIT $${values.length - 1} OFFSET $${values.length}`,
            values
        )

        const totalResult = await pool.query(
            `SELECT COUNT(*) FROM profiles ${whereClause}`,
            values.slice(0, -2) // Exclude limit and offset for count query
        )

        res.status(200).json({
            status: 'success',
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(totalResult.rows[0].count), 
            data: result.rows
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ "status": "error", "message": "Internal Server Error" })
    }
}

const searchProfiles = async (req, res) => {
    const { q } = req.query

    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 10, 50)
    const offset = (page - 1) * limit

    if (!q || q.trim() === '') {
        return res.status(400).json({
            status: 'error',
            message: 'Missing query parameter'
        })
    }

    const filters = parseNaturalQuery(q)

    if (!filters || Object.keys(filters).length === 0) {
        return res.status(422).json({
            status: 'error',
            message: 'Unable to interpret query'
        })
    }

    try {
        const conditions = []
        const values = []

        if (filters.gender) {
            conditions.push(`gender = $${values.length + 1}`)
            values.push(filters.gender)
        }

        if (filters.age_group) {
            conditions.push(`age_group = $${values.length + 1}`)
            values.push(filters.age_group)
        }

        if (filters.country_id) {
            conditions.push(`country_id = $${values.length + 1}`)
            values.push(filters.country_id)
        }

        if (filters.min_age) {
            conditions.push(`age >= $${values.length + 1}`)
            values.push(filters.min_age)
        }

        if (filters.max_age) {
            conditions.push(`age <= $${values.length + 1}`)
            values.push(filters.max_age)
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(' AND ')}`
            : ''

        values.push(limit, offset)

        const result = await pool.query(
            `SELECT * FROM profiles
            ${whereClause}
            LIMIT $${values.length - 1}
            OFFSET $${values.length}`,
            values
        )

        const totalResult = await pool.query(
            `SELECT COUNT(*) FROM profiles ${whereClause}`,
            values.slice(0, -2)
        )

        res.status(200).json({
            status: 'success',
            page,
            limit,
            total: parseInt(totalResult.rows[0].count),
            data: result.rows
        })
    } catch (err) {
        console.error(err)

        res.status(500).json({
            status: 'error',
            message: 'Internal Server Error'
        })
    }
}

module.exports = {
    getAllProfiles,
    searchProfiles
}