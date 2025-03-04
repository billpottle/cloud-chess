<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Make sure no output is sent before including files that modify headers
ob_start();

// Include database connection
require_once 'db_connect.php';

// Start session at the very beginning
require_once 'session_config.php';

// Include auth token functions
require_once 'auth_token.php';

// Handle login request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Set header to return JSON for AJAX requests
    header('Content-Type: application/json');
    
    // Get form data
    $username = sanitize_input($conn, $_POST['username']);
    $password = $_POST['password'];
    
    // Validate input
    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Username and password are required']);
        exit;
    }
    
    // Check if user exists
    $query = "SELECT id, username, password_hash, elo FROM users WHERE username = '$username'";
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
        exit;
    }
    
    // Verify password
    $user = $result->fetch_assoc();
    if (!password_verify($password, $user['password_hash'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
        exit;
    }
    
    // Update last login time
    $query = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = " . $user['id'];
    execute_query($conn, $query);
    
    // Start session and store user info
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['elo'] = $user['elo'];
    
    // Set session to expire after 1 hour
    $_SESSION['expires'] = time() + 3600;
    
    // Update user's last activity timestamp
    $current_time = time();
    
    // Check if last_activity column exists before updating
    $check_column_query = "SHOW COLUMNS FROM users LIKE 'last_activity'";
    $column_result = execute_query($conn, $check_column_query);
    
    if ($column_result->num_rows > 0) {
        $update_query = "UPDATE users SET last_activity = $current_time WHERE id = " . $user['id'];
        execute_query($conn, $update_query);
    }
    
    // Create an authentication token
    $token = create_auth_token($user['id']);
    
    // Set a cookie with the token
    if ($token) {
        setcookie('chess_auth_token', $token, time() + 86400, '/cloud-chess/', '', isset($_SERVER['HTTPS']), true);
    }
    
    // Debug information
    error_log("User logged in: " . $user['username'] . " (ID: " . $user['id'] . ")");
    error_log("Session data: " . print_r($_SESSION, true));
    
    echo json_encode(['success' => true, 'message' => 'Login successful', 'token' => $token]);
    
    // Close the database connection
    close_connection($conn);
    exit;
}

// Clear any buffered output before sending the HTML
ob_end_clean();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Chess Game</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        .container {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 400px;
        }
        h1 {
            text-align: center;
            color: #333;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="text"],
        input[type="password"] {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
            font-size: 16px;
        }
        button:hover {
            background-color: #45a049;
        }
        .error {
            color: red;
            margin-bottom: 15px;
        }
        .success {
            color: green;
            margin-bottom: 15px;
        }
        .links {
            text-align: center;
            margin-top: 15px;
        }
        .links a {
            color: #4CAF50;
            text-decoration: none;
            margin: 0 10px;
        }
        .links a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Login</h1>
        <div id="message"></div>
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Login</button>
        </form>
        <div class="links">
            <a href="register.php">Register</a>
            <a href="index.html">Back to Game</a>
        </div>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            
            fetch('login.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                const messageDiv = document.getElementById('message');
                
                if (data.success) {
                    messageDiv.className = 'success';
                    messageDiv.textContent = data.message;
                    // Redirect to index page after 1 second
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);
                } else {
                    messageDiv.className = 'error';
                    messageDiv.textContent = data.message;
                }
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('message').className = 'error';
                document.getElementById('message').textContent = 'An error occurred. Please try again.';
            });
        });
    </script>
</body>
</html> 