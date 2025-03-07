<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Buffer all output to prevent header issues
ob_start();

// Include database connection
require_once 'db_connect.php';

// Include auth token functions
require_once 'auth_token.php';

// Set content type to JSON
header('Content-Type: application/json');

try {
    // Get request data
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['game_id']) || !isset($data['move']) || !isset($data['board_state'])) {
        throw new Exception('Missing required parameters');
    }
    
    $game_id = (int)$data['game_id'];
    $move = $data['move'];
    $board_state = $data['board_state'];
    $token = $data['token'] ?? '';
    
    // Validate token if provided
    $user = null;
    if (!empty($token)) {
        $user = validate_token($token);
        if (!$user) {
            throw new Exception('Invalid authentication token');
        }
    }
    
    // Get the current game state
    $query = "SELECT * FROM games WHERE id = $game_id";
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        throw new Exception('Game not found');
    }
    
    $game = $result->fetch_assoc();
    
    // Check if it's the player's turn
    if ($user) {
        $username = $user['username'];
        
        if ($game['turn'] === 'white' && $game['white_player'] !== $username) {
            throw new Exception('Not your turn');
        }
        
        if ($game['turn'] === 'black' && $game['black_player'] !== $username) {
            throw new Exception('Not your turn');
        }
    }
    
    // Update the game state
    $current_time = time();
    $next_turn = ($game['turn'] === 'white') ? 'black' : 'white';
    
    // Update the game in the database
    $update_query = "UPDATE games SET 
                    board_state = '" . $conn->real_escape_string(json_encode($board_state)) . "',
                    last_move = '" . $conn->real_escape_string(json_encode($move)) . "',
                    last_move_timestamp = $current_time,
                    turn = '$next_turn'
                    WHERE id = $game_id";
    
    execute_query($conn, $update_query);
    
    // Return success response
    ob_end_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Move recorded successfully',
        'next_turn' => $next_turn
    ]);
    
    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Clear output buffer
    ob_end_clean();
    
    // Return error response
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update game: ' . $e->getMessage()
    ]);
}
?> 