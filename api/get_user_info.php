<?php
// Enable error reporting for debugging
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
    
    // Check if user_id is provided
    if (!isset($_GET['user_id'])) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'User ID is required']);
        exit;
    }
    
    $user_id = (int)$_GET['user_id'];
    
    // Get user information
    $query = "SELECT username, email, wins, losses, elo FROM users WHERE id = $user_id";
    $result = execute_query($conn, $query);
    
    if ($result->num_rows === 0) {
        ob_end_clean();
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }
    
    $user = $result->fetch_assoc();
    
    // Ensure elo is an integer
    $user['elo'] = isset($user['elo']) ? (int)$user['elo'] : 1000;
    
    // Get all users for debugging
    $all_users = [];
    $users_query = "SELECT id, username, elo FROM users ORDER BY elo DESC";
    $users_result = execute_query($conn, $users_query);
    while ($row = $users_result->fetch_assoc()) {
        $row['elo'] = (int)$row['elo'];
        $all_users[] = $row;
    }
    
    // Calculate ranking directly by counting users with higher ELO
    $rank = 1;
    foreach ($all_users as $u) {
        if ($u['elo'] > $user['elo']) {
            $rank++;
        }
    }
    
    // Total users count
    $total_users = count($all_users);
    
    // After fetching user data
    $user['totalGames'] = (isset($user['wins']) ? (int)$user['wins'] : 0) + (isset($user['losses']) ? (int)$user['losses'] : 0);
    
    // Clear the output buffer before sending JSON
    ob_end_clean();
    
    // Simplified response without duplication
    $response = [
        'success' => true,
        'username' => $user['username'],
        'email' => $user['email'],
        'wins' => isset($user['wins']) ? (int)$user['wins'] : 0,
        'losses' => isset($user['losses']) ? (int)$user['losses'] : 0,
        'elo' => $user['elo'],
        'rank' => $rank,
        'total_users' => $total_users,
        'totalGames' => $user['totalGames'],
        
        // Add debug info to view in browser console
        'debug' => [
            'all_users' => $all_users,
            'calculation' => "User {$user['username']} with ELO {$user['elo']} is ranked {$rank} of {$total_users}"
        ]
    ];
    
    echo json_encode($response);
    
    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response with debug info
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while processing your request',
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}

exit;
?> 