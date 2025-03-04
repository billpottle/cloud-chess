## Script to create user table

CREATE TABLE users (
    id SERIAL PRIMARY KEY,  -- Unique user ID (auto-incrementing)
    username VARCHAR(50) NOT NULL UNIQUE,  -- Unique username, required
    password_hash TEXT NOT NULL,  -- Securely stored password hash
    email VARCHAR(255) UNIQUE,  -- Optional, but must be unique if provided
    last_login TIMESTAMP DEFAULT NULL,  -- Stores last login time
    wins INT DEFAULT 0 CHECK (wins >= 0),  -- Number of wins, default 0, cannot be negative
    losses INT DEFAULT 0 CHECK (losses >= 0),  -- Number of losses, default 0, cannot be negative
    elo INT DEFAULT 1000 CHECK (elo >= 0),  -- Elo rating, starts at 1000, cannot be negative
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Auto-set timestamp for account creation
);