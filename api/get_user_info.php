<?php
// Enable error reporting for debugging but log to file instead of output
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors to browser
ini_set('log_errors', 1); // Log errors instead
ini_set('error_log', 'php_errors.log'); // Set error log file

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
    error_log("get_user_info.php: Processing request for user_id=$user_id");
    
    // Get user information
    $query = "SELECT username, email, wins, losses, elo FROM users WHERE id = $user_id";
    error_log("Query 1: $query");
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }
    
    $user = $result->fetch_assoc();
    error_log("User data retrieved: " . print_r($user, true));
    
    // Check if elo column exists
    if (!isset($user['elo'])) {
        // Add default elo value if it doesn't exist
        $user['elo'] = 1000;
    } else {
        // Convert elo to integer to ensure proper comparison
        $user['elo'] = (int)$user['elo'];
    }
    
    // Calculate user's global ranking
    try {
        // Cast elo to integer in the query to ensure proper comparison
        $ranking_query = "SELECT COUNT(*) + 1 as rank FROM users WHERE CAST(elo AS SIGNED) > " . $user['elo'];
        error_log("Query 2: $ranking_query");
        $ranking_result = execute_query($conn, $ranking_query);
        $ranking_data = $ranking_result->fetch_assoc();
        $user['ranking'] = (int)$ranking_data['rank'];
    } catch (Exception $e) {
        // If ranking query fails, set a default ranking
        $user['ranking'] = 1;
    }
    
    // Get total number of users for ranking context
    try {
        $total_users_query = "SELECT COUNT(*) as total FROM users";
        error_log("Query 3: $total_users_query");
        $total_users_result = execute_query($conn, $total_users_query);
        $total_users_data = $total_users_result->fetch_assoc();
        $user['total_users'] = $total_users_data['total'];
    } catch (Exception $e) {
        // If total users query fails, set a default value
        $user['total_users'] = 1;
    }
    
    // Clear the output buffer before sending JSON
    ob_end_clean();
    
    // Ensure we're sending a valid JSON response
    $response = [
        'success' => true, 
        'user' => $user, 
        'elo' => $user['elo'],
        'ranking' => $user['ranking'],
        'total_users' => $user['total_users']
    ];
    
    error_log("Sending response: " . json_encode($response));
    echo json_encode($response);
    
    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Log the error
    error_log("Error in get_user_info.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while processing your request'
    ]);
}

exit;
?> 