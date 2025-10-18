<?php
// Enable error reporting for debugging but log to file instead of output
error_reporting(E_ALL);
ini_set('display_errors', 1);


// Make sure no output is sent before including files that modify headers
ob_start();

// Include database connection
require_once 'db_connect.php';

// Set header to return JSON
header('Content-Type: application/json');

// Function to create a new challenge
function create_challenge($conn, $challenger, $challenged) {
    $current_time = time();
    $expires = $current_time + 3600; // Challenge expires in 1 hour
    
    // Check if there's already an active challenge between these users
    $check_query = "SELECT id FROM challenges 
                   WHERE challenger = '$challenger' 
                   AND player_being_challenged = '$challenged' 
                   AND accepted = FALSE 
                   AND expires > $current_time";
    $result = execute_query($conn, $check_query);
    
    if ($result->num_rows > 0) {
        // Challenge already exists
        return ['success' => false, 'message' => 'You have already challenged this player'];
    }
 
    // Create new challenge
    $query = "INSERT INTO challenges (challenger, player_being_challenged, challenge_timestamp, expires) 
              VALUES ('$challenger', '$challenged', $current_time, $expires)";
    execute_query($conn, $query);
    
    return ['success' => true, 'message' => 'Challenge sent successfully'];
}

// Function to accept a challenge
function accept_challenge($conn, $challenge_id) {
    $current_time = time();
    
    // Get challenge details - don't filter by player_being_challenged yet
    $query = "SELECT * FROM challenges 
              WHERE id = $challenge_id 
              AND accepted = FALSE 
              AND expires > $current_time";
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        return ['success' => false, 'message' => 'Challenge not found or expired'];
    }
    
    $challenge = $result->fetch_assoc();
    $challenger = $challenge['challenger'];
    $username = $challenge['player_being_challenged'];
    
    // Mark challenge as accepted
    $update_query = "UPDATE challenges SET accepted = TRUE WHERE id = $challenge_id";
    execute_query($conn, $update_query);
    
    // Create a new game
    $start_time = time();
    $initial_board = 'initial_board_state'; // Replace with actual initial board state
    
    $game_query = "INSERT INTO games (white_player, black_player, turn, is_complete, board_state, start_timestamp) 
                  VALUES ('$challenger', '$username', 'white', FALSE, '$initial_board', $start_time)";
    execute_query($conn, $game_query);
    
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
    $query = "SELECT * FROM challenges 
              WHERE id = $challenge_id 
              AND player_being_challenged = '$username'";
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        return ['success' => false, 'message' => 'Challenge not found'];
    }
    
    // Delete the challenge
    $delete_query = "DELETE FROM challenges WHERE id = $challenge_id";
    execute_query($conn, $delete_query);
    
    return ['success' => true, 'message' => 'Challenge declined'];
}

// Function to get pending challenges for a user
function get_pending_challenges($conn, $username) {
    $current_time = time();
    
    // Get challenges where this user is being challenged
    $query = "SELECT c.id, c.challenger, c.challenge_timestamp, c.expires, u.elo 
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
    $query = "SELECT c.id, c.player_being_challenged, c.challenge_timestamp, c.expires, u.elo 
              FROM challenges c
              JOIN users u ON c.player_being_challenged = u.username
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
    $query = "SELECT * FROM challenges 
              WHERE id = $challenge_id 
              AND challenger = '$username'";
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        return ['success' => false, 'message' => 'Challenge not found'];
    }
    
    // Delete the challenge
    $delete_query = "DELETE FROM challenges WHERE id = $challenge_id";
    execute_query($conn, $delete_query);
    
    return ['success' => true, 'message' => 'Challenge cancelled'];
}

try {
    // Get action from request
    $action = isset($_GET['action']) ? $_GET['action'] : '';
    
    // Check if this is a public action (pending or outgoing challenges)
    $public_actions = ['pending', 'outgoing'];
    $is_public_action = in_array($action, $public_actions);
    
    // Get username from request for public actions
    $username = '';
  
    if (isset($_GET['username'])) {
        $username = sanitize_input($conn, $_GET['username']);
    }
  
    if (isset($_POST['username'])) {
        $username = sanitize_input($conn, $_POST['username']);
    } 

    if ($username === '' && ($action === 'pending' || $action === 'outgoing' || $action === 'create')) {
        throw new Exception('Username is required for this action');
    }

  
    
    // Handle different API actions
    switch ($action) {
        case 'create':
            
            // Create a new challenge
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Invalid request method');
            }
            
            // Get the JSON data from the request body
            $json_data = file_get_contents('php://input');
            $data = json_decode($json_data, true);
            
            if (!$data) {
                throw new Exception('Invalid JSON data');
            }
            
            // Get the challenged username from the request
            $challenged_username = isset($data['challenged_username']) ? sanitize_input($conn, $data['challenged_username']) : '';
            
            if (empty($challenged_username)) {
                throw new Exception('Challenged username is required');
            }
            
            // Create the challenge
            $result = create_challenge($conn, $username, $challenged_username);
            break;
            
        case 'accept':
            // Accept a challenge
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Invalid request method');
            }
            
            // Get the JSON data from the request body
            $json_data = file_get_contents('php://input');
            $data = json_decode($json_data, true);
            
            if (!$data) {
                throw new Exception('Invalid JSON data');
            }
            
            $challenge_id = isset($data['challenge_id']) ? (int)$data['challenge_id'] : 0;
            
            if ($challenge_id <= 0) {
                throw new Exception('Valid challenge ID is required');
            }
            
            $result = accept_challenge($conn, $challenge_id);
            break;
            
        case 'decline':
            // Decline a challenge
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Invalid request method');
            }
            
            // Get the JSON data from the request body
            $json_data = file_get_contents('php://input');
            $data = json_decode($json_data, true);
            
            if (!$data) {
                throw new Exception('Invalid JSON data');
            }
            
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

            $json_data = file_get_contents('php://input');
            $data = json_decode($json_data, true);

            if (!$data) {
                throw new Exception('Invalid JSON data');
            }

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
