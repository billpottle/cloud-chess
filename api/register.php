<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Start session
session_start();

// Include database connection
require_once 'db_connect.php';

// Initialize variables
$username = '';
$email = '';
$error = '';
$success = '';

// Process form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get form data
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? ''); // Email is optional
    $password = $_POST['password'] ?? '';
    
    // Validate input
    if (empty($username)) {
        $error = 'Username is required';
    } elseif (empty($password)) {
        $error = 'Password is required';
    } elseif (strlen($password) < 8) {
        $error = 'Password must be at least 8 characters long';
    } else {
        // Check if username already exists
        $query = "SELECT id FROM users WHERE username = ?";
        $stmt = $conn->prepare($query);
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $error = 'Username already exists';
        } else {
            // Check if email already exists (only if email is provided)
            if (!empty($email)) {
                $query = "SELECT id FROM users WHERE email = ?";
                $stmt = $conn->prepare($query);
                $stmt->bind_param('s', $email);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($result->num_rows > 0) {
                    $error = 'Email already exists';
                }
            }
            
            // If no errors, proceed with registration
            if (empty($error)) {
                // Hash password
                $hashed_password = password_hash($password, PASSWORD_DEFAULT);
                
                // If email is empty, set it to NULL in the database
                if (empty($email)) {
                    // Insert new user with NULL email
                    $query = "INSERT INTO users (username, email, password_hash, created_at, elo, wins, losses) 
                              VALUES (?, NULL, ?, NOW(), 1200, 0, 0)";
                    $stmt = $conn->prepare($query);
                    $stmt->bind_param('ss', $username, $hashed_password);
                } else {
                    // Insert new user with provided email
                    $query = "INSERT INTO users (username, email, password_hash, created_at, elo, wins, losses) 
                              VALUES (?, ?, ?, NOW(), 1200, 0, 0)";
                    $stmt = $conn->prepare($query);
                    $stmt->bind_param('sss', $username, $email, $hashed_password);
                }
                
                if ($stmt->execute()) {
                    $success = 'Registration successful! You can now log in.';
                    // Clear form data
                    $username = '';
                    $email = '';
                } else {
                    $error = 'Registration failed: ' . $conn->error;
                }
            }
        }
    }
}

// Close the database connection
close_connection($conn);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - Cloud Chess</title>
    <link rel="stylesheet" href="../css/main.css">
    <style>
        .form-container {
            max-width: 500px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f9f9f9;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
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
        input[type="email"],
        input[type="password"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
        }
        
        .btn-primary {
            background-color: #4CAF50;
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        
        .btn-primary:hover {
            background-color: #45a049;
        }
        
        .error-message {
            color: #f44336;
            margin-bottom: 15px;
        }
        
        .success-message {
            color: #4CAF50;
            margin-bottom: 15px;
        }
        
        .login-link {
            text-align: center;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="navbar">
        <a href="../index.html">Home</a>
        <a href="../api/login.php">Login</a>
    </div>
    
    <div class="container">
        <div class="form-container">
            <h1>Register for Cloud Chess</h1>
            
            <?php if (!empty($error)): ?>
                <div class="error-message"><?php echo $error; ?></div>
            <?php endif; ?>
            
            <?php if (!empty($success)): ?>
                <div class="success-message"><?php echo $success; ?></div>
            <?php endif; ?>
            
            <form method="post" action="register.php">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" value="<?php echo htmlspecialchars($username); ?>" required>
                </div>
                
                <div class="form-group">
                    <label for="email">Email (optional)</label>
                    <input type="email" id="email" name="email" value="<?php echo htmlspecialchars($email); ?>">
                </div>
                
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required>
                    <small>Password must be at least 8 characters long</small>
                </div>
                
                <div class="form-group">
                    <button type="submit" class="btn-primary">Register</button>
                </div>
            </form>
            
            <div class="login-link">
                Already have an account? <a href="login.php">Login here</a>
            </div>
        </div>
    </div>
    
    <script>
        // Client-side validation
        document.querySelector('form').addEventListener('submit', function(e) {
            const password = document.getElementById('password').value;
            
            if (password.length < 8) {
                e.preventDefault();
                alert('Password must be at least 8 characters long');
            }
        });
    </script>
</body>
</html> 