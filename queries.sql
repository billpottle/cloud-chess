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

CREATE TABLE game_usage (
    game_type VARCHAR(50) NOT NULL UNIQUE,  -- Unique type of usage
    number INT DEFAULT 0 CHECK (number >= 0)  -- Usage count, default 0, cannot be negative
);

INSERT INTO game_usage (game_type, number) VALUES
    ('Player Vs Player (Local)', 0),
    ('Vs Computer Level 1', 0),
    ('Vs Computer Level 2', 0),
    ('Vs Computer Level 3', 0);