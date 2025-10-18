// Global variables to store game state
let multiplayerGame = null;
let currentGameId = null;
let playerColor = null;
let isSpectatorMode = false;
let currentSpecialStatus = null;

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
        if (piece && piece.row !== undefined && piece.col !== undefined) {
            if (piece.type === 'dragon') {
                board[piece.row][piece.col] = pieceSymbols.dragon[piece.color];
            } else if (pieceSymbols[piece.type] && pieceSymbols[piece.type][piece.color]) {
                board[piece.row][piece.col] = pieceSymbols[piece.type][piece.color];
            } else {
                console.warn('Unknown piece type or color:', piece);
            }
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
        
        // Override the showGameStatusAnimation method
        multiplayerGame.showGameStatusAnimation = function(type, text) {
            // Store the special status for the next update
            currentSpecialStatus = type;
            console.log('new current special status', currentSpecialStatus);
            
            // Create the animation element
            const animation = document.createElement('div');
            animation.className = `game-status-animation ${type}-animation`;
            animation.textContent = text;
            
            // Add it to the board
            const boardContainer = document.getElementById('board');
            if (boardContainer) {
                boardContainer.appendChild(animation);
                
                // Remove it after the animation completes
                setTimeout(() => {
                    if (animation.parentNode === boardContainer) {
                        boardContainer.removeChild(animation);
                    }
                }, type === 'checkmate' ? 3000 : 2000);
            }
        };
        
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
    
    // --- FIX: Remove the base board listener to prevent double handling ---
    // The base initializeBoard adds its own listener to the board element.
    // We need to remove it because enableBoardInteraction will add listeners
    // to the individual squares, which call the overridden handleSquareClick.
    if (multiplayerGame.board && multiplayerGame.handleSquareClick) {
        // Note: At this point, multiplayerGame.handleSquareClick still refers to the
        // bound original method from the ChessGame class, before the override below.
        multiplayerGame.board.removeEventListener('click', multiplayerGame.handleSquareClick);
        console.log("Removed base ChessGame board click listener to avoid conflicts.");
    }
    // --- END FIX ---
    
    // Apply styling immediately after initialization
    setTimeout(() => {
        fixPieceStyling();
    }, 100);

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

    // Use the engine's after-move hook instead of overriding logic
    multiplayerGame.onAfterMove = function() {
        // Convert the board to the server format
        const boardState = convertBoardToPieces(this);
        const nextTurn = this.currentPlayer === 'white' ? 'black' : 'white';

        if (this.isCheckmate(nextTurn)) {
            console.log(`Checkmate! ${this.currentPlayer} wins!`);
            currentSpecialStatus = 'checkmate';
            updateGameState(boardState, nextTurn);
            this.showGameStatusAnimation('checkmate', 'CHECKMATE!');
            setTimeout(() => finalizeGame('checkmate'), 2000);
        } else {
            const opponentColor = this.currentPlayer === 'white' ? 'black' : 'white';
            currentSpecialStatus = this.isKingInCheck(opponentColor) ? 'check' : null;
            updateGameState(boardState, nextTurn);
        }

        setTimeout(() => fixPieceStyling(), 100);
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

                // Check for special status and trigger animation if exists
                if (data.game.special_status) {
                    let animationText = '';
                    switch(data.game.special_status) {
                        case 'check':
                            animationText = 'CHECK!';
                            break;
                        case 'checkmate':
                            animationText = 'CHECKMATE!';
                            break;
                        case 'promotion':
                            animationText = 'PROMOTION!';
                            break;
                    }
                    if (animationText) {
                        multiplayerGame.showGameStatusAnimation(data.game.special_status, animationText);
                    }
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
    console.log('Updating board display with state:', boardState);
    
    // Convert the board state to the format expected by the game
    multiplayerGame.gameBoard = convertPiecesToBoard(boardState);
    
    // Re-initialize the board display
    multiplayerGame.initializeBoard();
    
    // Fix styling after a short delay to ensure DOM is updated
    setTimeout(() => {
        fixPieceStyling();
    }, 100);
}

// Add this function to the global scope so it can be called from anywhere
window.fixPieceStyling = function() {
    console.log('Fixing piece styling...');
    
    // Get all pieces
    const pieces = document.querySelectorAll('.piece');
    console.log(`Found ${pieces.length} pieces to fix`);
    
    // Apply CSS directly to each piece
    pieces.forEach((piece) => {
        // Get piece text content to determine type and color
        const text = piece.textContent;
        const type = piece.dataset.type;
        const color = piece.dataset.color;
        const fullSymbol = piece.dataset.symbol || text;
        piece.dataset.symbol = fullSymbol;
        
        // Clear any existing color classes
        piece.classList.remove('white-piece', 'black-piece');
        
        // Apply the appropriate color class
        if (color === 'white') {
            piece.classList.add('white-piece');
        } else if (color === 'black') {
            piece.classList.add('black-piece');
        } else {
            // Determine color based on Unicode character if not set
            if ('♔♕♖♗♘♙'.includes(fullSymbol.charAt(0))) {
                piece.dataset.color = 'white';
                piece.classList.add('white-piece');
            } else if ('♚♛♜♝♞♟'.includes(fullSymbol.charAt(0))) {
                piece.dataset.color = 'black';
                piece.classList.add('black-piece');
            }
        }
        
        // Handle archer pieces
        if (fullSymbol.includes('⇡')) {
            piece.dataset.type = 'archer';
            piece.dataset.color = 'white';
            piece.dataset.base = fullSymbol.charAt(0);
            piece.dataset.arrow = '↑';
            piece.classList.add('white-piece', 'archer-piece', 'archer-up');
        } else if (fullSymbol.includes('⇣')) {
            piece.dataset.type = 'archer';
            piece.dataset.color = 'black';
            piece.dataset.base = fullSymbol.charAt(0);
            piece.dataset.arrow = '↓';
            piece.classList.add('black-piece', 'archer-piece', 'archer-down');
        } else {
            piece.classList.remove('archer-piece', 'archer-up', 'archer-down');
            piece.removeAttribute('data-base');
            piece.removeAttribute('data-arrow');
        }
        piece.textContent = fullSymbol;
        
        // Handle dragon pieces
        if (type === 'dragon') {
            piece.classList.add('dragon-piece');
            
            // Ensure dragons in corners have the correct color
            const row = parseInt(piece.parentElement?.dataset?.row || '0');
            const col = parseInt(piece.parentElement?.dataset?.col || '0');
            
            if ((row === 0 && (col === 0 || col === 9)) || 
                (row === 1 && (col === 0 || col === 9))) {
                piece.dataset.color = 'black';
                piece.classList.remove('white-piece');
                piece.classList.add('black-piece');
            } else if ((row === 9 && (col === 0 || col === 9)) || 
                       (row === 8 && (col === 0 || col === 9))) {
                piece.dataset.color = 'white';
                piece.classList.remove('black-piece');
                piece.classList.add('white-piece');
            }
            
            // Clear text content for dragon pieces
            piece.textContent = '';
        }
        
        // Add text shadow for better visibility - apply to all pieces with text content
        if (piece.classList.contains('white-piece') || piece.dataset.color === 'white') {
            piece.style.color = 'white';
            piece.style.textShadow = '0 0 3px black, 0 0 3px black, 0 0 3px black';
        } else if (piece.classList.contains('black-piece') || piece.dataset.color === 'black') {
            piece.style.color = 'black';
            piece.style.textShadow = '0 0 3px white, 0 0 3px white, 0 0 3px white';
        }
        
        // Always set font weight
        piece.style.fontWeight = 'bold';
    });
};

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
    console.log('Updating game state:', { boardState, nextTurn, specialStatus: currentSpecialStatus });

    // Get the authentication token from localStorage with correct key
    const token = localStorage.getItem('chessAuthToken');
    if (!token) {
        console.error('No authentication token found');
        return;
    }
    console.log('currentSpecialStatus', currentSpecialStatus);
    
    // Create form data for the request
    const formData = new FormData();
    formData.append('token', token);
    formData.append('game_id', currentGameId);
    formData.append('board_state', JSON.stringify(boardState));
    formData.append('next_turn', nextTurn);
    formData.append('special_status', currentSpecialStatus || ''); // Include the special status

    // Send the update to the server
    fetch('api/update_game.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Game state updated successfully');
            
            // NOW we can reset the special status
            currentSpecialStatus = null;
            
            // --- FIX: Update local current player state immediately ---
            multiplayerGame.currentPlayer = nextTurn;
            console.log(`Local currentPlayer updated to: ${multiplayerGame.currentPlayer}`);
            // --- END FIX ---
            
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
        // Don't reset on error, so we can retry with the same status
    });
}

// Add this function to handle game finalization
function finalizeGame(result) {
    console.log(`Finalizing game with result: ${result}`);
    
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
    formData.append('result', result);
    
    // Send the finalization request to the server
    fetch('api/finalize_game.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Game finalized successfully:', data);
            
            // Show ELO changes if available
            if (data.elo_changes) {
                const winner = data.elo_changes.winner;
                const loser = data.elo_changes.loser;
                
                let message = `Game over! ${result.charAt(0).toUpperCase() + result.slice(1)}!\n\n`;
                message += `${winner.username}: ${winner.old_elo} → ${winner.new_elo} (${winner.change >= 0 ? '+' : ''}${winner.change})\n`;
                message += `${loser.username}: ${loser.old_elo} → ${loser.new_elo} (${loser.change >= 0 ? '+' : ''}${loser.change})`;
                
                setTimeout(() => {
                    alert(message);
                    window.location.href = 'index.html'; // Redirect to home page
                }, 1000);
            } else {
                // For draws or other results without ELO changes
                setTimeout(() => {
                    alert(`Game over! ${result.charAt(0).toUpperCase() + result.slice(1)}!`);
                    window.location.href = 'index.html'; // Redirect to home page
                }, 1000);
            }
        } else {
            console.error('Failed to finalize game:', data.message);
            alert('Failed to finalize game: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error finalizing game:', error);
        alert('Error finalizing game. Please try again.');
    });
}
