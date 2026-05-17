<?php
// Enable error reporting for debugging but log to file instead of output
error_reporting(E_ALL);
ini_set('display_errors', 1);


// Make sure no output is sent before including files that modify headers
ob_start();

// Include database connection
require_once 'db_connect.php';
require_once 'auth_token.php';
require_once 'schema_helpers.php';

// Set header to return JSON
header('Content-Type: application/json');

ensure_multiplayer_schema($conn);

function get_request_data() {
    $json_data = file_get_contents('php://input');
    if (empty($json_data)) {
        return [];
    }

    $data = json_decode($json_data, true);
    if (!is_array($data)) {
        throw new Exception('Invalid JSON data');
    }

    return $data;
}

function require_authenticated_username($data) {
    $token = $data['token'] ?? ($_POST['token'] ?? '');
    if (empty($token)) {
        throw new Exception('Authentication token is required');
    }

    $user = validate_token($token);
    if (!$user) {
        throw new Exception('Invalid authentication');
    }

    return $user['username'];
}

// Function to create a new challenge
function normalize_move_time_limit_seconds($value) {
    $seconds = (int)$value;
    if ($seconds <= 0) {
        return 86400;
    }
    return max(60, min($seconds, 30 * 24 * 60 * 60));
}

function create_challenge($conn, $challenger, $challenged, $move_time_limit_seconds = 86400) {
    $current_time = time();
    $expires = $current_time + 3600; // Challenge expires in 1 hour
    $move_time_limit_seconds = normalize_move_time_limit_seconds($move_time_limit_seconds);

    // Prevent challenging yourself
    if ($challenger === $challenged) {
        return ['success' => false, 'message' => 'You cannot challenge yourself'];
    }

    $stmt = $conn->prepare("SELECT username FROM users WHERE username = ? LIMIT 1");
    $stmt->bind_param('s', $challenged);
    $stmt->execute();
    $user_exists_result = $stmt->get_result();
    if ($user_exists_result->num_rows === 0) {
        $stmt->close();
        return ['success' => false, 'message' => 'Challenged user does not exist'];
    }
    $stmt->close();

    // Check if there's already an active challenge between these users
    $stmt = $conn->prepare("SELECT id FROM challenges
                   WHERE challenger = ?
                   AND player_being_challenged = ?
                   AND accepted = FALSE
                   AND expires > ?");
    $stmt->bind_param('ssi', $challenger, $challenged, $current_time);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $stmt->close();
        return ['success' => false, 'message' => 'You have already challenged this player'];
    }
    $stmt->close();

    // Create new challenge
    $stmt = $conn->prepare("INSERT INTO challenges (challenger, player_being_challenged, challenge_timestamp, expires, move_time_limit_seconds)
              VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param('ssiii', $challenger, $challenged, $current_time, $expires, $move_time_limit_seconds);
    $stmt->execute();
    $stmt->close();

    return ['success' => true, 'message' => 'Challenge sent successfully'];
}

// Function to accept a challenge
function accept_challenge($conn, $challenge_id, $username) {
    $current_time = time();

    $stmt = $conn->prepare("SELECT * FROM challenges
              WHERE id = ?
              AND player_being_challenged = ?
              AND accepted = FALSE
              AND expires > ?");
    $stmt->bind_param('isi', $challenge_id, $username, $current_time);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        return ['success' => false, 'message' => 'Challenge not found or expired'];
    }

    $challenge = $result->fetch_assoc();
    $stmt->close();
    $challenger = $challenge['challenger'];
    $move_time_limit_seconds = normalize_move_time_limit_seconds($challenge['move_time_limit_seconds'] ?? 86400);

    // Mark challenge as accepted
    $stmt = $conn->prepare("UPDATE challenges SET accepted = TRUE WHERE id = ?");
    $stmt->bind_param('i', $challenge_id);
    $stmt->execute();
    $stmt->close();

    // Create a new game
    $start_time = time();
    $initial_board = 'initial_board_state'; // Replace with actual initial board state

    $turn = 'white';
    $is_complete = 0;
    $stmt = $conn->prepare("INSERT INTO games (white_player, black_player, turn, is_complete, board_state, start_timestamp, last_move_timestamp, move_time_limit_seconds)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('sssisiii', $challenger, $username, $turn, $is_complete, $initial_board, $start_time, $start_time, $move_time_limit_seconds);
    $stmt->execute();
    $stmt->close();

    // Get the new game ID
    $game_id = $conn->insert_id;

    return [
        'success' => true,
        'message' => 'Challenge accepted',
        'game_id' => $game_id
    ];
}

// Function to decline a challenge
function decline_challenge($conn, $challenge_id, $username) {
    // Verify the challenge belongs to this user
    $stmt = $conn->prepare("SELECT * FROM challenges
              WHERE id = ?
              AND player_being_challenged = ?");
    $stmt->bind_param('is', $challenge_id, $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        return ['success' => false, 'message' => 'Challenge not found'];
    }
    $stmt->close();

    // Delete the challenge
    $stmt = $conn->prepare("DELETE FROM challenges WHERE id = ?");
    $stmt->bind_param('i', $challenge_id);
    $stmt->execute();
    $stmt->close();

    return ['success' => true, 'message' => 'Challenge declined'];
}

// Function to get pending challenges for a user
function get_pending_challenges($conn, $username) {
    $current_time = time();

    // Get challenges where this user is being challenged
    $query = "SELECT c.id, c.challenger, c.challenge_timestamp, c.expires, c.move_time_limit_seconds, u.elo
              FROM challenges c
              JOIN users u ON c.challenger = u.username
              WHERE c.player_being_challenged = '$username'
              AND c.accepted = FALSE
              AND c.expires > $current_time
              ORDER BY c.challenge_timestamp DESC";
    $result = execute_query($conn, $query);

    $challenges = [];
    while ($row = $result->fetch_assoc()) {
        // Convert numeric values to integers
        $row['id'] = (int)$row['id'];
        $row['challenge_timestamp'] = (int)$row['challenge_timestamp'];
        $row['expires'] = (int)$row['expires'];
        $row['move_time_limit_seconds'] = (int)$row['move_time_limit_seconds'];
        $row['elo'] = (int)$row['elo'];

        // Add formatted date
        $row['challenge_date'] = date('M j, Y g:i A', $row['challenge_timestamp']);

        // Add time remaining
        $row['expires_in_minutes'] = ceil(($row['expires'] - $current_time) / 60);

        $challenges[] = $row;
    }

    return ['success' => true, 'challenges' => $challenges];
}

// Function to get outgoing challenges from a user
function get_outgoing_challenges($conn, $username) {
    $current_time = time();

    // Get challenges where this user is challenging others
    $query = "SELECT c.id, c.player_being_challenged, c.challenge_timestamp, c.expires, c.move_time_limit_seconds, u.elo
              FROM challenges c
              LEFT JOIN users u ON c.player_being_challenged = u.username
              WHERE c.challenger = '$username'
              AND c.accepted = FALSE
              AND c.expires > $current_time
              ORDER BY c.challenge_timestamp DESC";
    $result = execute_query($conn, $query);

    $challenges = [];
    while ($row = $result->fetch_assoc()) {
        // Convert numeric values to integers
        $row['id'] = (int)$row['id'];
        $row['challenge_timestamp'] = (int)$row['challenge_timestamp'];
        $row['expires'] = (int)$row['expires'];
        $row['move_time_limit_seconds'] = (int)$row['move_time_limit_seconds'];
        $row['elo'] = (int)$row['elo'];

        // Add formatted date
        $row['challenge_date'] = date('M j, Y g:i A', $row['challenge_timestamp']);

        // Add time remaining
        $row['expires_in_minutes'] = ceil(($row['expires'] - $current_time) / 60);

        $challenges[] = $row;
    }

    return ['success' => true, 'challenges' => $challenges];
}

// Function to cancel an outgoing challenge
function cancel_challenge($conn, $challenge_id, $username) {
    // Verify the challenge belongs to this user
    $stmt = $conn->prepare("SELECT * FROM challenges
              WHERE id = ?
              AND challenger = ?");
    $stmt->bind_param('is', $challenge_id, $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        return ['success' => false, 'message' => 'Challenge not found'];
    }
    $stmt->close();

    // Delete the challenge
    $stmt = $conn->prepare("DELETE FROM challenges WHERE id = ?");
    $stmt->bind_param('i', $challenge_id);
    $stmt->execute();
    $stmt->close();

    return ['success' => true, 'message' => 'Challenge cancelled'];
}

try {
    // Get action from request
    $action = isset($_GET['action']) ? $_GET['action'] : '';

    // Get username from request for public actions
    $username = '';

    if (isset($_GET['username'])) {
        $username = sanitize_input($conn, $_GET['username']);
    }

    if (isset($_POST['username'])) {
        $username = sanitize_input($conn, $_POST['username']);
    }

    if ($username === '' && ($action === 'pending' || $action === 'outgoing')) {
        throw new Exception('Username is required for this action');
    }



    // Handle different API actions
    switch ($action) {
        case 'create':
            // Create a new challenge
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Invalid request method');
            }

            $data = get_request_data();
            $username = require_authenticated_username($data);

            // Get the challenged username from the request
            $challenged_username = isset($data['challenged_username']) ? sanitize_input($conn, $data['challenged_username']) : '';
            $move_time_limit_seconds = normalize_move_time_limit_seconds($data['move_time_limit_seconds'] ?? 86400);

            if (empty($challenged_username)) {
                throw new Exception('Challenged username is required');
            }

            // Create the challenge
            $result = create_challenge($conn, $username, $challenged_username, $move_time_limit_seconds);
            break;

        case 'accept':
            // Accept a challenge
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Invalid request method');
            }

            $data = get_request_data();
            $username = require_authenticated_username($data);

            $challenge_id = isset($data['challenge_id']) ? (int)$data['challenge_id'] : 0;

            if ($challenge_id <= 0) {
                throw new Exception('Valid challenge ID is required');
            }

            $result = accept_challenge($conn, $challenge_id, $username);
            break;

        case 'decline':
            // Decline a challenge
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Invalid request method');
            }

            $data = get_request_data();
            $username = require_authenticated_username($data);

            $challenge_id = isset($data['challenge_id']) ? (int)$data['challenge_id'] : 0;

            if ($challenge_id <= 0) {
                throw new Exception('Valid challenge ID is required');
            }

            $result = decline_challenge($conn, $challenge_id, $username);
            break;

        case 'cancel':
            // Cancel an outgoing challenge
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Invalid request method');
            }

            $data = get_request_data();
            $username = require_authenticated_username($data);

            $challenge_id = isset($data['challenge_id']) ? (int)$data['challenge_id'] : 0;

            if ($challenge_id <= 0) {
                throw new Exception('Valid challenge ID is required');
            }

            $result = cancel_challenge($conn, $challenge_id, $username);
            break;

        case 'pending':
            // Get pending challenges for this user
            $result = get_pending_challenges($conn, $username);
            break;

        case 'outgoing':
            // Get outgoing challenges from this user
            $result = get_outgoing_challenges($conn, $username);
            break;

        default:
            $result = ['success' => false, 'message' => 'Invalid action'];
    }

    // Clear the output buffer before sending JSON
    ob_end_clean();

    // Return response
    echo json_encode($result);

    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Log the error
    error_log("Error in challenge_api.php: " . $e->getMessage());

    // Clear any output that might have been generated
    ob_end_clean();

    // Return a clean error response
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred: ' . $e->getMessage()
    ]);
}

exit;
?>
