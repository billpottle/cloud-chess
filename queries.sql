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

CREATE TABLE games (
    id SERIAL PRIMARY KEY,  -- Unique game ID, auto-incrementing
    white_player VARCHAR(50) NOT NULL,  -- References users.username
    black_player VARCHAR(50) NOT NULL,  -- References users.username
    turn ENUM('white', 'black') NOT NULL,  -- Either 'white' or 'black'
    is_complete BOOLEAN DEFAULT FALSE,  -- Whether the game is finished
    board_state TEXT NOT NULL,  -- Stores board state as a FEN string or JSON
    start_timestamp INT NOT NULL,  -- Game start time (Unix timestamp)
    end_timestamp INT DEFAULT NULL,  -- Game end time (NULL if ongoing)
    last_move_timestamp INT DEFAULT NULL,  -- Last move time (Unix timestamp)
    last_move_white VARCHAR(30) DEFAULT NULL,
    last_move_black VARCHAR(30) DEFAULT NULL,
    special_status VARCHAR(50) DEFAULT NULL, -- check, promotion, etc. 
    winner VARCHAR(50) DEFAULT NULL, -- username of the winner
    
    -- Foreign Key Constraints
    CONSTRAINT fk_white FOREIGN KEY (white_player) REFERENCES users(username) ON DELETE RESTRICT,
    CONSTRAINT fk_black FOREIGN KEY (black_player) REFERENCES users(username) ON DELETE RESTRICT
);

CREATE TABLE challenges (
    id SERIAL PRIMARY KEY,  -- Unique challenge ID, auto-incrementing
    challenger VARCHAR(50) NOT NULL,  -- References users.username
    player_being_challenged VARCHAR(50) NOT NULL,  -- References users.username
    accepted BOOLEAN DEFAULT FALSE,  -- Whether the challenge has been accepted
    challenge_timestamp INT NOT NULL,  -- When the challenge was issued (Unix timestamp)
    expires INT DEFAULT NULL,  -- When the challenge expires (Unix timestamp, NULL = no expiration)

    -- Foreign Key Constraints
    CONSTRAINT fk_challenger FOREIGN KEY (challenger) REFERENCES users(username) ON DELETE RESTRICT,
    CONSTRAINT fk_challenged FOREIGN KEY (player_being_challenged) REFERENCES users(username) ON DELETE RESTRICT
);
