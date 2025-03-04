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
    
    // Get game usage statistics
    $query = "SELECT * FROM game_usage ORDER BY number DESC";
    $result = execute_query($conn, $query);
    
    $stats = [];
    
    while ($row = $result->fetch_assoc()) {
        // Convert number to integer
        $row['number'] = (int)$row['number'];
        $stats[] = $row;
    }
    
    // Clear the output buffer before sending JSON
    ob_end_clean();
    
    // Return success response
    echo json_encode([
        'success' => true,
        'stats' => $stats
    ]);
    
    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Log the error
    error_log("Error in get_game_stats.php: " . $e->getMessage());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while retrieving game statistics'
    ]);
}

exit;
?> 