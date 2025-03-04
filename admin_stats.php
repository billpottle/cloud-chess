<?php
// Check if user is admin (you'll need to implement proper authentication)
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['user_id'] != 1) { // Assuming user_id 1 is admin
    header('Location: index.html');
    exit;
}

// Include database connection
require_once 'db_connect.php';

// Get game usage statistics
$query = "SELECT * FROM game_usage ORDER BY number DESC";
$result = execute_query($conn, $query);

// Close the database connection
close_connection($conn);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Game Usage Statistics - Admin</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .back-link {
            display: inline-block;
            margin-top: 20px;
            color: #4CAF50;
            text-decoration: none;
        }
        .back-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Game Usage Statistics</h1>
        
        <table>
            <thead>
                <tr>
                    <th>Game Type</th>
                    <th>Number of Games</th>
                </tr>
            </thead>
            <tbody>
                <?php while ($row = $result->fetch_assoc()): ?>
                <tr>
                    <td><?php echo htmlspecialchars($row['game_type']); ?></td>
                    <td><?php echo $row['number']; ?></td>
                </tr>
                <?php endwhile; ?>
            </tbody>
        </table>
        
        <a href="index.html" class="back-link">Back to Game</a>
    </div>
</body>
</html> 