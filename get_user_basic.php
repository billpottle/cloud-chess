<?php
// Enable error reporting for debugging but log to file instead of output
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

// Make sure no output is sent before including files that modify headers
ob_start();

try {
    // Include database connection
    require_once 'db_connect.php';
    
    // Set header to return JSON
    header('Content-Type: application/json');
    
    // Check if user_id is provided
    if (!isset($_GET['user_id'])) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'User ID is required']);
        exit;
    }
    
    $user_id = (int)$_GET['user_id'];
    
    // Log the request
    error_log("get_user_basic.php: Processing request for user_id=$user_id");
    
    // Get user information - only basic info, no ranking calculations
    $query = "SELECT id, username, email, wins, losses, elo FROM users WHERE id = $user_id";
    error_log("Query: $query");
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }
    
    $user = $result->fetch_assoc();
    error_log("User data retrieved: " . print_r($user, true));
    
    // Clear the output buffer before sending JSON
    ob_end_clean();
    
    // Ensure we're sending a valid JSON response
    $response = [
        'success' => true, 
        'user' => $user, 
        'elo' => $user['elo']
    ];
    
    error_log("Sending response: " . json_encode($response));
    echo json_encode($response);
    
    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Log the error
    error_log("Error in get_user_basic.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while processing your request: ' . $e->getMessage()
    ]);
}

exit;
?> 