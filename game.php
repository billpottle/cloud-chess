<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Buffer all output to prevent header issues
ob_start();

// Check if game ID is provided
if (!isset($_GET['id'])) {
    // Clear any output before redirecting
    ob_end_clean();
    header('Location: index.html');
    exit;
}

$game_id = (int)$_GET['id'];

// Include database connection
require_once 'api/db_connect.php';

// Get game details - now without user filtering
$query = "SELECT g.* FROM games g WHERE g.id = $game_id";
$result = execute_query($conn, $query);

if ($result->num_rows === 0) {
    // Game not found
    ob_end_clean();
    header('Location: index.html');
    exit;
}

$game = $result->fetch_assoc();

// Close the database connection
close_connection($conn);

// Now we can send the HTML output
ob_end_flush();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Cloud Chess - Game #<?php echo $game_id; ?></title>
    
    <!-- CSS files -->
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/chess-board.css">
    <link rel="stylesheet" href="css/modals.css">
    <link rel="stylesheet" href="css/tables.css">
    <link rel="stylesheet" href="css/challenges.css">
    <link rel="stylesheet" href="styles.css">
    
    <!-- Favicon -->
    <link rel="icon" href="images/favicon.ico" sizes="any">
    <link rel="manifest" href="manifest.webmanifest">
    
    <!-- JavaScript files -->
    <script src="chess.js"></script>
    <script src="js/multiplayer.js"></script>
</head>
<body>
    <div class="navbar">
        <a href="index.html">Home</a>
        <a href="#" id="rules-link">Rules</a>
        <span id="auth-section" style="display: none;">
            <a href="api/login.php" id="login-link">Login</a>
            <a href="api/register.php" id="register-link">Register</a>
        </span>
        <span id="user-section" style="display: none;">
            <span id="user-welcome"></span>
            <a href="#" id="challenges-link" onclick="showChallengeModal(); return false;">Challenges</a> | 
            <a href="#" id="logout-link" onclick="logout(); return false;">Logout</a>
        </span>
    </div>
    
    <div class="container">
        <div class="game-header">
            <h1>Game #<?php echo $game_id; ?></h1>
            <div class="game-info">
                <p>White player: <strong><?php echo $game['white_player']; ?></strong></p>
                <p>Black player: <strong><?php echo $game['black_player']; ?></strong></p>
                <p>Current turn: <strong><span id="current-turn"><?php echo ucfirst($game['turn']); ?></span></strong></p>
                <p id="player-status">Game status: <strong><span id="game-status">Loading...</span></strong></p>
            </div>
        </div>
        
        <div id="game-board">
        
            <div id="board"></div>
        </div>
        
        <div class="game-controls">
            <button id="resign-btn" class="danger-button" style="display: none;">Resign Game</button>
            <button id="back-btn" class="secondary-button">Back to Home</button>
        </div>
    </div>
    
    <!-- Rules Modal -->
    <div id="rules-modal" class="modal">
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h1>Cloud Chess Rules</h1>
            
            <div class="rules-content">
                <h2>Basic Rules</h2>
                <p>Cloud Chess follows standard chess rules with the addition of special pieces and a larger 10x10 board.</p>
                
                <!-- Rules content here -->
            </div>
        </div>
    </div>
    
    <!-- Include all necessary JavaScript files -->
    <script src="js/ui.js"></script>
    <script src="js/user.js"></script>
    <script src="js/challenges.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Get game data from PHP
            const gameId = <?php echo $game_id; ?>;
            const whitePlayer = '<?php echo $game['white_player']; ?>';
            const blackPlayer = '<?php echo $game['black_player']; ?>';
            const currentTurn = '<?php echo $game['turn']; ?>';
            const boardState = <?php echo json_encode($game['board_state']); ?>;
            
            // Parse the board state if it's a string
            let parsedBoardState;
            if (typeof boardState === 'string') {
                if (boardState === 'initial_board_state') {
                    console.log('Using initial board state');
                    // Use null to let the ChessGame constructor create a new board with default positions
                    parsedBoardState = null;
                } else {
                    try {
                        parsedBoardState = JSON.parse(boardState);
                        console.log('Parsed board state:', parsedBoardState);
                    } catch (e) {
                        console.error('Error parsing board state:', e);
                        // Use null to let the ChessGame constructor create a new board with default positions
                        parsedBoardState = null;
                    }
                }
            } else {
                parsedBoardState = boardState;
            }
            
            // Get current user from localStorage
            const currentUsername = localStorage.getItem('chessUsername');
            let playerColor = null;
            let isSpectator = true;
            
            // Determine if user is a player and which color
            if (currentUsername) {
                if (currentUsername === whitePlayer) {
                    playerColor = 'white';
                    isSpectator = false;
                } else if (currentUsername === blackPlayer) {
                    playerColor = 'black';
                    isSpectator = false;
                }
            }
            
            // Update UI based on user role
            const isMyTurn = playerColor === currentTurn;
            
            // Update game status
            const gameStatusElement = document.getElementById('game-status');
            const playerStatusElement = document.getElementById('player-status');

            if (isSpectator) {
                gameStatusElement.textContent = 'Spectating';
                gameStatusElement.className = 'spectating';
                playerStatusElement.innerHTML = 'You are: <strong><span class="spectating">Spectator</span></strong>';
                
                // Hide the resign button for spectators
                document.getElementById('resign-btn').style.display = 'none';
            } else if (isMyTurn) {
                gameStatusElement.textContent = 'Your turn';
                gameStatusElement.className = 'your-turn';
                playerStatusElement.innerHTML = 'You are playing as: <strong>' + playerColor + '</strong>';
                
                // Show resign button only for players
                document.getElementById('resign-btn').style.display = 'inline-block';
            } else {
                gameStatusElement.textContent = 'Waiting for opponent';
                gameStatusElement.className = 'waiting';
                playerStatusElement.innerHTML = 'You are playing as: <strong>' + playerColor + '</strong>';
                
                // Show resign button only for players
                document.getElementById('resign-btn').style.display = 'inline-block';
            }
            
            console.log('Game data:', {
                gameId,
                whitePlayer,
                blackPlayer,
                currentTurn,
                boardState,
                currentUsername,
                playerColor,
                isSpectator,
                isMyTurn
            });
            
            // Initialize the multiplayer game
            initializeMultiplayerGame(gameId, playerColor, currentTurn, parsedBoardState, isSpectator);
            
            // Set up event listeners
            if (!isSpectator) {
                document.getElementById('resign-btn').addEventListener('click', resignGame);
            }
            
            document.getElementById('back-btn').addEventListener('click', function() {
                window.location.href = 'index.html';
            });
            
            // Set up rules modal
            document.getElementById('rules-link').addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('rules-modal').style.display = 'block';
            });
            
            document.querySelector('#rules-modal .close-modal').addEventListener('click', function() {
                document.getElementById('rules-modal').style.display = 'none';
            });
            
            // Close modals when clicking outside
            window.addEventListener('click', function(event) {
                if (event.target.classList.contains('modal')) {
                    event.target.style.display = 'none';
                }
            });
            
            // Check for game updates periodically if it's not your turn or you're spectating
          
                checkForGameUpdates();
                setInterval(checkForGameUpdates, 5000); // Check every 5 seconds
            
            
            // Update authentication UI
            updateAuthUI();
        });
        
        // Function to update authentication UI
        function updateAuthUI() {
            if (isLoggedIn()) {
                document.getElementById('auth-section').style.display = 'none';
                document.getElementById('user-section').style.display = 'inline';
                
                // Update welcome message
                const username = localStorage.getItem('chessUsername');
                document.getElementById('user-welcome').textContent = 'Welcome, ' + username;
            } else {
                document.getElementById('auth-section').style.display = 'inline';
                document.getElementById('user-section').style.display = 'none';
            }
        }
    </script>
</body>
</html> 