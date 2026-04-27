const { uuidv7 } = require('uuidv7')
const pool = require('./db')
const profiles = require('./seed_profiles.json')

const seed = async () => {
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
    console.log('Seeding complete!')
    process.exit(0)
}

seed()