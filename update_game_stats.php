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
    
    // Check if game_type is provided
    if (!isset($_POST['game_type'])) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Game type is required']);
        exit;
    }
    
    $game_type = sanitize_input($conn, $_POST['game_type']);
    
    // Valid game types
    $valid_types = [
        'Player Vs Player (Local)',
        'Vs Computer Level 1',
        'Vs Computer Level 2',
        'Vs Computer Level 3'
    ];
    
    // Validate game type
    if (!in_array($game_type, $valid_types)) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Invalid game type']);
        exit;
    }
    
    // Update the game usage count
    $query = "UPDATE game_usage SET number = number + 1 WHERE game_type = '$game_type'";
    execute_query($conn, $query);
    
    // Get the updated count
    $query = "SELECT number FROM game_usage WHERE game_type = '$game_type'";
    $result = execute_query($conn, $query);
    $count = $result->fetch_assoc()['number'];
    
    // Clear the output buffer before sending JSON
    ob_end_clean();
    
    // Return success response
    echo json_encode([
        'success' => true, 
        'message' => 'Game usage updated successfully',
        'game_type' => $game_type,
        'count' => $count
    ]);
    
    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Log the error
    error_log("Error in update_game_stats.php: " . $e->getMessage());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while updating game statistics'
    ]);
}

exit;
?> 