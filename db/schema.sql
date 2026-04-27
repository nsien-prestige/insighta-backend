CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    gender VARCHAR CHECK (gender IN ('male', 'female')) NOT NULL,
    gender_probability FLOAT NOT NULL,
    age INT NOT NULL,
    age_group VARCHAR CHECK (age_group IN ('child', 'teenager', 'adult', 'senior')) NOT NULL,
    country_id VARCHAR(2) NOT NULL,
    country_name VARCHAR NOT NULL,
    country_probability FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    github_id VARCHAR UNIQUE NOT NULL,
    username VARCHAR NOT NULL,
    email VARCHAR,
    avatar_url VARCHAR,
    role VARCHAR CHECK (role IN ('admin', 'analyst')) DEFAULT 'analyst',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gender ON profiles(gender);
CREATE INDEX IF NOT EXISTS idx_age_group ON profiles(age_group);
CREATE INDEX IF NOT EXISTS idx_country_id ON profiles(country_id);
CREATE INDEX IF NOT EXISTS idx_age ON profiles(age);
CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_token_user ON refresh_tokens(user_id);