<?php
// Remove any whitespace or output before this opening PHP tag

// Enable error reporting for debugging but log to file instead of output
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors to browser
ini_set('log_errors', 1); // Log errors instead
ini_set('error_log', 'php_errors.log'); // Set error log file

// Buffer all output
ob_start();

// Start session
session_start();

// Include any necessary files
require_once 'session_config.php';

// Include auth token functions
require_once 'auth_token.php';

// Get token from request
$token = $_GET['token'] ?? '';

// For publicly accessible game data, you can make token optional
$user = null;
if (!empty($token)) {
    $user = validate_token($token);
    if ($user) {
        $user_id = $user['user_id'];
        $username = $user['username'];
    }
}

try {
    // Include database connection
    require_once 'db_connect.php';
    
    // Set header to return JSON
    header('Content-Type: application/json');
    
    // Check if user is logged in
    if (!isset($_SESSION['user_id'])) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'User not logged in']);
        exit;
    }
    
    $user_id = $_SESSION['user_id'];
    $username = $_SESSION['username'];
    
    // Check if game ID is provided
    if (!isset($_GET['id'])) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Game ID is required']);
        exit;
    }
    
    $game_id = (int)$_GET['id'];
    
    // Get game details
    $query = "SELECT g.*, 
              CASE WHEN g.white_player = '$username' THEN 'white' ELSE 'black' END as player_color,
              CASE WHEN g.white_player = '$username' THEN g.black_player ELSE g.white_player END as opponent_name
              FROM games g 
              WHERE g.id = $game_id 
              AND (g.white_player = '$username' OR g.black_player = '$username')
              AND g.is_complete = FALSE";
    
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Game not found or not accessible']);
        exit;
    }
    
    $game = $result->fetch_assoc();
    
    // Clear the output buffer before sending JSON
    ob_end_clean();
    
    echo json_encode(['success' => true, 'game' => $game]);
} catch (Exception $e) {
    // Log the error
    error_log("Error in get_game.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}

// Close the database connection
close_connection($conn);
?> 