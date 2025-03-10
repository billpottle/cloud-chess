<?php
// Remove any whitespace or output before this opening PHP tag

// Enable error reporting for debugging but log to file instead of output
error_reporting(E_ALL);
ini_set('display_errors', 1); // Don't display errors to browser


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
        $loser = $username; // Current user is resigning
        
        // Update the game record
        $update_query = "UPDATE games SET 
                        is_complete = TRUE, 
                        winner = '$winner', 
                        result = 'resignation',
                        end_timestamp = " . time() . "
                        WHERE id = $game_id";
        
        execute_query($conn, $update_query);
        
        // Get the current ELO ratings and stats
        $query = "SELECT username, elo, wins, losses FROM users WHERE username IN ('$winner', '$loser')";
        $result_users = execute_query($conn, $query);
        
        // Initialize variables
        $winner_elo = 1200;
        $loser_elo = 1200;
        $winner_wins = 1;
        $loser_losses = 1;
        
        // Get the current values
        while ($user = $result_users->fetch_assoc()) {
            if ($user['username'] === $winner) {
                $winner_elo = $user['elo'];
                $winner_wins = $user['wins'] + 1;
            } else {
                $loser_elo = $user['elo'];
                $loser_losses = $user['losses'] + 1;
            }
        }
        
        // Calculate new ELO ratings
        $winner_new_elo = calculateNewElo($winner_elo, $loser_elo, 1);
        $loser_new_elo = calculateNewElo($loser_elo, $winner_elo, 0);
        
        // Update winner's ELO and win count
        $query = "UPDATE users SET elo = $winner_new_elo, wins = $winner_wins WHERE username = '$winner'";
        execute_query($conn, $query);
        
        // Update loser's ELO and loss count
        $query = "UPDATE users SET elo = $loser_new_elo, losses = $loser_losses WHERE username = '$loser'";
        execute_query($conn, $query);
        
        // Record the ELO changes for the response
        $elo_changes = [
            'winner' => [
                'username' => $winner,
                'old_elo' => $winner_elo,
                'new_elo' => $winner_new_elo,
                'change' => $winner_new_elo - $winner_elo,
                'wins' => $winner_wins
            ],
            'loser' => [
                'username' => $loser,
                'old_elo' => $loser_elo,
                'new_elo' => $loser_new_elo,
                'change' => $loser_new_elo - $loser_elo,
                'losses' => $loser_losses
            ]
        ];
        
        ob_end_clean();
        echo json_encode([
            'success' => true, 
            'message' => 'Game resigned successfully',
            'elo_changes' => $elo_changes
        ]);
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
    
    // Get the special status from the form data
    $special_status = isset($_POST['special_status']) ? $_POST['special_status'] : null;
    
    // Update the game state
    $current_timestamp = time();
    
    // Properly escape the board state for SQL
    $escaped_board_state = $conn->real_escape_string($board_state);
    
    $update_query = "UPDATE games SET 
    board_state = '$escaped_board_state', 
    turn = '$next_turn', 
    last_move_timestamp = $current_timestamp,
    special_status = '$special_status'
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

// Function to calculate new ELO rating
function calculateNewElo($playerElo, $opponentElo, $result) {
    $kFactor = 32; // K-factor determines how much the rating can change
    
    // Calculate expected outcome
    $expectedOutcome = 1 / (1 + pow(10, ($opponentElo - $playerElo) / 400));
    
    // Calculate new rating
    $newElo = round($playerElo + $kFactor * ($result - $expectedOutcome));
    
    // Ensure ELO doesn't go below 100
    return max(100, $newElo);
}
?> 