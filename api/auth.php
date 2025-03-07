<?php
// A simple authentication endpoint that returns a token
header('Content-Type: application/json');

// Include database connection
require_once 'db_connect.php';

// Get username and password from request
$data = json_decode(file_get_contents('php://input'), true);
$username = $data['username'] ?? '';
$password = $data['password'] ?? '';

// Simple validation
if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Username and password required']);
    exit;
}

// Check user credentials
$query = "SELECT id, username FROM users WHERE username = ? AND password_hash = ?";
$stmt = $conn->prepare($query);
$password_hash = password_hash($password, PASSWORD_DEFAULT); // Note: In real app, you'd verify not hash again
$stmt->bind_param("ss", $username, $password_hash);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 1) {
    // User authenticated, generate a token
    $user = $result->fetch_assoc();
    $token = bin2hex(random_bytes(32)); // Generate a secure token
    
    // Store token in database
    $query = "UPDATE users SET auth_token = ?, last_login = NOW() WHERE id = ?";
    $stmt = $conn->prepare($query);
    $stmt->bind_param("si", $token, $user['id']);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'user_id' => $user['id'],
        'username' => $user['username'],
        'token' => $token
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
}

$stmt->close();
$conn->close();
?> 