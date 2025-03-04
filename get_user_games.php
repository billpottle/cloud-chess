<?php
// Enable error reporting for debugging but log to file instead of output
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

// Make sure no output is sent before including files that modify headers
ob_start();

// Include database connection
require_once 'db_connect.php';

// Include session configuration
require_once 'session_config.php';

// Set header to return JSON
header('Content-Type: application/json');

try {
    // Check if user is logged in
    if (!isset($_SESSION['user_id'])) {
        // Log the session data for debugging
        error_log("Session data in get_user_games.php: " . print_r($_SESSION, true));
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'User not logged in']);
        exit;
    }
    
    $user_id = $_SESSION['user_id'];
    $username = $_SESSION['username'];
    
    // Log successful session data
    error_log("User logged in: $username (ID: $user_id)");
    
    // Get user's active games (where they are either white or black player and game is not complete)
    $query = "SELECT id, white_player, black_player, turn, start_timestamp, 
              (CASE 
                WHEN white_player = '$username' THEN 'white' 
                ELSE 'black' 
              END) as player_color
              FROM games 
              WHERE (white_player = '$username' OR black_player = '$username') 
              AND is_complete = FALSE 
              ORDER BY start_timestamp DESC";
    
    $result = execute_query($conn, $query);
    
    $games = [];
    while ($row = $result->fetch_assoc()) {
        // Convert numeric values to integers
        $row['id'] = (int)$row['id'];
        $row['start_timestamp'] = (int)$row['start_timestamp'];
        
        // Add opponent name
        $row['opponent'] = ($row['player_color'] === 'white') ? $row['black_player'] : $row['white_player'];
        
        // Add formatted date
        $row['start_date'] = date('M j, Y g:i A', $row['start_timestamp']);
        
        // Add whose turn it is
        $row['is_my_turn'] = ($row['turn'] === $row['player_color']);
        
        $games[] = $row;
    }
    
    // Clear the output buffer before sending JSON
    ob_end_clean();
    
    // Return success response
    echo json_encode([
        'success' => true,
        'games' => $games
    ]);
    
    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Log the error
    error_log("Error in get_user_games.php: " . $e->getMessage());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while retrieving user games'
    ]);
}

exit;
?> 