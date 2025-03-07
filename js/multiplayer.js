// Global variables to store game state
let multiplayerGame = null;
let currentGameId = null;
let playerColor = null;
let isSpectatorMode = false;

function convertPiecesToBoard(pieces) {
    // Create empty 10x10 board
    const board = Array(10).fill().map(() => Array(10).fill(''));
    
    // Map piece types to Unicode chess symbols
    const pieceSymbols = {
        'king': { 'white': '♔', 'black': '♚' },
        'queen': { 'white': '♕', 'black': '♛' },
        'rook': { 'white': '♖', 'black': '♜' },
        'bishop': { 'white': '♗', 'black': '♝' },
        'knight': { 'white': '♘', 'black': '♞' },
        'pawn': { 'white': '♙', 'black': '♟' },
        'archer': { 'white': '♙⇡', 'black': '♟⇣' },
        'dragon': { 'white': 'dragon-white', 'black': 'dragon-black' }
    };

    // Place each piece on the board
    pieces.forEach(piece => {
        if (piece.type === 'dragon') {
            board[piece.row][piece.col] = pieceSymbols.dragon[piece.color];
        } else {
            board[piece.row][piece.col] = pieceSymbols[piece.type][piece.color];
        }
    });

    return board;
}

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
            console.log('Converting provided board state');
            multiplayerGame.gameBoard = convertPiecesToBoard(boardState);
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