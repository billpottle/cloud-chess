<?php
// Database connection parameters
$db_host = 'localhost';     
$db_name = 'kattae68_cloud_chess';
$db_user = 'kattae68_cloud_chess_admin';
$db_pass = '1e+2pAGaO2CM'; //Temp for testing purposes

// Create connection
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Set character set to utf8mb4
$conn->set_charset("utf8mb4");

// Function to safely escape user input for SQL queries
function sanitize_input($conn, $data) {
    return $conn->real_escape_string($data);
}

// Function to execute a query and return the result
function execute_query($conn, $query) {
    $result = $conn->query($query);
    if (!$result) {
        die("Query failed: " . $conn->error);
    }
    return $result;
}

// Function to close the database connection
function close_connection($conn) {
    $conn->close();
}
?> 