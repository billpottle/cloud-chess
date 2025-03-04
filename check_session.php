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

// Start the session
// session_start();

// Check if user is logged in
if (isset($_SESSION['user_id'])) {
    // Check if session has expired
    if (isset($_SESSION['expires']) && $_SESSION['expires'] < time()) {
        // Session expired, destroy it
        session_destroy();
        echo json_encode(['logged_in' => false]);
        exit;
    }
    
    // Update session expiration time
    $_SESSION['expires'] = time() + 3600;
    
    // User is logged in
    echo json_encode([
        'logged_in' => true,
        'username' => $_SESSION['username'],
        'user_id' => $_SESSION['user_id'],
        'elo' => $_SESSION['elo']
    ]);
} else {
    // User is not logged in
    echo json_encode(['logged_in' => false]);
}

// Clear any buffered output
ob_end_flush();
?> 