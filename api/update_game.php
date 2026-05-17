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
    require_once 'schema_helpers.php';
    require_once 'chess_rules.php';
    require_once 'game_result_helpers.php';

    // Set header to return JSON
    header('Content-Type: application/json');
    ensure_multiplayer_schema($conn);

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

        $winner_elo_change = (int)$elo_changes['winner']['change'];
        $loser_elo_change = (int)$elo_changes['loser']['change'];
        $end_timestamp = time();

        // Update the game record
        $update_query = "UPDATE games SET
                        is_complete = TRUE,
                        winner = '$winner',
                        result = 'resignation',
                        end_timestamp = $end_timestamp,
                        last_move_timestamp = $end_timestamp,
                        winner_elo_change = $winner_elo_change,
                        loser_elo_change = $loser_elo_change
                        WHERE id = $game_id";

        execute_query($conn, $update_query);

        ob_end_clean();
        echo json_encode([
            'success' => true,
            'message' => 'Game resigned successfully',
            'elo_changes' => $elo_changes
        ]);
        exit;
    }

    // Normal moves must be submitted as coordinates. The server owns board updates.
    if (!isset($_POST['from_row'], $_POST['from_col'], $_POST['to_row'], $_POST['to_col'])) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'Move coordinates are required']);
        exit;
    }

    $from_row = (int)$_POST['from_row'];
    $from_col = (int)$_POST['from_col'];
    $to_row = (int)$_POST['to_row'];
    $to_col = (int)$_POST['to_col'];

    $move_result = chess_validate_and_apply_move($game['board_state'], $from_row, $from_col, $to_row, $to_col, $player_color);
    $current_timestamp = time();
    $escaped_board_state = $conn->real_escape_string($move_result['board_state']);

    $update_fields = [
        "board_state = '$escaped_board_state'",
        "turn = '" . $conn->real_escape_string($move_result['next_turn']) . "'",
        "last_move_timestamp = $current_timestamp"
    ];

    if ($move_result['special_status']) {
        $update_fields[] = "special_status = '" . $conn->real_escape_string($move_result['special_status']) . "'";
    } else {
        $update_fields[] = "special_status = NULL";
    }

    if ($player_color === 'white') {
        $update_fields[] = "last_move_white = '" . $conn->real_escape_string($move_result['last_move']) . "'";
    } else {
        $update_fields[] = "last_move_black = '" . $conn->real_escape_string($move_result['last_move']) . "'";
    }

    $update_query = "UPDATE games SET " . implode(", ", $update_fields) . " WHERE id = $game_id";
    execute_query($conn, $update_query);

    $finalized = null;
    if ($move_result['is_complete']) {
        $game['board_state'] = $move_result['board_state'];
        $game['turn'] = $move_result['next_turn'];
        $winner_color = $move_result['winner_color'];
        $finalized = complete_game_with_result($conn, $game, $move_result['result'], $winner_color);
    }

    // Clear the output buffer before sending JSON
    ob_end_clean();

    $response = [
        'success' => true,
        'message' => 'Game updated successfully',
        'next_turn' => $move_result['next_turn'],
        'board_state' => json_decode($move_result['board_state'], true),
        'special_status' => $move_result['special_status'],
        'last_move' => $move_result['last_move'],
        'last_move_timestamp' => $current_timestamp,
        'move_time_limit_seconds' => (int)($game['move_time_limit_seconds'] ?? 86400),
        'is_complete' => $move_result['is_complete']
    ];
    if ($finalized) {
        $response['finalized'] = $finalized;
    }
    echo json_encode($response);
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
