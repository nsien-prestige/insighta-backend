const pool = require('../db/db')
const { uuidv7 } = require('uuidv7')
const axios = require('axios')
const parseNaturalQuery = require('../utils/queryParser')
const redis = require('../utils/redis')

const getAllProfiles = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 10, 50))
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
            status: 'error',
            message: 'Invalid query parameters'
        })
    }

    if (!allowedSortFields.includes(sortBy) || !allowedOrder.includes(order)) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid query parameters'
        })
    }

    if (isNaN(page) || isNaN(limit)) {
        return res.status(422).json({
            status: 'error',
            message: 'Page and limit must be numbers'
        })
    }

    const offset = (page - 1) * limit

    try {
        // Check Redis cache first
        const cacheKey =`profiles:${JSON.stringify(req.query)}`
        const cache = await redis.get(cacheKey)

        if (cache) {
            return res.status(200).json(JSON.parse(cache))
        }

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
                    status: 'error',
                    message: 'min_age must be a number'
                })
            }
            conditions.push(`age >= $${conditions.length + 1}`)
            values.push(req.query.min_age)
        }

        if (req.query.max_age) {
            if (isNaN(req.query.max_age)) {
                return res.status(422).json({
                    status: 'error',
                    message: 'max_age must be a number'
                })
            }
            conditions.push(`age <= $${conditions.length + 1}`)
            values.push(req.query.max_age)
        }

        if (req.query.min_gender_probability) {
            if (isNaN(req.query.min_gender_probability)) {
                return res.status(422).json({
                    status: 'error',
                    message: 'min_gender_probability must be a number'
                })
            }
            conditions.push(`gender_probability >= $${conditions.length + 1}`)
            values.push(req.query.min_gender_probability)
        }

        if (req.query.min_country_probability) {
            if (isNaN(req.query.min_country_probability)) {
                return res.status(422).json({
                    status: 'error',
                    message: 'min_country_probability must be a number'
                })
            }
            conditions.push(`country_probability >= $${conditions.length + 1}`)
            values.push(req.query.min_country_probability)
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : ''

        values.push(limit, offset)

        const result = await pool.query(
            `SELECT * FROM profiles ${whereClause} ORDER BY ${sortBy} ${order} LIMIT $${values.length - 1} OFFSET $${values.length}`,
            values
        )

        const totalResult = await pool.query(
            `SELECT COUNT(*) FROM profiles ${whereClause}`,
            values.slice(0, -2)
        )

        const total = parseInt(totalResult.rows[0].count)
        const total_pages = Math.ceil(total / limit)

        const baseQuery = new URLSearchParams(req.query)
        baseQuery.set('limit', limit)

        baseQuery.set('page', page)
        const selfLink = `/api/profiles?${baseQuery.toString()}`

        baseQuery.set('page', page + 1)
        const nextLink = page < total_pages ? `/api/profiles?${baseQuery.toString()}` : null

        baseQuery.set('page', page - 1)
        const prevLink = page > 1 ? `/api/profiles?${baseQuery.toString()}` : null

        const responseData = {
            status: 'success',
            page,
            limit,
            total,
            total_pages,
            links: {
                self: selfLink,
                next: nextLink,
                prev: prevLink
            },
            data: result.rows
        }

        await redis.setex(cacheKey, 60, JSON.stringify(responseData))
        res.status(200).json(responseData)

    } catch (err) {
        console.error(err)
        res.status(500).json({ status: 'error', message: 'Internal Server Error' })
    }
}

const searchProfiles = async (req, res) => {
    const { q } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 10, 50))
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
        // Check redis cache first
        const cacheKey = `profiles:search:${JSON.stringify(req.query)}`
        const cache = await redis.get(cacheKey)

        if (cache) {
            return res.status(200).json(JSON.parse(cache))
        }

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

        const total = parseInt(totalResult.rows[0].count)
        const total_pages = Math.ceil(total / limit)

        const baseQuery = new URLSearchParams(req.query)
        baseQuery.set('limit', limit)

        baseQuery.set('page', page)
        const selfLink = `/api/profiles/search?${baseQuery.toString()}`

        baseQuery.set('page', page + 1)
        const nextLink = page < total_pages ? `/api/profiles/search?${baseQuery.toString()}` : null

        baseQuery.set('page', page - 1)
        const prevLink = page > 1 ? `/api/profiles/search?${baseQuery.toString()}` : null

        const responseData = {
            status: 'success',
            page,
            limit,
            total,
            total_pages,
            links: {
                self: selfLink,
                next: nextLink,
                prev: prevLink
            },
            data: result.rows
        }

        await redis.setex(cacheKey, 60, JSON.stringify(responseData))
        res.status(200).json(responseData)
        
    } catch (err) {
        console.error(err)
        res.status(500).json({
            status: 'error',
            message: 'Internal Server Error'
        })
    }
}

const getProfileById = async (req, res) => {
    const { id } = req.params

    try {
        const result = await pool.query(
            `SELECT * FROM profiles WHERE id = $1`,
            [id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Profile not found'
            })
        }

        res.status(200).json({
            status: 'success',
            data: result.rows[0]
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({
            status: 'error',
            message: 'Internal Server Error'
        })
    }
}

const createProfile = async (req, res) => {
    const { name } = req.body

    if (!name || name.trim() === '') {
        return res.status(400).json({
            status: 'error',
            message: 'Name is required'
        })
    }

    try {
        // Call external APIs in parallel
        const [genderRes, ageRes, countryRes] = await Promise.all([
            axios.get(`https://api.genderize.io/?name=${encodeURIComponent(name)}`),
            axios.get(`https://api.agify.io/?name=${encodeURIComponent(name)}`),
            axios.get(`https://api.nationalize.io/?name=${encodeURIComponent(name)}`)
        ])

        const gender = genderRes.data.gender
        const gender_probability = genderRes.data.probability
        const age = ageRes.data.age
        const topCountry = countryRes.data.country?.[0]

        if (!gender || !age || !topCountry) {
            return res.status(422).json({
                status: 'error',
                message: 'Could not determine profile data for this name'
            })
        }

        // Determine age group
        let age_group
        if (age < 13) age_group = 'child'
        else if (age < 18) age_group = 'teenager'
        else if (age < 65) age_group = 'adult'
        else age_group = 'senior'

        // Get country name from country code
        const countryNameRes = await axios.get(
            `https://restcountries.com/v3.1/alpha/${topCountry.country_id}`
        )
        const country_name = countryNameRes.data?.[0]?.name?.common || topCountry.country_id

        const id = uuidv7()

        const result = await pool.query(
            `INSERT INTO profiles 
            (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (name) DO UPDATE SET
                gender = EXCLUDED.gender,
                gender_probability = EXCLUDED.gender_probability,
                age = EXCLUDED.age,
                age_group = EXCLUDED.age_group,
                country_id = EXCLUDED.country_id,
                country_name = EXCLUDED.country_name,
                country_probability = EXCLUDED.country_probability
            RETURNING *`,
            [
                id,
                name,
                gender,
                gender_probability,
                age,
                age_group,
                topCountry.country_id,
                country_name,
                topCountry.probability
            ]
        )

        res.status(201).json({
            status: 'success',
            data: result.rows[0]
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({
            status: 'error',
            message: 'Internal Server Error'
        })
    }
}

const deleteProfile = async (req, res) => {
    const { id } = req.params

    try {
        const result = await pool.query(
            `DELETE FROM profiles WHERE id = $1 RETURNING id`,
            [id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Profile not found'
            })
        }

        res.status(200).json({
            status: 'success',
            message: 'Profile deleted'
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({
            status: 'error',
            message: 'Internal Server Error'
        })
    }
}

const exportProfiles = async (req, res) => {
    const sortBy = req.query.sort_by || 'created_at'
    const order = req.query.order || 'asc'

    const allowedSortFields = ['created_at', 'age', 'gender_probability']
    const allowedOrder = ['asc', 'desc']

    if (!allowedSortFields.includes(sortBy) || !allowedOrder.includes(order)) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid sort parameters'
        })
    }

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
            conditions.push(`age >= $${conditions.length + 1}`)
            values.push(req.query.min_age)
        }

        if (req.query.max_age) {
            conditions.push(`age <= $${conditions.length + 1}`)
            values.push(req.query.max_age)
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : ''

        const result = await pool.query(
            `SELECT id, name, gender, gender_probability, age, age_group, 
                    country_id, country_name, country_probability, created_at 
             FROM profiles ${whereClause} 
             ORDER BY ${sortBy} ${order}`,
            values
        )

        const headers = 'id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at'

        const rows = result.rows.map(row =>
            [
                row.id,
                `"${row.name}"`,
                row.gender,
                row.gender_probability,
                row.age,
                row.age_group,
                row.country_id,
                `"${row.country_name}"`,
                row.country_probability,
                row.created_at
            ].join(',')
        )

        const csv = [headers, ...rows].join('\n')
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', `attachment; filename="profiles_${timestamp}.csv"`)
        res.status(200).send(csv)

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
    searchProfiles,
    getProfileById,
    createProfile,
    deleteProfile,
    exportProfiles
}
