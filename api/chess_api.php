<?php
// Include database connection
require_once 'db_connect.php';

// Set header to return JSON
header('Content-Type: application/json');

// Function to create necessary tables if they don't exist
function initialize_database($conn) {
    // Games table
    $query = "CREATE TABLE IF NOT EXISTS games (
        game_id VARCHAR(36) PRIMARY KEY,
        white_player VARCHAR(50),
        black_player VARCHAR(50),
        game_state TEXT,
        last_move TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_move_white VARCHAR(30) DEFAULT NULL,
        last_move_black VARCHAR(30) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('waiting', 'active', 'completed') DEFAULT 'waiting'
    )";
    execute_query($conn, $query);
    
    // Moves table
    $query = "CREATE TABLE IF NOT EXISTS moves (
        move_id INT AUTO_INCREMENT PRIMARY KEY,
        game_id VARCHAR(36),
        player VARCHAR(50),
        move_notation VARCHAR(10),
        board_state TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(game_id)
    )";
    execute_query($conn, $query);
}

// Initialize database tables
initialize_database($conn);

// Handle API requests
$action = isset($_POST['action']) ? $_POST['action'] : '';

switch ($action) {
    case 'create_game':
        // Create a new game
        $player_name = sanitize_input($conn, $_POST['player_name']);
        $game_id = uniqid();
        
        $query = "INSERT INTO games (game_id, white_player, status) 
                  VALUES ('$game_id', '$player_name', 'waiting')";
        execute_query($conn, $query);
        
        echo json_encode(['success' => true, 'game_id' => $game_id]);
        break;
        
    case 'join_game':
        // Join an existing game
        $game_id = sanitize_input($conn, $_POST['game_id']);
        $player_name = sanitize_input($conn, $_POST['player_name']);
        
        $query = "UPDATE games SET black_player = '$player_name', status = 'active' 
                  WHERE game_id = '$game_id' AND status = 'waiting'";
        execute_query($conn, $query);
        
        if ($conn->affected_rows > 0) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Game not found or already started']);
        }
        break;
        
    case 'save_move':
        // Save a move to the database
        $game_id = sanitize_input($conn, $_POST['game_id']);
        $player = sanitize_input($conn, $_POST['player']);
        $move = sanitize_input($conn, $_POST['move']);
        $board_state = sanitize_input($conn, $_POST['board_state']);
        
        $query = "INSERT INTO moves (game_id, player, move_notation, board_state) 
                  VALUES ('$game_id', '$player', '$move', '$board_state')";
        execute_query($conn, $query);
        
        // Update the game state
        $query = "UPDATE games SET game_state = '$board_state', last_move = CURRENT_TIMESTAMP 
                  WHERE game_id = '$game_id'";
        execute_query($conn, $query);
        
        echo json_encode(['success' => true]);
        break;
        
    case 'get_game_state':
        // Get the current state of a game
        $game_id = sanitize_input($conn, $_POST['game_id']);
        
        $query = "SELECT * FROM games WHERE game_id = '$game_id'";
        $result = execute_query($conn, $query);
        
        if ($result->num_rows > 0) {
            $game = $result->fetch_assoc();
            echo json_encode(['success' => true, 'game' => $game]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Game not found']);
        }
        break;
        
    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
}

// Close the database connection
close_connection($conn);
?> 
