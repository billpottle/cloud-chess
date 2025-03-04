<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Make sure no output is sent before including files that modify headers
ob_start();

// Start session
require_once 'session_config.php';

// Include database connection for getting ELO
require_once 'db_connect.php';
require_once 'auth_token.php';

// Set header to return JSON
header('Content-Type: application/json');

// Check if user is logged in via session
$logged_in = isset($_SESSION['user_id']);
$user_data = null;

// Debug information
error_log("Session check - Logged in via session: " . ($logged_in ? "Yes" : "No"));

// If not logged in via session, check for token
if (!$logged_in && isset($_COOKIE['chess_auth_token'])) {
    $token = $_COOKIE['chess_auth_token'];
    $user_data = validate_token($token);
    $logged_in = ($user_data !== false);
    
    error_log("Session check - Logged in via token: " . ($logged_in ? "Yes" : "No"));
    
    // If token is valid but session is not set, recreate the session
    if ($logged_in) {
        $_SESSION['user_id'] = $user_data['user_id'];
        $_SESSION['username'] = $user_data['username'];
    }
}

if ($logged_in) {
    error_log("Session data: " . print_r($_SESSION, true));
}

// Return user info if logged in
if ($logged_in) {
    // If we already have user data from token validation, use it
    if ($user_data) {
        echo json_encode([
            'logged_in' => true,
            'username' => $user_data['username'],
            'user_id' => $user_data['user_id'],
            'elo' => $user_data['elo']
        ]);
    } else {
        // Get user's ELO from database
        $user_id = $_SESSION['user_id'];
        $query = "SELECT elo FROM users WHERE id = $user_id";
        $result = execute_query($conn, $query);
        $elo = 1000; // Default ELO
        
        if ($result->num_rows > 0) {
            $user_data = $result->fetch_assoc();
            $elo = $user_data['elo'];
        }
        
        echo json_encode([
            'logged_in' => true,
            'username' => $_SESSION['username'],
            'user_id' => $_SESSION['user_id'],
            'elo' => $elo
        ]);
    }
    
    // Close the database connection
    close_connection($conn);
} else {
    echo json_encode(['logged_in' => false]);
}

// Clear any buffered output
ob_end_flush();
?> 