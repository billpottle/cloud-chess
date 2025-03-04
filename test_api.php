<?php
// Simple test script to check if the API is working
header('Content-Type: text/plain');

echo "Testing API endpoints:\n\n";

// Test get_user_info.php
$user_id = 1; // Assuming user ID 1 exists
echo "Testing get_user_info.php with user_id=$user_id\n";
$response = file_get_contents("http://{$_SERVER['HTTP_HOST']}/cloud-chess/get_user_info.php?user_id=$user_id");
echo "Response:\n$response\n\n";

// Test get_user_basic.php
echo "Testing get_user_basic.php with user_id=$user_id\n";
$response = file_get_contents("http://{$_SERVER['HTTP_HOST']}/cloud-chess/get_user_basic.php?user_id=$user_id");
echo "Response:\n$response\n\n";

// Test check_session.php
echo "Testing check_session.php\n";
$response = file_get_contents("http://{$_SERVER['HTTP_HOST']}/cloud-chess/check_session.php");
echo "Response:\n$response\n\n";

// Test database structure
echo "Testing database structure\n";
require_once 'db_connect.php';

echo "Checking users table structure:\n";
$result = execute_query($conn, "DESCRIBE users");
while ($row = $result->fetch_assoc()) {
    echo "- {$row['Field']}: {$row['Type']}\n";
}
echo "\n";

echo "Checking user count:\n";
$result = execute_query($conn, "SELECT COUNT(*) as count FROM users");
$row = $result->fetch_assoc();
echo "Total users: {$row['count']}\n\n";

close_connection($conn);

echo "Tests completed.";
?> 