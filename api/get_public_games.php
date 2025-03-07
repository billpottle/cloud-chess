<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Buffer all output to prevent header issues
ob_start();

// Include database connection
require_once 'db_connect.php';

// Set content type to JSON
header('Content-Type: application/json');

try {
    // Get all active games
    $query = "SELECT g.id, g.white_player, g.black_player, g.turn, 
              DATE_FORMAT(FROM_UNIXTIME(g.start_timestamp), '%Y-%m-%d %H:%i') as start_date
              FROM games g 
              WHERE g.is_complete = FALSE
              ORDER BY g.start_timestamp DESC
              LIMIT 20"; // Limit to 20 most recent games
    
    $result = execute_query($conn, $query);
    
    $games = [];
    while ($row = $result->fetch_assoc()) {
        $games[] = $row;
    }
    
    // Clear output buffer
    ob_end_clean();
    
    // Return success response with games
    echo json_encode([
        'success' => true,
        'games' => $games
    ]);
    
    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Clear output buffer
    ob_end_clean();
    
    // Return error response
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
?> 