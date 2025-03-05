<?php
// Include database connection
require_once 'db_connect.php';

// Set header to return JSON
header('Content-Type: application/json');

// Handle API requests
$action = isset($_POST['action']) ? $_POST['action'] : '';

switch ($action) {
    case 'register':
        // Get user registration data
        $username = sanitize_input($conn, $_POST['username']);
        $email = sanitize_input($conn, $_POST['email']);
        $password = $_POST['password'];
        
        // Check if username already exists
        $query = "SELECT id FROM users WHERE username = '$username'";
        $result = execute_query($conn, $query);
        
        if ($result->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Username already exists']);
            break;
        }
        
        // Check if email already exists
        if (!empty($email)) {
            $query = "SELECT id FROM users WHERE email = '$email'";
            $result = execute_query($conn, $query);
            
            if ($result->num_rows > 0) {
                echo json_encode(['success' => false, 'message' => 'Email already exists']);
                break;
            }
        }
        
        // Hash the password
        $password_hash = password_hash($password, PASSWORD_DEFAULT);
        
        // Insert new user
        $query = "INSERT INTO users (username, password_hash, email) 
                  VALUES ('$username', '$password_hash', " . ($email ? "'$email'" : "NULL") . ")";
        
        execute_query($conn, $query);
        
        echo json_encode(['success' => true, 'message' => 'Registration successful']);
        break;
        
    case 'login':
        // Get login data
        $username = sanitize_input($conn, $_POST['username']);
        $password = $_POST['password'];
        
        // Get user from database
        $query = "SELECT id, username, password_hash FROM users WHERE username = '$username'";
        $result = execute_query($conn, $query);
        
        if ($result->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
            break;
        }
        
        $user = $result->fetch_assoc();
        
        // Verify password
        if (password_verify($password, $user['password_hash'])) {
            // Update last login time
            $query = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = " . $user['id'];
            execute_query($conn, $query);
            
            // Start session and store user info
            session_start();
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            
            echo json_encode(['success' => true, 'message' => 'Login successful']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
        }
        break;
        
    case 'logout':
        session_start();
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Logout successful']);
        break;
        
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

// Close the database connection
close_connection($conn);
?> 