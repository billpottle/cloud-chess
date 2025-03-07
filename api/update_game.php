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

try {
    // Include database connection
    require_once 'db_connect.php';
    
    // Include auth token functions
    require_once 'auth_token.php';
    
    // Set header to return JSON
    header('Content-Type: application/json');
    
    // Get token from request
    $token = $_POST['token'] ?? '';

    // Validate token using your existing function
    $user = validate_token($token);

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Invalid authentication']);
        exit;
    }

    $user_id = $user['user_id'];
    $username = $user['username'];
    
    // Check if game_id is provided
    if (!isset($_POST['game_id'])) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Game ID is required']);
        exit;
    }
    
    $game_id = (int)$_POST['game_id'];
    
    // Get the current game state
    $query = "SELECT * FROM games WHERE id = $game_id AND (white_player = '$username' OR black_player = '$username') AND is_complete = FALSE";
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Game not found or not accessible']);
        exit;
    }
    
    $game = $result->fetch_assoc();
    
    // Check if it's the user's turn
    $player_color = ($game['white_player'] === $username) ? 'white' : 'black';
    if ($game['turn'] !== $player_color) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Not your turn']);
        exit;
    }
    
    // Check if this is a resign action
    if (isset($_POST['action']) && $_POST['action'] === 'resign') {
        // Update the game as complete with the opponent as winner
        $winner = ($player_color === 'white') ? $game['black_player'] : $game['white_player'];
        $update_query = "UPDATE games SET 
                        is_complete = TRUE, 
                        winner = '$winner', 
                        end_reason = 'resignation',
                        end_timestamp = " . time() . "
                        WHERE id = $game_id";
        
        execute_query($conn, $update_query);
        
        ob_end_clean();
        echo json_encode(['success' => true, 'message' => 'Game resigned successfully']);
        exit;
    }
    
    // Check if board_state and next_turn are provided
    if (!isset($_POST['board_state']) || !isset($_POST['next_turn'])) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Board state and next turn are required']);
        exit;
    }
    
    $board_state = $_POST['board_state'];
    $next_turn = $_POST['next_turn'];
    
    // Validate next_turn
    if ($next_turn !== 'white' && $next_turn !== 'black') {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Invalid next turn value']);
        exit;
    }
    
    // Update the game state
    $current_timestamp = time();
    
    // Properly escape the board state for SQL
    $escaped_board_state = $conn->real_escape_string($board_state);
    
    $update_query = "UPDATE games SET 
                    board_state = '$escaped_board_state', 
                    turn = '$next_turn', 
                    last_move_timestamp = $current_timestamp
                    WHERE id = $game_id";
    
    execute_query($conn, $update_query);
    
    // Clear the output buffer before sending JSON
    ob_end_clean();
    
    echo json_encode([
        'success' => true, 
        'message' => 'Game updated successfully',
        'next_turn' => $next_turn
    ]);
} catch (Exception $e) {
    // Log the error
    error_log("Error in update_game.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}

// Close the database connection
close_connection($conn);
?> 