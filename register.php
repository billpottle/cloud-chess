<?php
// Include database connection
require_once 'db_connect.php';

// Set header to return JSON for AJAX requests
header('Content-Type: application/json');

// Function to create users table if it doesn't exist
function initialize_users_table($conn) {
    $query = "CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email VARCHAR(255) UNIQUE,
        last_login TIMESTAMP DEFAULT NULL,
        wins INT DEFAULT 0 CHECK (wins >= 0),
        losses INT DEFAULT 0 CHECK (losses >= 0),
        elo INT DEFAULT 1000 CHECK (elo >= 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    execute_query($conn, $query);
}

// Initialize users table
initialize_users_table($conn);

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get form data
    $username = sanitize_input($conn, $_POST['username']);
    $password = $_POST['password'];
    $email = sanitize_input($conn, $_POST['email']);
    
    // Validate input
    $errors = [];
    
    // Username validation
    if (empty($username)) {
        $errors[] = "Username is required";
    } elseif (strlen($username) < 3 || strlen($username) > 50) {
        $errors[] = "Username must be between 3 and 50 characters";
    }
    
    // Password validation
    if (empty($password)) {
        $errors[] = "Password is required";
    } elseif (strlen($password) < 8) {
        $errors[] = "Password must be at least 8 characters";
    }
    
    // Email validation
    if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = "Invalid email format";
    }
    
    // Check if username already exists
    $query = "SELECT id FROM users WHERE username = '$username'";
    $result = execute_query($conn, $query);
    if ($result->num_rows > 0) {
        $errors[] = "Username already taken";
    }
    
    // Check if email already exists (if provided)
    if (!empty($email)) {
        $query = "SELECT id FROM users WHERE email = '$email'";
        $result = execute_query($conn, $query);
        if ($result->num_rows > 0) {
            $errors[] = "Email already registered";
        }
    }
    
    // If there are errors, return them
    if (!empty($errors)) {
        echo json_encode(['success' => false, 'errors' => $errors]);
        exit;
    }
    
    // Hash the password
    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    
    // Insert new user
    $email_value = empty($email) ? "NULL" : "'$email'";
    $query = "INSERT INTO users (username, password_hash, email) 
              VALUES ('$username', '$password_hash', $email_value)";
    
    try {
        execute_query($conn, $query);
        echo json_encode(['success' => true, 'message' => 'Registration successful']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'errors' => ['Registration failed: ' . $e->getMessage()]]);
    }
    
    // Close the database connection
    close_connection($conn);
    exit;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - Chess Game</title>
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
        input[type="password"],
        input[type="email"] {
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
        }
        .links a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Register</h1>
        <div id="message"></div>
        <form id="registerForm">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <div class="form-group">
                <label for="email">Email (optional):</label>
                <input type="email" id="email" name="email">
            </div>
            <button type="submit">Register</button>
        </form>
        <div class="links">
            <a href="index.html">Back to Game</a>
        </div>
    </div>

    <script>
        document.getElementById('registerForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            
            fetch('register.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                const messageDiv = document.getElementById('message');
                
                if (data.success) {
                    messageDiv.className = 'success';
                    messageDiv.textContent = data.message;
                    // Redirect to index page after 2 seconds
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                } else {
                    messageDiv.className = 'error';
                    messageDiv.innerHTML = data.errors.join('<br>');
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