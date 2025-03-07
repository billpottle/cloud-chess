<?php
// Remove any whitespace or output before this opening PHP tag

// Database connection details
$db_host = 'localhost';
$db_name = 'kattae68_cloud_chess';
$db_user = 'kattae68_cloud_chess_admin';
$db_pass = '1e+2pAGaO2CM'; //Temp for testing purposes

// Function to create a database connection
function create_connection() {
    global $db_host, $db_user, $db_pass, $db_name;
    
    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
    
    if ($conn->connect_error) {
        error_log("Connection failed: " . $conn->connect_error);
        throw new Exception("Database connection failed");
    }
    
    return $conn;
}

// Function to execute a query
function execute_query($conn, $query) {
    $result = $conn->query($query);
    
    if (!$result) {
        error_log("Query failed: " . $conn->error . " (Query: $query)");
        throw new Exception("Database query failed");
    }
    
    return $result;
}

// Function to close the database connection
function close_connection($conn) {
    $conn->close();
}

// Create a connection to use throughout the application
$conn = create_connection();

// Set character set to utf8mb4
$conn->set_charset("utf8mb4");

// Function to safely escape user input for SQL queries
function sanitize_input($conn, $data) {
    return $conn->real_escape_string($data);
}
// No closing PHP tag 