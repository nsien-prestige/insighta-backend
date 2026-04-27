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

CREATE INDEX idx_gender ON profiles(gender);
CREATE INDEX idx_age_group ON profiles(age_group);
CREATE INDEX idx_country_id ON profiles(country_id);
CREATE INDEX idx_age ON profiles(age);