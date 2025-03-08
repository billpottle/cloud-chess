<?php
// Enable error reporting for debugging but log to file instead of output
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

// Make sure no output is sent before including files that modify headers
ob_start();

// Include database connection
require_once 'db_connect.php';

// Set header to return JSON
header('Content-Type: application/json');

// Function to update user's last activity timestamp
function update_user_activity($conn, $user_id) {
    $current_time = time();
    $query = "UPDATE users SET last_activity = $current_time WHERE id = $user_id";
    execute_query($conn, $query);
}

// Function to get active users (active in the last hour)
function get_active_users($conn, $current_user_id = null) {
    $one_hour_ago = time() - 3600; // 1 hour in seconds
    
    // Get users who were active in the last hour (including current user)
    $exclude_condition = "";
    $query = "SELECT id, username, elo FROM users WHERE last_activity > $one_hour_ago $exclude_condition ORDER BY username";
    $result = execute_query($conn, $query);
    
    $active_users = [];
    while ($row = $result->fetch_assoc()) {
        $active_users[] = [
            'id' => (int)$row['id'],
            'username' => $row['username'],
            'elo' => (int)$row['elo']
        ];
    }
    
    return $active_users;
}

// Function to load active users
function loadActiveUsers($conn) {
    // Query to get active users (users who have been active in the last 15 minutes)
    $query = "SELECT id as user_id, username, last_active FROM users 
              WHERE last_active > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
              ORDER BY username";
    
    $result = mysqli_query($conn, $query);
    
    $activeUsers = array();
    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $activeUsers[] = $row;
        }
        mysqli_free_result($result);
    }
    
    return $activeUsers;
}

try {
    // Check the request type
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Update user activity
        if (isset($_SESSION['user_id'])) {
            // Check if last_activity column exists before updating
            $check_column_query = "SHOW COLUMNS FROM users LIKE 'last_activity'";
            $column_result = execute_query($conn, $check_column_query);
            
            if ($column_result->num_rows > 0) {
                update_user_activity($conn, $_SESSION['user_id']);
            }
            
            // Clear the output buffer before sending JSON
            ob_end_clean();
            
            echo json_encode([
                'success' => true,
                'message' => 'Activity updated'
            ]);
        } else {
            // Clear the output buffer before sending JSON
            ob_end_clean();
            
            echo json_encode([
                'success' => false,
                'message' => 'Not logged in'
            ]);
        }
    } else {
        // GET request - return active users
    
        $active_users = get_active_users($conn, $current_user_id);
       
        
        // Clear the output buffer before sending JSON
        ob_end_clean();
        
        echo json_encode([
            'success' => true,
            'active_users' => $active_users
        ]);
    }
    
    // Close the database connection
    close_connection($conn);
} catch (Exception $e) {
    // Log the error
    error_log("Error in active_users.php: " . $e->getMessage());
    
    // Clear any output that might have been generated
    ob_end_clean();
    
    // Return a clean error response
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while processing active users'
    ]);
}

exit;
?> 