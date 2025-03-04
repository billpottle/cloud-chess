<?php
// Start session
require_once 'session_config.php';
require_once 'db_connect.php';

// Clear the auth token cookie
setcookie('chess_auth_token', '', time() - 3600, '/cloud-chess/');

// If user is logged in, remove their token from the database
if (isset($_SESSION['user_id'])) {
    $user_id = $_SESSION['user_id'];
    $query = "DELETE FROM user_tokens WHERE user_id = $user_id";
    execute_query($conn, $query);
}

// Clear all session variables
$_SESSION = array();

// Destroy the session
session_destroy();

// Return success response
header('Content-Type: application/json');
echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
?> 