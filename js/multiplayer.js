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
        
        // Set the current player to match the game's turn
        multiplayerGame.currentPlayer = currentTurn;
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

    // Override the handleSquareClick method to add multiplayer functionality
    const originalHandleSquareClick = multiplayerGame.handleSquareClick;
    multiplayerGame.handleSquareClick = function(e) {
        // Only allow moves if it's the player's turn and they're not spectating
        if (isSpectatorMode || playerColor !== this.currentPlayer) {
            console.log('Not your turn or spectating');
            return;
        }

        // Call the original method
        originalHandleSquareClick.call(this, e);
    };

    // Override the movePiece method to add server update
    const originalMovePiece = multiplayerGame.movePiece;
    multiplayerGame.movePiece = function(toRow, toCol) {
        // Call the original move piece method
        originalMovePiece.call(this, toRow, toCol);

        // After the move is made, convert the board to the server format
        const boardState = convertBoardToPieces(this);
        const nextTurn = this.currentPlayer === 'white' ? 'black' : 'white';

        // Send the update to the server
        updateGameState(boardState, nextTurn);
    };

    // If not the player's turn or spectating, disable board interaction
    if (isSpectator || color !== currentTurn) {
        console.log('Disabling board interaction - not your turn or spectating');
        disableBoardInteraction();
    } else {
        console.log('Enabling board interaction - it is your turn');
        enableBoardInteraction();
    }

    console.log('Multiplayer game initialized with current player:', multiplayerGame.currentPlayer);
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
    console.log('Enabling board interaction');
    
    // First, make sure all existing event listeners are removed
    disableBoardInteraction();
    
    // Then add new event listeners
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => {
        square.addEventListener('click', (e) => {
            console.log('Square clicked:', e.currentTarget.dataset.row, e.currentTarget.dataset.col);
            multiplayerGame.handleSquareClick(e);
        });
    });
}

function checkForGameUpdates() {
    console.log('Checking for game updates...');
    
    // Send the request to get the latest game state using GET
    fetch(`api/get_game.php?id=${currentGameId}`, {
        method: 'GET'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('Received game update:', data.game);
            
            // Check if the turn has changed
            if (data.game.turn !== multiplayerGame.currentPlayer) {
                console.log('Turn has changed, updating board');
                
                // Update the current player
                multiplayerGame.currentPlayer = data.game.turn;
                
                // Update the turn display
                const turnDisplay = document.getElementById('current-turn');
                if (turnDisplay) {
                    turnDisplay.textContent = data.game.turn.charAt(0).toUpperCase() + data.game.turn.slice(1);
                }
                
                // Update the board with the new state
                const boardState = data.game.board_state;
                if (typeof boardState === 'string') {
                    try {
                        const parsedState = JSON.parse(boardState);
                        updateBoardDisplay(parsedState);
                    } catch (e) {
                        console.error('Error parsing board state:', e);
                    }
                } else if (Array.isArray(boardState)) {
                    updateBoardDisplay(boardState);
                }
                
                // Enable board interaction if it's the player's turn
                if (playerColor === data.game.turn && !isSpectatorMode) {
                    enableBoardInteraction();
                }
            }
        } else {
            console.error('Failed to get game update:', data.message);
        }
    })
    .catch(error => {
        console.error('Error checking for game updates:', error);
    });
}

function updateBoardDisplay(boardState) {
    // Clear the current board
    const boardContainer = document.getElementById('board');
    if (!boardContainer) {
        console.error('Board container not found');
        return;
    }
    
    // Convert the board state to the format expected by the game
    multiplayerGame.gameBoard = convertPiecesToBoard(boardState);
    
    // Re-initialize the board display
    multiplayerGame.initializeBoard();
    
    // Debug: Log the pieces that were placed
    console.log('Updated board with pieces:', boardState);
}

function resignGame() {
    if (confirm('Are you sure you want to resign?')) {
        console.log('Resigning game...');
        
        // Get the authentication token
        const token = localStorage.getItem('chessAuthToken');
        if (!token) {
            console.error('No authentication token found');
            return;
        }
        
        // Create form data for the request
        const formData = new FormData();
        formData.append('token', token);
        formData.append('game_id', currentGameId);
        formData.append('action', 'resign');
        
        // Send the resignation to the server
        fetch('api/update_game.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('You have resigned the game.');
                window.location.href = 'index.html'; // Redirect to home page
            } else {
                console.error('Failed to resign game:', data.message);
                alert('Failed to resign: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error resigning game:', error);
            alert('Error resigning game. Please try again.');
        });
    }
}

function convertBoardToPieces(gameInstance) {
    const pieces = [];
    const pieceTypes = {
        '♔': { type: 'king', color: 'white' },
        '♚': { type: 'king', color: 'black' },
        '♕': { type: 'queen', color: 'white' },
        '♛': { type: 'queen', color: 'black' },
        '♖': { type: 'rook', color: 'white' },
        '♜': { type: 'rook', color: 'black' },
        '♗': { type: 'bishop', color: 'white' },
        '♝': { type: 'bishop', color: 'black' },
        '♘': { type: 'knight', color: 'white' },
        '♞': { type: 'knight', color: 'black' },
        '♙': { type: 'pawn', color: 'white' },
        '♟': { type: 'pawn', color: 'black' },
        '♙⇡': { type: 'archer', color: 'white' },
        '♟⇣': { type: 'archer', color: 'black' },
        'dragon-white': { type: 'dragon', color: 'white' },
        'dragon-black': { type: 'dragon', color: 'black' }
    };

    // Get all squares from the board
    const squares = gameInstance.board.querySelectorAll('.square');
    squares.forEach(square => {
        const piece = square.querySelector('.piece');
        if (piece) {
            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            const color = piece.dataset.color;
            
            // Handle dragon pieces
            if (piece.dataset.type === 'dragon') {
                pieces.push({
                    row: row,
                    col: col,
                    type: 'dragon',
                    color: color
                });
            } else {
                // Handle regular pieces
                const pieceText = piece.textContent;
                if (pieceTypes[pieceText]) {
                    pieces.push({
                        row: row,
                        col: col,
                        ...pieceTypes[pieceText]
                    });
                }
            }
        }
    });

    return pieces;
}

function updateGameState(boardState, nextTurn) {
    console.log('Updating game state:', { boardState, nextTurn });

    // Get the authentication token from localStorage with correct key
    const token = localStorage.getItem('chessAuthToken');
    if (!token) {
        console.error('No authentication token found');
        return;
    }

    // Create form data for the request
    const formData = new FormData();
    formData.append('token', token);
    formData.append('game_id', currentGameId);
    formData.append('board_state', JSON.stringify(boardState));
    formData.append('next_turn', nextTurn);

    // Send the update to the server
    fetch('api/update_game.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Game state updated successfully');
            
            // Disable board interaction since it's now the other player's turn
            disableBoardInteraction();
            
            // Update the turn display
            const turnDisplay = document.getElementById('current-turn');
            if (turnDisplay) {
                turnDisplay.textContent = nextTurn.charAt(0).toUpperCase() + nextTurn.slice(1);
            }
        } else {
            console.error('Failed to update game state:', data.message);
            // You might want to handle this error, perhaps by rolling back the move
        }
    })
    .catch(error => {
        console.error('Error updating game state:', error);
    });
} 