<?php
// Enable error reporting for debugging but log to file instead of output
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

// Make sure no output is sent before including files that modify headers
ob_start();

try {
    // Include database connection
    require_once 'db_connect.php';
    
    // Set header to return JSON
    header('Content-Type: application/json');
    
    // Get sort parameter (default to elo)
    $sort_by = isset($_GET['sort']) ? sanitize_input($conn, $_GET['sort']) : 'elo';
    
    // Validate sort parameter
    $valid_sorts = ['elo', 'wins', 'losses'];
    if (!in_array($sort_by, $valid_sorts)) {
        $sort_by = 'elo'; // Default to elo if invalid
    }
    
    // Order direction (descending for elo and wins, ascending for losses)
    $order = 'DESC';
    
    // Use different queries based on sort type to ensure proper numeric sorting
    if ($sort_by === 'elo') {
        $query = "SELECT id, username, elo, wins, losses FROM users ORDER BY CAST(elo AS SIGNED) $order LIMIT 50";
    } else if ($sort_by === 'wins') {
        $query = "SELECT id, username, elo, wins, losses FROM users ORDER BY CAST(wins AS SIGNED) $order LIMIT 50";
    } else if ($sort_by === 'losses') {
        $query = "SELECT id, username, elo, wins, losses FROM users ORDER BY CAST(losses AS SIGNED) $order LIMIT 50";
    } else {
        // Default to elo
        $query = "SELECT id, username, elo, wins, losses FROM users ORDER BY CAST(elo AS SIGNED) DESC LIMIT 50";
    }
    $result = execute_query($conn, $query);
    
    $players = [];
    $rank = 1;
    
    while ($row = $result->fetch_assoc()) {
        // Convert string values to integers
        $row['id'] = (int)$row['id'];
        $row['elo'] = (int)$row['elo'];
        $row['wins'] = (int)$row['wins'];
        $row['losses'] = (int)$row['losses'];
        $row['rank'] = $rank++;
        $players[] = $row;
    }
    
    // Clear the output buffer before sending JSON
    ob_end_clean();
    
    // Return success response
    echo json_encode([
        'success' => true,
        'players' => $players,
        'sort_by' => $sort_by
    ]);
    
    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Log the error
    error_log("Error in get_top_players.php: " . $e->getMessage());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while retrieving player rankings'
    ]);
}

exit;
?> 