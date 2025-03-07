<?php
// Remove any whitespace or output before this opening PHP tag


error_reporting(E_ALL);
ini_set('display_errors', 1); // display errors to browser

// Buffer all output
ob_start();

try {
    // Include database connection
    require_once 'db_connect.php';
    
    // Set header to return JSON
    header('Content-Type: application/json');
    

    // Check if game ID is provided
    if (!isset($_GET['id'])) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Game ID is required']);
        exit;
    }
    
    $game_id = (int)$_GET['id'];
    
    // Get game details
    $query = "SELECT g.* FROM games g WHERE g.id = $game_id";
    
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