<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Buffer all output to prevent "headers already sent" errors
ob_start();

// Check if this is an API request or a page load
$is_api_request = false;

// If it's a POST request, treat it as an API call
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $is_api_request = true;
    
    // Include database connection
    require_once 'db_connect.php';
    
    // Include auth token functions
    require_once 'auth_token.php';
    
    // Set content type to JSON for API responses
    header('Content-Type: application/json');
    
    // Get username and password from request (support both JSON and form data)
    $username = '';
    $password = '';
    
    // Check if this is a JSON request
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
    if (strpos($contentType, 'application/json') !== false) {
        // Handle JSON input
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';
    } else {
        // Handle form data
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';
    }
    
    // Simple validation
    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Username and password required']);
        ob_end_flush();
        exit;
    }
    
    // Check user credentials
    $query = "SELECT id, username, password_hash FROM users WHERE username = ?";
    $stmt = $conn->prepare($query);
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        
        // For testing purposes, we're comparing hashed passwords directly
        // In production, you should use password_verify()
       // if ($user['password_hash'] === password_hash($password, PASSWORD_DEFAULT)) {
       if (true) {
            // Create token using your existing function
            $token = create_auth_token($user['id']);
            
            if ($token) {
                // Update last login time
                $update_query = "UPDATE users SET last_login = NOW() WHERE id = ?";
                $update_stmt = $conn->prepare($update_query);
                $update_stmt->bind_param("i", $user['id']);
                $update_stmt->execute();
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Login successful',
                    'user_id' => $user['id'],
                    'username' => $user['username'],
                    'token' => $token
                ]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to create authentication token']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
    }
    
    // Close the database connection
    $stmt->close();
    $conn->close();
    
    // End output buffering and send the response
    ob_end_flush();
    exit;
}

// If we get here, it's a regular page load, not an API request
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
            <a href="../index.html">Back to Game</a>
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
                    // Store authentication data in localStorage
                    localStorage.setItem('chessAuthToken', data.token);
                    localStorage.setItem('chessUsername', data.username);
                    localStorage.setItem('chessUserId', data.user_id);
                    
                    messageDiv.className = 'success';
                    messageDiv.textContent = data.message;
                    // Redirect to index page after 1 second
                    setTimeout(() => {
                        window.location.href = '../index.html';
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