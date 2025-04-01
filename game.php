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

// Get game details from the database
$query = "SELECT g.*, 
    DATE_FORMAT(FROM_UNIXTIME(g.end_timestamp), '%M %D, %Y at %l:%i %p') as formatted_end_date 
    FROM games g WHERE g.id = $game_id";
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
        <a href="profile.html" id="profile-link">Profile</a>
        <span id="auth-section" style="display: none;">
            <a href="api/login.php" id="login-link">Login</a>
            <a href="api/register.php" id="register-link">Register</a>
        </span>
        <span id="user-section" style="display: none;">
            <span id="user-welcome"></span>
            <a href="#" id="logout-link" onclick="logout(); return false;">Logout</a>
        </span>
    </div>
    
    <div class="container">
        <div class="game-header">
            <h1 class="game-title">Game #<?php echo $game_id; ?></h1>
            <button class="game-btn danger" id="resign-btn">Resign Game</button>
        </div>

        <div class="game-info-container">
            <?php if (!$game['is_complete']): ?>
                <div class="player-info-active">
                    <span>White: <?php echo $game['white_player']; ?></span>
                    <span>Black: <?php echo $game['black_player']; ?></span>
                </div>
                <div class="game-status-active">
                    <div id="current-turn-container">Turn: <span id="current-turn"><?php echo ucfirst($game['turn']); ?></span></div>
                    <div id="player-status">Loading...</div>
                </div>
            <?php else: ?>
                <div class="game-result-info">
                    <?php
                    $resultText = '';
                    $resultClass = '';
                    $winner = $game['winner'];
                    $loser = null;

                    if ($game['result'] === 'win' || $game['result'] === 'resignation') {
                        if ($winner === $game['white_player']) {
                            $loser = $game['black_player'];
                            $resultText = ($game['result'] === 'resignation') ? 'Black Resigned' : 'White Won';
                            $resultClass = 'white-win';
                        } else {
                            $loser = $game['white_player'];
                            $resultText = ($game['result'] === 'resignation') ? 'White Resigned' : 'Black Won';
                            $resultClass = 'black-win';
                        }
                    } elseif ($game['result'] === 'draw') {
                        $resultText = 'Game Drawn';
                        $resultClass = 'draw';
                        $winner = $game['white_player'];
                        $loser = $game['black_player'];
                    }
                    ?>
                    
                    <div class="result-player-names">
                        <span>White: <?php echo $game['white_player']; ?></span>
                        <span>Black: <?php echo $game['black_player']; ?></span>
                    </div>

                    <div class="result-header <?php echo $resultClass; ?>">
                        <h3><?php echo $resultText; ?></h3>
                    </div>
                    <div class="result-details">
                        <p>Ended: <?php echo $game['formatted_end_date']; ?></p>
                        <div class="elo-changes">
                            <?php if ($game['result'] !== 'draw'): ?>
                                <p><strong><?php echo $winner; ?></strong>:
                                    <span class="positive-elo">+<?php echo $game['winner_elo_change']; ?></span>
                                </p>
                                <?php if ($loser !== null): ?>
                                <p><strong><?php echo $loser; ?></strong>:
                                    <span class="negative-elo"><?php echo $game['loser_elo_change']; ?></span>
                                </p>
                                <?php endif; ?>
                            <?php else: ?>
                                <p><strong><?php echo $winner; ?></strong>:
                                    <span><?php echo ($game['winner_elo_change'] >= 0 ? '+' : '') . $game['winner_elo_change']; ?></span>
                                </p>
                                <p><strong><?php echo $loser; ?></strong>:
                                    <span><?php echo ($game['loser_elo_change'] >= 0 ? '+' : '') . $game['loser_elo_change']; ?></span>
                                </p>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            <?php endif; ?>
        </div>
        
        <div id="game-board">
        
            <div id="board"></div>
        </div>
    </div>
    
    <!-- Rules Modal -->
    <div id="rules-modal" class="modal">
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <div id="rules-container">
                <?php include 'rules.html'; ?>
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
            const isComplete = <?php echo $game['is_complete'] ? 'true' : 'false'; ?>;
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
            
            // Hide resign button if game is complete
            if (isComplete) {
                document.getElementById('resign-btn').style.display = 'none';
            } else {
                // Update UI based on user role only for active games
                if (isSpectator) {
                    document.getElementById('resign-btn').style.display = 'none';
                } else {
                    document.getElementById('resign-btn').style.display = 'inline-block';
                    document.getElementById('resign-btn').addEventListener('click', resignGame);
                }
            }
            
            // Initialize the multiplayer game
            initializeMultiplayerGame(gameId, playerColor, currentTurn, parsedBoardState, isSpectator);
            
            // Only set up game updates for active games
            if (!isComplete) {
                checkForGameUpdates();
                setInterval(checkForGameUpdates, 5000);
            }
            
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