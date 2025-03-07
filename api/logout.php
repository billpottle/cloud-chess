<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Buffer all output to prevent "headers already sent" errors
ob_start();

// Include database connection
require_once 'db_connect.php';

// Set content type to JSON
header('Content-Type: application/json');

// Get username from request
$username = '';

// Check if this is a POST request with JSON data
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? '';
} else {
    // For GET requests, check query string
    $username = $_GET['username'] ?? '';
}

// If no username provided, return error
if (empty($username)) {
    ob_end_clean(); // Clear the buffer
    echo json_encode(['success' => false, 'message' => 'No username provided']);
    exit;
}

try {
    // Get user ID from username
    $user_query = "SELECT id FROM users WHERE username = ?";
    $user_stmt = $conn->prepare($user_query);
    $user_stmt->bind_param("s", $username);
    $user_stmt->execute();
    $result = $user_stmt->get_result();
    
    if ($result->num_rows === 0) {
        ob_end_clean(); // Clear the buffer
        echo json_encode(['success' => false, 'message' => 'User not found']);
        $user_stmt->close();
        exit;
    }
    
    $user = $result->fetch_assoc();
    $user_id = $user['id'];
    $user_stmt->close();
    
    // Delete all tokens for this user
    $token_query = "DELETE FROM user_tokens WHERE user_id = ?";
    $token_stmt = $conn->prepare($token_query);
    $token_stmt->bind_param("i", $user_id);
    $token_stmt->execute();
    
    // Check if any rows were affected
    ob_end_clean(); // Clear the buffer
    if ($token_stmt->affected_rows > 0) {
        echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
    } else {
        echo json_encode(['success' => true, 'message' => 'No active sessions found']);
    }
    
    // Close the database connection
    $token_stmt->close();
    $conn->close();
} catch (Exception $e) {
    ob_end_clean(); // Clear the buffer
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?> 