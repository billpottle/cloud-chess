// Global variables to store game state
let multiplayerGame = null;
let currentGameId = null;
let playerColor = null;
let isSpectatorMode = false;

function initializeMultiplayerGame(gameId, color, currentTurn, boardState, isSpectator) {
    console.log('Initializing multiplayer game:', {
        gameId,
        color,
        currentTurn,
        boardState,
        isSpectator
    });

    // Store game information
    currentGameId = gameId;
    playerColor = color;
    isSpectatorMode = isSpectator;

    // Create a new game instance
    if (!multiplayerGame) {
        multiplayerGame = new ChessGame();
        
        // Initialize the game board
        if (!boardState || boardState === 'initial_board_state') {
            console.log('Using initial board state');
            multiplayerGame.gameBoard = multiplayerGame.createInitialBoard();
        } else {
            console.log('Using provided board state:', boardState);
            multiplayerGame.gameBoard = boardState;
        }
    }

    // Get the board container
    const boardContainer = document.getElementById('board');
    if (!boardContainer) {
        console.error('Board container not found');
        return;
    }

    // Store the board container in the game instance
    multiplayerGame.board = boardContainer;

    // Initialize the board display
    multiplayerGame.initializeBoard();

    // If not the player's turn or spectating, disable board interaction
    if (isSpectator || color !== currentTurn) {
        disableBoardInteraction();
    }

    console.log('Multiplayer game initialized');
}

function disableBoardInteraction() {
    // Remove click event listeners from all squares
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => {
        const clone = square.cloneNode(true);
        square.parentNode.replaceChild(clone, square);
    });
}

function enableBoardInteraction() {
    // Re-add click event listeners to all squares
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => {
        square.addEventListener('click', (e) => multiplayerGame.handleSquareClick(e));
    });
}

function checkForGameUpdates() {
    // This will be implemented later to poll for game updates
    console.log('Checking for game updates...');
}

function resignGame() {
    if (confirm('Are you sure you want to resign?')) {
        // This will be implemented later to handle game resignation
        console.log('Resigning game...');
    }
} 