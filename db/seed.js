require('dotenv').config()
const { uuidv7 } = require('uuidv7')
const pool = require('./db')
const profiles = require('./seed_profiles.json')

const seed = async () => {
    // Seed profiles
    for (const profile of profiles.profiles) {
        await pool.query(
            `INSERT INTO profiles (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (name) DO NOTHING`,
            [
                uuidv7(),
                profile.name,
                profile.gender,
                profile.gender_probability,
                profile.age,
                profile.age_group,
                profile.country_id,
                profile.country_name,
                profile.country_probability
            ]
        )
    }
    console.log('Profiles seeded!')

    // Ensure admin test user exists
    const adminCheck = await pool.query(
        `SELECT id FROM users WHERE role = 'admin' AND is_active = true LIMIT 1`
    )
    if (adminCheck.rows.length === 0) {
        await pool.query(
            `INSERT INTO users (id, github_id, username, email, avatar_url, role, is_active, last_login_at, created_at)
             VALUES ($1, $2, $3, $4, $5, 'admin', true, NOW(), NOW())
             ON CONFLICT (github_id) DO NOTHING`,
            [uuidv7(), 'test-admin-001', 'test_admin', 'admin@insighta.dev', null]
        )
        console.log('Admin user created!')
    } else {
        console.log('Admin user already exists')
    }

    // Ensure analyst test user exists
    const analystCheck = await pool.query(
        `SELECT id FROM users WHERE role = 'analyst' AND is_active = true LIMIT 1`
    )
    if (analystCheck.rows.length === 0) {
        await pool.query(
            `INSERT INTO users (id, github_id, username, email, avatar_url, role, is_active, last_login_at, created_at)
             VALUES ($1, $2, $3, $4, $5, 'analyst', true, NOW(), NOW())
             ON CONFLICT (github_id) DO NOTHING`,
            [uuidv7(), 'test-analyst-001', 'test_analyst', 'analyst@insighta.dev', null]
        )
        console.log('Analyst user created!')
    } else {
        console.log('Analyst user already exists')
    }

    console.log('Seeding complete!')
    process.exit(0)
}

seed()