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
    require_once 'schema_helpers.php';
    require_once 'chess_rules.php';
    require_once 'game_result_helpers.php';

    // Set header to return JSON
    header('Content-Type: application/json');
    ensure_multiplayer_schema($conn);

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

    $player_color = $game['white_player'] === $username ? 'white' : 'black';
    $winner_color = null;

    if ($result === 'resignation') {
        $winner_color = $player_color === 'white' ? 'black' : 'white';
    } else if ($result === 'timeout') {
        if ($game['turn'] === $player_color) {
            ob_end_clean();
            echo json_encode(['success' => false, 'message' => 'You cannot claim a timeout on your own turn']);
            exit;
        }

        $limit = max(60, (int)($game['move_time_limit_seconds'] ?? 86400));
        $last_activity = (int)($game['last_move_timestamp'] ?: $game['start_timestamp']);
        $elapsed = time() - $last_activity;
        if ($elapsed < $limit) {
            ob_end_clean();
            echo json_encode([
                'success' => false,
                'message' => 'The timeout window has not elapsed yet',
                'seconds_remaining' => $limit - $elapsed
            ]);
            exit;
        }
        $winner_color = $player_color;
    } else if ($result === 'checkmate') {
        $board = chess_board_from_state($game['board_state']);
        if (!chess_is_checkmate($board, $game['turn'])) {
            ob_end_clean();
            echo json_encode(['success' => false, 'message' => 'The saved board is not checkmate']);
            exit;
        }
        $winner_color = $game['turn'] === 'white' ? 'black' : 'white';
    } else if ($result === 'draw') {
        $board = chess_board_from_state($game['board_state']);
        if (!chess_is_stalemate($board, $game['turn'])) {
            ob_end_clean();
            echo json_encode(['success' => false, 'message' => 'The saved board is not stalemate']);
            exit;
        }
    }

    $response = complete_game_with_result($conn, $game, $result, $winner_color);

    // Return success response
    ob_end_clean();
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
