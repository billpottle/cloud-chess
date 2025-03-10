<?php
// Remove any whitespace or output before this opening PHP tag

// Enable error reporting for debugging but log to file instead of output
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors to browser
ini_set('log_errors', 1); // Log errors instead
ini_set('error_log', 'php_errors.log'); // Set error log file

// Buffer all output
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
    error_log("get_completed_user_games.php: Processing request for user_id=$user_id");
    
    // First, get the username for this user_id
    $username_query = "SELECT username FROM users WHERE id = $user_id";
    $username_result = execute_query($conn, $username_query);
    
    if ($username_result->num_rows === 0) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }
    
    $username_row = $username_result->fetch_assoc();
    $username = $username_row['username'];
    error_log("Found username: $username for user_id: $user_id");
    
    // Now get the completed games using the username
    $query = "SELECT g.id, 
              g.white_player, 
              g.black_player, 
              g.winner,
              g.result,
              g.winner_elo_change,
              g.loser_elo_change,
              g.last_move_timestamp as completion_date,
              CASE 
                WHEN g.white_player = '$username' THEN g.black_player 
                ELSE g.white_player 
              END as opponent_username,
              CASE 
                WHEN g.white_player = '$username' THEN 'white' 
                ELSE 'black' 
              END as player_color
              FROM games g
              WHERE (g.white_player = '$username' OR g.black_player = '$username')
              AND g.is_complete = TRUE
              ORDER BY g.last_move_timestamp DESC
              LIMIT 10";
    
    error_log("Executing query: $query");
    $result = execute_query($conn, $query);
    
    $games = [];
    while ($row = $result->fetch_assoc()) {
        // Determine if the user won, lost, or drew
        if (isset($row['result']) && $row['result'] == 'draw') {
            $row['result'] = 'draw';
            // For draws, ELO change might be handled differently
            // Use a neutral class for display
            $row['elo_change'] = 0; // Default to 0 if not specified
        } else if ($row['winner'] === $username) {
            $row['result'] = 'win';
            // Get the winner's ELO change
            $row['elo_change'] = $row['winner_elo_change'];
        } else {
            $row['result'] = 'loss';
            // Get the loser's ELO change
            $row['elo_change'] = $row['loser_elo_change'];
        }
        
        // Format the date
        if (isset($row['completion_date']) && is_numeric($row['completion_date'])) {
            $row['completion_date'] = date('M j, Y g:i A', $row['completion_date']);
        }
        
        $games[] = $row;
    }
    
    error_log("Found " . count($games) . " completed games");
    
    // Clear the output buffer before sending JSON
    ob_end_clean();
    
    echo json_encode(['success' => true, 'games' => $games]);
} catch (Exception $e) {
    // Log the error
    error_log("Error in get_completed_user_games.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode(['success' => false, 'message' => 'An error occurred while retrieving completed games: ' . $e->getMessage()]);
}

// Close the database connection
close_connection($conn);
?> 