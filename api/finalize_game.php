<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Buffer all output
ob_start();

try {
    // Include database connection
    require_once 'db_connect.php';
    
    // Include auth token functions
    require_once 'auth_token.php';
    
    // Set header to return JSON
    header('Content-Type: application/json');
    
    // Check if request method is POST
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Only POST requests are allowed']);
        exit;
    }
    
    // Get token from request
    $token = $_POST['token'] ?? '';
    
    // Validate token
    $user = validate_token($token);
    
    if (!$user) {
        ob_end_clean();
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
    
    // Check if result is provided
    if (!isset($_POST['result'])) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Result is required']);
        exit;
    }
    
    $result = $_POST['result'];
    
    // Validate result
    $valid_results = ['checkmate', 'resignation', 'draw', 'timeout'];
    if (!in_array($result, $valid_results)) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Invalid result']);
        exit;
    }
    
    // Get the game data
    $query = "SELECT * FROM games WHERE id = $game_id";
    $result_game = execute_query($conn, $query);
    
    if ($result_game->num_rows === 0) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Game not found']);
        exit;
    }
    
    $game = $result_game->fetch_assoc();
    
    // Check if the game is already complete
    if ($game['is_complete']) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Game is already complete']);
        exit;
    }
    
    // Check if the user is a participant in the game
    if ($game['white_player'] !== $username && $game['black_player'] !== $username) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'You are not a participant in this game']);
        exit;
    }
    
    // Determine the winner based on the result
    $winner = null;
    
    if ($result === 'checkmate') {
        // The player who made the last move is the winner
        $winner = $game['turn'] === 'white' ? 'black' : 'white';
    } else if ($result === 'resignation') {
        // The player who is making the request is resigning
        $winner = $username === $game['white_player'] ? 'black' : 'white';
    } else if ($result === 'timeout') {
        // The player whose turn it is has timed out
        $winner = $game['turn'] === 'white' ? 'black' : 'white';
    }
    // For draws, winner remains null
    
    // Get the winner and loser usernames
    $winner_username = $winner === 'white' ? $game['white_player'] : $game['black_player'];
    $loser_username = $winner === 'white' ? $game['black_player'] : $game['white_player'];
    
    // Update ELO ratings and win/loss records if there's a winner (not a draw)
    if ($winner) {
        // Get current ELO ratings and win/loss records
        $query = "SELECT id, elo, wins, losses FROM users WHERE username IN ('$winner_username', '$loser_username')";
        $result_users = execute_query($conn, $query);
        
        $winner_elo = 1200; // Default ELO
        $loser_elo = 1200; // Default ELO
        $winner_id = 0;
        $winner_wins = 0;
        $loser_id = 0;
        $loser_losses = 0;
        
        while ($user_row = $result_users->fetch_assoc()) {
            if ($user_row['username'] === $winner_username) {
                $winner_elo = $user_row['elo'];
                $winner_id = $user_row['id'];
                $winner_wins = $user_row['wins'];
            } else {
                $loser_elo = $user_row['elo'];
                $loser_id = $user_row['id'];
                $loser_losses = $user_row['losses'];
            }
        }
        
        // Calculate new ELO ratings
        // Using the ELO formula: Rn = Ro + K * (S - E)
        // where Rn = new rating, Ro = old rating, K = weight (usually 32 for chess),
        // S = score (1 for win, 0 for loss, 0.5 for draw), 
        // E = expected score = 1 / (1 + 10^((opponent's rating - player's rating) / 400))
        
        $K = 32; // Standard ELO K-factor
        
        // Calculate expected scores
        $winner_expected = 1 / (1 + pow(10, ($loser_elo - $winner_elo) / 400));
        $loser_expected = 1 / (1 + pow(10, ($winner_elo - $loser_elo) / 400));
        
        // Calculate new ratings
        $winner_new_elo = round($winner_elo + $K * (1 - $winner_expected));
        $loser_new_elo = round($loser_elo + $K * (0 - $loser_expected));
        
        // Ensure ELO doesn't go below 100
        $loser_new_elo = max(100, $loser_new_elo);
        
        // Increment win/loss counters
        $winner_wins++;
        $loser_losses++;
        
        // Update winner's ELO and win count
        $query = "UPDATE users SET elo = $winner_new_elo, wins = $winner_wins WHERE username = '$winner_username'";
        execute_query($conn, $query);
        
        // Update loser's ELO and loss count
        $query = "UPDATE users SET elo = $loser_new_elo, losses = $loser_losses WHERE username = '$loser_username'";
        execute_query($conn, $query);
        
        // Record the ELO changes for the response
        $elo_changes = [
            'winner' => [
                'username' => $winner_username,
                'old_elo' => $winner_elo,
                'new_elo' => $winner_new_elo,
                'change' => $winner_new_elo - $winner_elo,
                'wins' => $winner_wins
            ],
            'loser' => [
                'username' => $loser_username,
                'old_elo' => $loser_elo,
                'new_elo' => $loser_new_elo,
                'change' => $loser_new_elo - $loser_elo,
                'losses' => $loser_losses
            ]
        ];
    } else if ($result === 'draw') {
        // For draws, update draw counts for both players
        $query = "UPDATE users SET draws = draws + 1 WHERE username IN ('$game[white_player]', '$game[black_player]')";
        execute_query($conn, $query);
    }
    
    // Update the game record
    $winner_column = $winner ? "'$winner'" : "NULL";
    $query = "UPDATE games SET 
              is_complete = TRUE, 
              result = '$result', 
              winner = $winner_column, 
              completed_at = NOW() 
              WHERE id = $game_id";
    
    execute_query($conn, $query);
    
    // Return success response
    ob_end_clean();
    
    $response = [
        'success' => true,
        'message' => 'Game finalized successfully',
        'game_id' => $game_id,
        'result' => $result
    ];
    
    // Add ELO changes to response if applicable
    if (isset($elo_changes)) {
        $response['elo_changes'] = $elo_changes;
    }
    
    echo json_encode($response);
    
} catch (Exception $e) {
    // Log the error
    error_log("Error in finalize_game.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()]);
}

// Close the database connection
close_connection($conn);
?> 