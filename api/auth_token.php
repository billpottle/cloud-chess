<?php
// Include database connection
require_once 'db_connect.php';

// Function to generate a secure token
function generate_token($length = 32) {
    return bin2hex(random_bytes($length));
}

// Function to create an auth token for a user
function create_auth_token($user_id) {
    global $conn;
    
    try {
        // Generate a new token
        $token = generate_token();
        $expires = date('Y-m-d H:i:s', strtotime('+7 days'));
        
        // Delete any existing tokens for this user
        $query = "DELETE FROM user_tokens WHERE user_id = $user_id";
        execute_query($conn, $query);
        
        // Insert the new token
        $query = "INSERT INTO user_tokens (user_id, token, expires_at) 
                VALUES ($user_id, '$token', '$expires')";
        execute_query($conn, $query);
        
        return $token;
    } catch (Exception $e) {
        error_log("Error creating auth token: " . $e->getMessage());
        return false;
    }
}

// Function to validate an auth token
function validate_token($token) {
    global $conn;
    
    // Check if token exists and is valid
    $query = "SELECT ut.user_id, u.username, u.elo 
              FROM user_tokens ut 
              JOIN users u ON ut.user_id = u.id 
              WHERE ut.token = '$token' 
              AND ut.expires_at > NOW()";
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        return false;
    }
    
    return $result->fetch_assoc();
}

// Function to create the tokens table if it doesn't exist
function initialize_tokens_table($conn) {
    try {
        // First check if the table already exists
        $check_query = "SHOW TABLES LIKE 'user_tokens'";
        $result = execute_query($conn, $check_query);
        
        if ($result->num_rows > 0) {
            // Table already exists, no need to create it
            return;
        }
        
        // Create the table without foreign key constraint first
        $query = "CREATE TABLE IF NOT EXISTS user_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY (token)
        )";
        execute_query($conn, $query);
        
        // Now check the users table structure to ensure compatibility
        $users_query = "SHOW COLUMNS FROM users WHERE Field = 'id'";
        $users_result = execute_query($conn, $users_query);
        
        if ($users_result->num_rows > 0) {
            $column = $users_result->fetch_assoc();
            $column_type = $column['Type'];
            
            // If users.id is SERIAL or INT, add the foreign key constraint
            if (strpos($column_type, 'int') !== false) {
                $alter_query = "ALTER TABLE user_tokens 
                                ADD CONSTRAINT fk_user_tokens_user_id 
                                FOREIGN KEY (user_id) REFERENCES users(id) 
                                ON DELETE CASCADE";
                execute_query($conn, $alter_query);
            } else {
                error_log("Warning: Cannot add foreign key constraint - users.id type ($column_type) is not compatible with user_tokens.user_id (INT)");
            }
        }
    } catch (Exception $e) {
        error_log("Error initializing tokens table: " . $e->getMessage());
    }
}

// Initialize tokens table
initialize_tokens_table($conn);
?> 