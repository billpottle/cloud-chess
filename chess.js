const cloudChessRawLog = console.log.bind(console);
const cloudChessDebugEnabled = (() => {
    try {
        return new URLSearchParams(window.location.search).has('debug') ||
            window.localStorage?.getItem('cloudChessDebug') === '1';
    } catch (e) {
        return false;
    }
})();

function cloudChessLog(...args) {
    if (cloudChessDebugEnabled) {
        cloudChessRawLog(...args);
    }
}

window.cloudChessLog = window.cloudChessLog || cloudChessLog;

// Update the navigation links based on game state
function updateNavigation(inGame) {
    const homeLink = document.querySelector('.navbar a:first-child');

    if (inGame) {
        // In game mode, show "New Game" instead of "Home"
        homeLink.textContent = 'New Game';
        homeLink.href = '#';
        homeLink.style.display = 'inline-block'; // Ensure it's visible

        // Remove any existing event listeners by cloning and replacing the element
        const newHomeLink = homeLink.cloneNode(true);
        homeLink.parentNode.replaceChild(newHomeLink, homeLink);

        // Add the event listener to the new element
        newHomeLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to start a new game?')) {
                window.location.reload();
            }
        });

        cloudChessLog('Navigation updated for game mode - New Game button should be visible');
    } else {
        // In home mode, hide the "Home" link since we're already home
        homeLink.style.display = 'none';
        cloudChessLog('Navigation updated for home mode - Home button hidden');
    }
}

// Initialize the game when the DOM is loaded
let gameInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // Ensure we only create one game instance
    if (!window.gameInstance) {
        window.gameInstance = new ChessGame();
    }

    // Set up event listeners for game mode buttons
    const vsPlayerBtn = document.getElementById('vs-player');
    if (vsPlayerBtn) {
        vsPlayerBtn.addEventListener('click', () => {
            window.gameInstance.startGame('pvp');
        });
    }

    const computerDifficulty = document.getElementById('computer-difficulty');
    if (computerDifficulty) {
        computerDifficulty.addEventListener('change', () => {
            const difficulty = parseInt(computerDifficulty.value);
            const battleToggle = document.getElementById('battle-mode-toggle');
            if (difficulty > 0) {
                window.gameInstance.startGame('pvc', difficulty, {
                    battleMode: Boolean(battleToggle?.checked)
                });
            }
        });
    }

    // Initialize navigation for home screen
    updateNavigation(false);

    // Rules modal functionality
    const rulesModal = document.getElementById('rules-modal');
    const rulesLink = document.getElementById('rules-link');
    const closeModal = document.querySelector('.close-modal');

    if (rulesLink && rulesModal && closeModal) {
        rulesLink.addEventListener('click', () => {
            rulesModal.style.display = 'block';
        });

        closeModal.addEventListener('click', () => {
            rulesModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === rulesModal) {
                rulesModal.style.display = 'none';
            }
        });
    }


    // Check if the board exists
    const board = document.getElementById('board');
    if (!board) {
        console.error('Chess board element not found!');
        return;
    }


    // Check squares
    const squares = document.querySelectorAll('.square');
    cloudChessLog(`Found ${squares.length} squares`);
    if (squares.length > 0) {
        const squareStyle = window.getComputedStyle(squares[0]);

    }
});

class ChessGame {
    constructor(boardState = null) {
        // Initialize the board
        this.board = [];

        if (boardState) {
            // Use the provided board state
            this.board = boardState;
        } else {
            // Create a new board with default positions
            this.createInitialBoard();
        }

        this.currentPlayer = 'white';
        this.selectedPiece = null;
        this.gameBoard = null;
        this.aiLevel = 0;
        this.gameMode = null;
        this.isAiThinking = false;
        this.isArcherCapture = false;
        this.battleMode = false;
        this.activeBattle = null;
        this.battleKeyDownHandler = null;
        this.battleKeyUpHandler = null;
        this.battleFrameRequest = null;
        this.capturedPieces = { white: [], black: [] };
        this.scores = { white: 0, black: 0 };
        this.pieceScoreValues = {
            pawn: 1,
            archer: 3,
            knight: 3,
            bishop: 3,
            rook: 5,
            queen: 9,
            dragon: 7,
            king: 0
        };
        this.pieceBattleStats = {
            pawn: { hp: 5, attack: 2 },
            archer: { hp: 6, attack: 2 },
            knight: { hp: 9, attack: 4 },
            bishop: { hp: 8, attack: 4 },
            rook: { hp: 12, attack: 5 },
            queen: { hp: 14, attack: 6 },
            king: { hp: 16, attack: 5 },
            dragon: { hp: 22, attack: 8 }
        };

        // Game end flags
        this.gameOver = false;
        this.kingCaptured = null; // 'white' or 'black' when a king is removed
        this.lastMoves = { white: null, black: null }; // per-color last move
        this.moveHistory = [];

        // Bind the handleSquareClick method
        this.handleSquareClick = this.handleSquareClick.bind(this);

        this.resetGraveyards();
    }


    createInitialBoard() {
        // Create a 10x10 board with empty spaces
        const board = Array(10).fill().map(() => Array(10).fill(''));

        // Black pieces (top row)
        board[0][0] = 'dragon-black'; // Black Wrath (black dragon)
        board[0][1] = '♜'; board[0][2] = '♞'; board[0][3] = '♝';
        board[0][4] = '♛'; board[0][5] = '♚';
        board[0][6] = '♝'; board[0][7] = '♞'; board[0][8] = '♜';
        board[0][9] = 'dragon-black'; // Black Wrath

        // Black pawns and archers (second row)
        board[1][0] = '♟'; board[1][1] = '♟'; board[1][2] = '♟'; board[1][3] = '♟';
        board[1][4] = '♟⇣'; // Black archer (pawn with arrow)
        board[1][5] = '♟⇣'; // Black archer
        board[1][6] = '♟'; board[1][7] = '♟'; board[1][8] = '♟'; board[1][9] = '♟'

        // White pawns and archers (ninth row)
        board[8][0] = '♙'; board[8][1] = '♙'; board[8][2] = '♙'; board[8][3] = '♙';
        board[8][4] = '♙⇡'; // White archer (pawn with arrow)
        board[8][5] = '♙⇡'; // White archer
        board[8][6] = '♙'; board[8][7] = '♙'; board[8][8] = '♙'; board[8][9] = '♙';

        // White pieces (bottom row)
        board[9][0] = 'dragon-white'; // White Wrath (white dragon)
        board[9][1] = '♖'; board[9][2] = '♘'; board[9][3] = '♗';
        board[9][4] = '♕'; board[9][5] = '♔';
        board[9][6] = '♗'; board[9][7] = '♘'; board[9][8] = '♖';
        board[9][9] = 'dragon-white'; // White Wrath

        return board;
    }

    initializeBoard() {
        // Clear the board container
        if (this.board) {
            this.board.innerHTML = '';
        } else {
            this.board = document.getElementById('board');
        }

        if (!this.board) {
            console.error('Board container not found');
            return;
        }

        // Ensure the board has the correct CSS grid properties
        this.board.style.display = 'grid';
        this.board.style.gridTemplateColumns = 'repeat(10, 1fr)';
        this.board.style.gridTemplateRows = 'repeat(10, 1fr)';
        this.board.style.maxWidth = '600px';
        this.board.style.width = '100%';
        this.board.style.boxSizing = 'border-box';
        this.board.style.border = '2px solid #333';

        // Remove any lingering last-move overlays
        const oldArrow = document.getElementById('last-move-arrow');
        if (oldArrow && oldArrow.parentNode) oldArrow.parentNode.removeChild(oldArrow);

        // Create the squares and place the pieces
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.classList.add((row + col) % 2 === 0 ? 'white' : 'black');
                square.dataset.row = row;
                square.dataset.col = col;

                square.style.width = '100%';
                square.style.height = '100%';

                // Place the piece if there is one
                const pieceSymbol = this.gameBoard[row][col];
                if (pieceSymbol) {
                    const piece = document.createElement('div');
                    piece.className = 'piece';

                    // Handle dragon pieces
                    if (pieceSymbol === 'dragon-white' || pieceSymbol === 'dragon-black') {
                        const color = pieceSymbol === 'dragon-white' ? 'white' : 'black';
                        piece.classList.add('dragon-piece', color + '-piece');
                        piece.dataset.type = 'dragon';
                        piece.dataset.color = color;
                    } else {
                        // Regular pieces
                        piece.textContent = pieceSymbol;
                        piece.dataset.symbol = pieceSymbol;

                        // Set piece color based on Unicode character
                        if ('♔♕♖♗♘♙'.includes(pieceSymbol.charAt(0))) {
                            piece.dataset.color = 'white';
                            piece.classList.add('white-piece');
                        } else if ('♚♛♜♝♞♟'.includes(pieceSymbol.charAt(0))) {
                            piece.dataset.color = 'black';
                            piece.classList.add('black-piece');
                        }

                        // Set piece type
                        if ('♔♚'.includes(pieceSymbol)) piece.dataset.type = 'king';
                        else if ('♕♛'.includes(pieceSymbol)) piece.dataset.type = 'queen';
                        else if ('♖♜'.includes(pieceSymbol)) piece.dataset.type = 'rook';
                        else if ('♗♝'.includes(pieceSymbol)) piece.dataset.type = 'bishop';
                        else if ('♘♞'.includes(pieceSymbol)) piece.dataset.type = 'knight';
                        else if ('♙♟'.includes(pieceSymbol) && !pieceSymbol.includes('⇡') && !pieceSymbol.includes('⇣')) {
                            piece.dataset.type = 'pawn';
                        } else if (pieceSymbol.includes('⇡')) {
                            piece.dataset.type = 'archer';
                            piece.dataset.color = 'white';
                            piece.dataset.base = pieceSymbol.charAt(0);
                            piece.dataset.arrow = '↑';
                            piece.classList.add('white-piece', 'archer-piece', 'archer-up');
                        } else if (pieceSymbol.includes('⇣')) {
                            piece.dataset.type = 'archer';
                            piece.dataset.color = 'black';
                            piece.dataset.base = pieceSymbol.charAt(0);
                            piece.dataset.arrow = '↓';
                            piece.classList.add('black-piece', 'archer-piece', 'archer-down');
                        }
                    }

                    square.appendChild(piece);
                }

                this.board.appendChild(square);
            }
        }

        // Add event listeners for piece selection
        this.board.addEventListener('click', this.handleSquareClick);

        // Apply styling to all pieces
        if (window.fixPieceStyling) {
            setTimeout(() => {
                window.fixPieceStyling();
            }, 100);
        }
        this.updateLastMoveUI();
    }

    handleSquareClick(event) {
        if (this.gameOver) return; // do nothing if game finished
        if (this.activeBattle) {
            this.setStatusMessage('Finish the battle before moving another piece.', 'thinking');
            return;
        }
        if (this.isAiThinking) {
            this.setStatusMessage('The computer is thinking...', 'thinking');
            return;
        }
        cloudChessLog("--- ChessGame.handleSquareClick ---"); // Base log

        // Make sure we're targeting the square, not the piece
        let square = event.target;
        if (!square.classList.contains('square')) {
            // If we clicked on something inside a square (like a piece),
            // find the parent square
            square = square.closest('.square');
            if (!square) {
                cloudChessLog('No square found for click - returning');
                return;
            }
        }

        // Get row and col from the square data attributes
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        cloudChessLog(`Clicked square: row=${row}, col=${col}`);

        // Continue with your existing logic...
        const piece = square.querySelector('.piece');
        cloudChessLog("Piece found:", piece ? piece.textContent : 'None');
        cloudChessLog("Current player:", this.currentPlayer);
        cloudChessLog("Is piece selected?", !!this.selectedPiece, this.selectedPiece ? `(Row: ${this.selectedPiece.dataset.row}, Col: ${this.selectedPiece.dataset.col})` : '');


        if (this.selectedPiece) {
            // If a piece is already selected, try to move it
            cloudChessLog("Attempting to call tryMove...");
            this.tryMove(row, col);
        } else if (piece) {
            const owned = this.isPieceOwnedByCurrentPlayer(piece);
            cloudChessLog(`Is piece owned by current player (${this.currentPlayer})?`, owned);
            if (owned) {
                // If no piece is selected and we clicked on our own piece, select it
                cloudChessLog("Attempting to call selectPiece...");
                this.selectPiece(square);
            } else {
                 cloudChessLog("Clicked on opponent's piece, doing nothing.");
            }
        } else {
             cloudChessLog("Clicked on empty square with no piece selected, doing nothing.");
        }
        cloudChessLog("--- End ChessGame.handleSquareClick ---");
    }

    clearHighlights() {
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'valid-move');
        });
    }

    isValidMove(toRow, toCol) {
        const fromRow = parseInt(this.selectedPiece.dataset.row);
        const fromCol = parseInt(this.selectedPiece.dataset.col);
        const piece = this.selectedPiece.querySelector('.piece');
        const pieceType = piece.textContent;


        // Basic validation: can't capture your own pieces
        const targetSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        const targetPiece = targetSquare.querySelector('.piece');
        if (targetPiece && targetPiece.dataset.color === piece.dataset.color) {
            return false;
        }

        // Check if this is a dragon piece
        // Check if this is a dragon piece
        if (piece.dataset.type === 'dragon') {

            // Dragon movement logic
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);

            // Check if move is 1 or 2 squares in any direction (including diagonal)
            if ((rowDiff <= 2 && colDiff <= 2) && !(rowDiff === 0 && colDiff === 0)) {
                // For 2-square moves, check if it's a straight line
                if (rowDiff === 2 || colDiff === 2) {
                    // Must be a straight line (horizontal, vertical, or diagonal)
                    if (!(rowDiff === 0 || colDiff === 0 || rowDiff === colDiff)) {
                        return false;
                    }

                    // Calculate the middle square
                    const midRow = (fromRow + toRow) / 2;
                    const midCol = (fromCol + toCol) / 2;
                    const midSquare = document.querySelector(`[data-row="${midRow}"][data-col="${midCol}"]`);
                    const midPiece = midSquare?.querySelector('.piece');

                    // Calculate the destination square
                    const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
                    const toPiece = toSquare?.querySelector('.piece');

                    // Condition: If the middle square has an opponent and the destination is empty, movement is **not** allowed
                    if (midPiece && midPiece.dataset.color !== piece.dataset.color && !toPiece) {
                        return false;
                    }

                    // Condition: If the middle square has an opponent and the destination also has an opponent, movement is **allowed**
                    // Condition: If the middle square has the same team, movement is **not allowed**
                    if (midPiece && midPiece.dataset.color === piece.dataset.color) {
                        return false;
                    }
                }

                return true;
            }
            return false;
        }
        // Queen movement (♛ or ♕)
        else if (pieceType === '♛' || pieceType === '♕') {
            //  cloudChessLog(`Checking queen move from ${fromRow},${fromCol} to ${toRow},${toCol}`);
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);

            // Queen can move any number of squares horizontally, vertically, or diagonally
            if (!(rowDiff === 0 || colDiff === 0 || rowDiff === colDiff)) {
                //        cloudChessLog('Invalid queen move - not horizontal, vertical, or diagonal');
                return false;
            }

            // Check for pieces in the path
            const rowStep = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
            const colStep = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);

            let currentRow = fromRow + rowStep;
            let currentCol = fromCol + colStep;

            while (currentRow !== toRow || currentCol !== toCol) {
                const pathSquare = document.querySelector(`[data-row="${currentRow}"][data-col="${currentCol}"]`);
                if (pathSquare.querySelector('.piece')) {
                    //       cloudChessLog(`Path blocked at ${currentRow},${currentCol}`);
                    return false; // Path is blocked
                }
                currentRow += rowStep;
                currentCol += colStep;
            }

            cloudChessLog('Valid queen move');
            return true;
        }
        // Rook movement (♜ or ♖)
        else if (pieceType === '♜' || pieceType === '♖') {
            // cloudChessLog(`Checking rook move from ${fromRow},${fromCol} to ${toRow},${toCol}`);
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);

            // Rook can only move horizontally or vertically
            if (!(rowDiff === 0 || colDiff === 0) || (rowDiff === 0 && colDiff === 0)) {
                //        cloudChessLog('Invalid rook move - not horizontal or vertical');
                return false;
            }

            // Check for pieces in the path
            const rowStep = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
            const colStep = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);

            let currentRow = fromRow + rowStep;
            let currentCol = fromCol + colStep;

            while (currentRow !== toRow || currentCol !== toCol) {
                const pathSquare = document.querySelector(`[data-row="${currentRow}"][data-col="${currentCol}"]`);
                if (pathSquare.querySelector('.piece')) {
                    cloudChessLog(`Path blocked at ${currentRow},${currentCol}`);
                    return false; // Path is blocked
                }
                currentRow += rowStep;
                currentCol += colStep;
            }

            cloudChessLog('Valid rook move');
            return true;
        }
        // Bishop movement (♝ or ♗)
        else if (pieceType === '♝' || pieceType === '♗') {
            //  cloudChessLog(`Checking bishop move from ${fromRow},${fromCol} to ${toRow},${toCol}`);
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);

            // Bishop can only move diagonally
            if (rowDiff !== colDiff || rowDiff === 0) {
                //    cloudChessLog('Invalid bishop move - not diagonal');
                return false;
            }

            // Check for pieces in the path
            const rowStep = toRow > fromRow ? 1 : -1;
            const colStep = toCol > fromCol ? 1 : -1;

            let currentRow = fromRow + rowStep;
            let currentCol = fromCol + colStep;

            while (currentRow !== toRow && currentCol !== toCol) {
                const pathSquare = document.querySelector(`[data-row="${currentRow}"][data-col="${currentCol}"]`);
                if (pathSquare.querySelector('.piece')) {
                    //       cloudChessLog(`Path blocked at ${currentRow},${currentCol}`);
                    return false; // Path is blocked
                }
                currentRow += rowStep;
                currentCol += colStep;
            }

            cloudChessLog('Valid bishop move');
            return true;
        }
        // Knight movement (♞ or ♘)
        else if (pieceType === '♞' || pieceType === '♘') {
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);

            // Knight moves in an L-shape: 2 squares in one direction and 1 square perpendicular
            return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
        }
        // King movement (♚ or ♔)
        else if (pieceType === '♚' || pieceType === '♔') {
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);

            // King can move 1 square in any direction
            return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
        }
        // Pawn movement (♟ or ♙)
        else if (pieceType === '♟' || pieceType === '♙') {
            const direction = piece.dataset.color === 'white' ? -1 : 1;
            const startRow = piece.dataset.color === 'white' ? 8 : 1;
            const rowDiff = toRow - fromRow;
            const colDiff = Math.abs(toCol - fromCol);

            // Regular pawn move (forward 1 square)
            if (colDiff === 0 && rowDiff === direction && !targetPiece) {
                return true;
            }

            // Initial pawn move (forward 2 squares)
            if (colDiff === 0 && rowDiff === 2 * direction && fromRow === startRow && !targetPiece) {
                // Check if the path is clear
                const midRow = fromRow + direction;
                const midSquare = document.querySelector(`[data-row="${midRow}"][data-col="${fromCol}"]`);
                return !midSquare.querySelector('.piece');
            }

            // Pawn capture (diagonal 1 square)
            if (colDiff === 1 && rowDiff === direction && targetPiece) {
                return true;
            }

            return false;
        }
        // Archer movement (♟⇣ or ♙⇡)
        else if (pieceType === '♟⇣' || pieceType === '♙⇡') {
            const direction = piece.dataset.color === 'white' ? -1 : 1;
            const startRow = piece.dataset.color === 'white' ? 8 : 1;
            const rowDiff = toRow - fromRow;
            const colDiff = Math.abs(toCol - fromCol);

            // Archer special: capture without moving
            // Can capture diagonally forward OR straight forward by one square
            if (targetPiece && (
                (colDiff === 1 && rowDiff === direction) ||
                (colDiff === 0 && rowDiff === direction)
            )) {
                this.isArcherCapture = true;
                return true;
            }

            // Move like a pawn (only when not capturing)
            if (!targetPiece) {
                // One step forward
                if (colDiff === 0 && rowDiff === direction) {
                    this.isArcherCapture = false;
                    return true;
                }

                // Two steps from start if path clear
                if (colDiff === 0 && rowDiff === 2 * direction && fromRow === startRow) {
                    const midRow = fromRow + direction;
                    const midSquare = document.querySelector(`[data-row="${midRow}"][data-col="${fromCol}"]`);
                    this.isArcherCapture = false;
                    return !midSquare.querySelector('.piece');
                }
            }

            // No other movements allowed (e.g., moving diagonally to capture like a pawn or sideways move)
            return false;
        }

        return false;
    }

    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = fromRow === toRow ? 0 : (toRow - fromRow) / Math.abs(toRow - fromRow);
        const colStep = fromCol === toCol ? 0 : (toCol - fromCol) / Math.abs(toCol - fromCol);

        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;

        while (currentRow !== toRow || currentCol !== toCol) {
            const square = document.querySelector(`[data-row="${currentRow}"][data-col="${currentCol}"]`);
            if (square.querySelector('.piece')) {
                return false;
            }
            currentRow += rowStep;
            currentCol += colStep;
        }
        return true;
    }

    showValidMoves() {
        if (!this.selectedPiece) {
            return;
        }

        this.clearValidMoves();

        const fromRow = parseInt(this.selectedPiece.dataset.row, 10);
        const fromCol = parseInt(this.selectedPiece.dataset.col, 10);
        const originalArcherCapture = this.isArcherCapture;

        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 10; j++) {
                if (i === fromRow && j === fromCol) {
                    continue;
                }

                const square = document.querySelector(`[data-row="${i}"][data-col="${j}"]`);
                if (!square) {
                    continue;
                }

                const moveIsValid = this.isValidMove(i, j);
                const isArcherCaptureMove = this.isArcherCapture;

                if (moveIsValid) {
                    const leavesInCheck = this.wouldMoveLeaveKingInCheck(fromRow, fromCol, i, j, isArcherCaptureMove);
                    if (leavesInCheck) {
                        square.classList.add('illegal-move');
                    } else {
                        square.classList.add('valid-move');
                    }
                }

                this.isArcherCapture = false;
            }
        }

        this.isArcherCapture = originalArcherCapture;
    }

    movePiece(toRow, toCol) {

        const fromSquare = this.selectedPiece;
        cloudChessLog({ fromSquare, toRow, toCol })
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        const piece = fromSquare.querySelector('.piece');
        cloudChessLog({ piece })

        // Check if this is an archer capture without moving
        const isArcher = piece.textContent === '♟⇣' || piece.textContent === '♙⇡';
        const isPawn = piece.textContent === '♟' || piece.textContent === '♙';
        const isArcherCapture = isArcher && this.isArcherCapture;
        const movingColor = piece.dataset.color;
        const targetPiece = toSquare.querySelector('.piece');

        let midCaptureOccurred = false;
        const fromRowInt = parseInt(fromSquare.dataset.row);
        const fromColInt = parseInt(fromSquare.dataset.col);

        if (isArcherCapture) {
            // For archer capture without moving, just remove the target piece
            cloudChessLog("Archer capturing without moving");
            if (targetPiece && targetPiece.dataset.color !== movingColor) {
                if (targetPiece.dataset.type === 'king') {
                    this.kingCaptured = targetPiece.dataset.color;
                }
                this.recordCapture(movingColor, targetPiece);
            }
            toSquare.innerHTML = '';
            this.recordLastMove({
                color: movingColor,
                type: piece.dataset.type || this.inferPieceType(piece.textContent, piece.dataset.type),
                fromRow: fromRowInt,
                fromCol: fromColInt,
                toRow: toRow,
                toCol: toCol,
                archerShot: true
            });
        } else {
            // Handle wrath ability (capturing through a piece)
            const rowDiff = Math.abs(fromSquare.dataset.row - toRow);
            const colDiff = Math.abs(fromSquare.dataset.col - toCol);

            if (targetPiece && targetPiece.dataset.color !== movingColor) {
                if (targetPiece.dataset.type === 'king') {
                    this.kingCaptured = targetPiece.dataset.color;
                }
                this.recordCapture(movingColor, targetPiece);
            }

            if (piece.dataset.type === 'dragon' && (rowDiff === 2 || colDiff === 2)) {
                // Must be a straight-line move (horizontal, vertical, or diagonal)
                if (rowDiff === 0 || colDiff === 0 || rowDiff === colDiff) {
                    // Calculate the middle square
                    const midRow = (parseInt(fromSquare.dataset.row) + toRow) / 2;
                    const midCol = (parseInt(fromSquare.dataset.col) + toCol) / 2;
                    const midSquare = document.querySelector(`[data-row="${midRow}"][data-col="${midCol}"]`);

                    if (midSquare) {
                        const midPiece = midSquare.querySelector('.piece');

                        // If the middle square has an opponent, remove it and score the capture
                        if (midPiece && midPiece.dataset.color !== piece.dataset.color) {
                            cloudChessLog("Wrath activated: Capturing middle piece");
                            if (midPiece.dataset.type === 'king') {
                                this.kingCaptured = midPiece.dataset.color;
                            }
                            this.recordCapture(movingColor, midPiece);
                            midSquare.innerHTML = ''; // Remove the captured piece
                            midCaptureOccurred = true;
                        }
                    }
                }
            }


            // Move the piece to the new square
            const pieceClone = piece.cloneNode(true);
            toSquare.innerHTML = '';
            toSquare.appendChild(pieceClone);
            fromSquare.innerHTML = '';
            this.recordLastMove({
                color: movingColor,
                type: piece.dataset.type || this.inferPieceType(piece.textContent, piece.dataset.type),
                fromRow: fromRowInt,
                fromCol: fromColInt,
                toRow: toRow,
                toCol: toCol,
                archerShot: false
            });

            // Check for pawn/archer promotion
            if ((isPawn || isArcher) &&
                ((piece.dataset.color === 'white' && toRow === 0) ||
                    (piece.dataset.color === 'black' && toRow === 9))) {
                // Promote to queen
                const promotedPiece = toSquare.querySelector('.piece');
                promotedPiece.textContent = piece.dataset.color === 'white' ? '♕' : '♛';
                promotedPiece.classList.remove('archer-piece', 'archer-up', 'archer-down');
                promotedPiece.removeAttribute('data-type');
                promotedPiece.removeAttribute('data-base');
                promotedPiece.removeAttribute('data-arrow');
                promotedPiece.dataset.symbol = promotedPiece.textContent;
                promotedPiece.dataset.type = 'queen';

                // Show promotion animation
                this.showGameStatusAnimation('promotion', 'PROMOTION!');
            }
        }

        // If king was captured, mark game over and finish locally (single-player).
        if (this.kingCaptured) {
            this.gameOver = true;
            const defeated = this.kingCaptured;
            const winner = defeated === 'white' ? 'black' : 'white';
            this.showGameStatusAnimation('checkmate', 'CHECKMATE!');
            try {
                setTimeout(() => { alert(`${winner.charAt(0).toUpperCase() + winner.slice(1)} wins by king capture!`); }, 1200);
            } catch (e) {}
        }

        // Notify hooks/listeners about the completed move (before turn switches)
        if (typeof this.onAfterMove === 'function') {
            const didCapture = !!targetPiece || midCaptureOccurred;
            try {
                this.onAfterMove({ fromRow: fromRowInt, fromCol: fromColInt, toRow, toCol, didCapture });
            } catch (e) {
                console.error('onAfterMove hook error:', e);
            }
        }

        // Update last-move display
        this.updateLastMoveUI();

        this.isArcherCapture = false;
    }

    squareName(row, col) {
        const files = 'ABCDEFGHIJ';
        const file = files[col] || '?';
        const rank = 10 - row;
        return `${file}${rank}`;
    }

    updateLastMoveUI() {
        const elWhite = document.getElementById('last-move-inline-white');
        const elBlack = document.getElementById('last-move-inline-black');
        const legacy = document.getElementById('last-move-bar');

        const render = (el, move) => {
            if (!el) return;
            if (!move) {
                el.textContent = '—';
                this.attachLastMoveHover(el, null);
                return;
            }
            const text = move.summary || this.formatMoveSummary(move);
            el.textContent = text || '—';
            this.attachLastMoveHover(el, move);
        };

        render(elWhite, this.lastMoves.white);
        render(elBlack, this.lastMoves.black);
        // legacy fallback shows the most recent move if present
        if (legacy) {
            const last = this.lastMoves.white && this.lastMoves.black
                ? (this.lastMoves.white.time && this.lastMoves.black.time
                    ? (this.lastMoves.white.time > this.lastMoves.black.time ? this.lastMoves.white : this.lastMoves.black)
                    : this.lastMoves.white || this.lastMoves.black)
                : (this.lastMoves.white || this.lastMoves.black);
            render(legacy, last);
        }
    }

    recordLastMove(move) {
        const timed = {
            ...move,
            time: Date.now(),
            halfMove: this.moveHistory.length + 1
        };
        timed.moveNumber = Math.ceil(timed.halfMove / 2);
        timed.summary = move.summary || this.formatMoveSummary(timed);
        if (timed.color === 'white') this.lastMoves.white = timed; else this.lastMoves.black = timed;
        this.moveHistory.push(timed);
        this.updateMoveHistoryUI();
    }

    resetMoveHistory() {
        this.moveHistory = [];
        this.updateMoveHistoryUI();
    }

    updateMoveHistoryUI() {
        const list = document.getElementById('move-history-list');
        if (!list) {
            return;
        }

        list.innerHTML = '';

        if (!this.moveHistory.length) {
            const empty = document.createElement('li');
            empty.className = 'move-history-empty';
            empty.textContent = 'Moves will appear here.';
            list.appendChild(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        this.moveHistory.slice(-18).forEach(move => {
            const item = document.createElement('li');
            item.className = `move-history-item ${move.color}-move`;
            const prefix = move.color === 'white' ? `${move.moveNumber}.` : `${move.moveNumber}...`;

            const number = document.createElement('span');
            number.className = 'move-history-number';
            number.textContent = prefix;

            const text = document.createElement('span');
            text.className = 'move-history-text';
            text.textContent = move.summary || this.formatMoveSummary(move);

            item.appendChild(number);
            item.appendChild(text);
            item.addEventListener('mouseenter', () => this.showLastMoveOverlay(move));
            item.addEventListener('mouseleave', () => this.hideLastMoveOverlay());
            fragment.appendChild(item);
        });

        list.appendChild(fragment);
        list.scrollTop = list.scrollHeight;
    }

    formatMoveSummary(move) {
        if (!move) return '';
        const typeMap = {
            king: 'King',
            queen: 'Queen',
            rook: 'Rook',
            bishop: 'Bishop',
            knight: 'Knight',
            pawn: 'Pawn',
            archer: 'Archer',
            dragon: 'Dragon'
        };
        const typeName = typeMap[move.type] || (move.type ? move.type.charAt(0).toUpperCase() + move.type.slice(1) : 'Piece');
        const from = this.squareName(move.fromRow, move.fromCol);
        const to = this.squareName(move.toRow, move.toCol);
        if (move.archerShot) {
            return `${typeName} shot ${from} → ${to}`;
        }
        return `${typeName} ${from} → ${to}`;
    }

    attachLastMoveHover(el, move) {
        const parent = el.parentNode;
        if (!parent) return;
        const clone = el.cloneNode(true);
        parent.replaceChild(clone, el);
        if (!move) return;
        const show = () => this.showLastMoveOverlay(move);
        const hide = () => this.hideLastMoveOverlay();
        clone.addEventListener('mouseenter', show);
        clone.addEventListener('mouseleave', hide);
    }

    showLastMoveOverlay(move) {
        const board = document.getElementById('board');
        if (!board) return;
        const fromSq = document.querySelector(`[data-row="${move.fromRow}"][data-col="${move.fromCol}"]`);
        const toSq = document.querySelector(`[data-row="${move.toRow}"][data-col="${move.toCol}"]`);
        if (fromSq) fromSq.classList.add('last-move-origin');
        if (toSq) toSq.classList.add('last-move-dest');

        const prev = document.getElementById('last-move-arrow');
        if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('id', 'last-move-arrow');
        svg.classList.add('last-move-arrow-overlay');
        svg.setAttribute('width', board.clientWidth);
        svg.setAttribute('height', board.clientHeight);
        svg.setAttribute('viewBox', `0 0 ${board.clientWidth} ${board.clientHeight}`);
        svg.style.position = 'absolute';
        svg.style.left = '0';
        svg.style.top = '0';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '8');
        marker.setAttribute('markerHeight', '8');
        marker.setAttribute('refX', '0');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrowPath.setAttribute('d', 'M0,0 L0,6 L6,3 z');
        arrowPath.setAttribute('fill', '#3c82ff');
        marker.appendChild(arrowPath);
        defs.appendChild(marker);
        svg.appendChild(defs);

        if (fromSq && toSq) {
            const fromRect = fromSq.getBoundingClientRect();
            const toRect = toSq.getBoundingClientRect();
            const bRect = board.getBoundingClientRect();
            const x1 = fromRect.left - bRect.left + fromRect.width / 2;
            const y1 = fromRect.top - bRect.top + fromRect.height / 2;
            const x2 = toRect.left - bRect.left + toRect.width / 2;
            const y2 = toRect.top - bRect.top + toRect.height / 2;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', '#3c82ff');
            line.setAttribute('stroke-width', '4');
            line.setAttribute('marker-end', 'url(#arrowhead)');
            line.setAttribute('opacity', '0.9');
            svg.appendChild(line);
        }
        board.appendChild(svg);
    }

    hideLastMoveOverlay() {
        document.querySelectorAll('.last-move-origin').forEach(el => el.classList.remove('last-move-origin'));
        document.querySelectorAll('.last-move-dest').forEach(el => el.classList.remove('last-move-dest'));
        const prev = document.getElementById('last-move-arrow');
        if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    }

    getOpponentColor(color) {
        return color === 'white' ? 'black' : 'white';
    }

    getPieceDisplayName(pieceEl) {
        if (!pieceEl) return 'Piece';
        const type = pieceEl.dataset.type || this.inferPieceType(pieceEl.dataset.symbol || pieceEl.textContent, pieceEl.dataset.type);
        const color = pieceEl.dataset.color || this.inferPieceColor(pieceEl.dataset.symbol || pieceEl.textContent, pieceEl.dataset.color);
        const labels = {
            pawn: 'Pawn',
            archer: 'Archer',
            knight: 'Knight',
            bishop: 'Bishop',
            rook: 'Rook',
            queen: 'Queen',
            king: 'King',
            dragon: 'Dragon'
        };
        const pieceName = labels[type] || 'Piece';
        return `${color ? color.charAt(0).toUpperCase() + color.slice(1) + ' ' : ''}${pieceName}`;
    }

    getBattleStatsForPiece(pieceEl) {
        const type = pieceEl?.dataset.type || this.inferPieceType(pieceEl?.dataset.symbol || pieceEl?.textContent || '', pieceEl?.dataset.type);
        const base = this.pieceBattleStats[type] || { hp: 8, attack: 3 };
        return { ...base, type };
    }

    getMoveCaptureInfo(fromRow, fromCol, toRow, toCol, isArcherCaptureMove = this.isArcherCapture) {
        const fromSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        const attacker = fromSquare?.querySelector('.piece');
        const defender = toSquare?.querySelector('.piece');
        if (!fromSquare || !toSquare || !attacker) {
            return null;
        }

        const targets = [];
        const attackerColor = attacker.dataset.color;
        if (defender && defender.dataset.color !== attackerColor) {
            targets.push({ square: toSquare, piece: defender, row: toRow, col: toCol });
        }

        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        if (!isArcherCaptureMove && attacker.dataset.type === 'dragon' && (rowDiff === 2 || colDiff === 2)) {
            if (rowDiff === 0 || colDiff === 0 || rowDiff === colDiff) {
                const midRow = (fromRow + toRow) / 2;
                const midCol = (fromCol + toCol) / 2;
                const midSquare = document.querySelector(`[data-row="${midRow}"][data-col="${midCol}"]`);
                const midPiece = midSquare?.querySelector('.piece');
                if (midPiece && midPiece.dataset.color !== attackerColor) {
                    targets.push({ square: midSquare, piece: midPiece, row: midRow, col: midCol });
                }
            }
        }

        if (targets.length === 0) {
            return null;
        }

        const primaryTarget = targets.reduce((best, target) => {
            const bestValue = this.pieceScoreValues[best.piece.dataset.type] ?? 0;
            const targetValue = this.pieceScoreValues[target.piece.dataset.type] ?? 0;
            return targetValue > bestValue ? target : best;
        }, targets[0]);

        return {
            fromRow,
            fromCol,
            toRow,
            toCol,
            archerShot: Boolean(isArcherCaptureMove),
            attackerSquare: fromSquare,
            attacker,
            defenderSquare: primaryTarget.square,
            defender: primaryTarget.piece,
            targets
        };
    }

    shouldBattleForCapture(captureInfo) {
        return Boolean(
            this.battleMode &&
            this.gameMode === 'pvc' &&
            this.aiLevel > 0 &&
            captureInfo &&
            captureInfo.attacker &&
            captureInfo.defender
        );
    }

    startBattleForMove(captureInfo) {
        const attackerStats = this.getBattleStatsForPiece(captureInfo.attacker);
        const defenderStats = this.getBattleStatsForPiece(captureInfo.defender);
        const humanSide = captureInfo.attacker.dataset.color === 'white' ? 'attacker' : 'defender';
        const aiSide = humanSide === 'attacker' ? 'defender' : 'attacker';
        this.activeBattle = {
            ...captureInfo,
            round: 0,
            attackerHp: attackerStats.hp,
            defenderHp: defenderStats.hp + 1,
            attackerMaxHp: attackerStats.hp,
            defenderMaxHp: defenderStats.hp + 1,
            attackerAttack: attackerStats.attack,
            defenderAttack: defenderStats.attack,
            attackerName: this.getPieceDisplayName(captureInfo.attacker),
            defenderName: this.getPieceDisplayName(captureInfo.defender),
            humanSide,
            aiSide,
            log: humanSide === 'attacker'
                ? `${this.getPieceDisplayName(captureInfo.attacker)} enters the arena. Press Space or Attack to start.`
                : `${this.getPieceDisplayName(captureInfo.defender)} is defending the square. Press Space or Attack to start.`
        };
        this.startBattleArcade();
        this.renderBattlePanel();
        this.setBoardDisabled(true);
        this.setStatusMessage(
            humanSide === 'attacker'
                ? 'Battle ready. Press Space or Attack to start the duel.'
                : 'Defensive battle ready. Press Space or Attack to start the duel.',
            'thinking'
        );
    }

    bindBattleActions(panel) {
        panel.querySelectorAll('.battle-action').forEach(button => {
            if (button.dataset.bound === 'true') return;
            button.dataset.bound = 'true';
            button.addEventListener('click', () => this.playBattleRound(button.dataset.action));
        });
    }

    renderBattlePanel() {
        const battle = this.activeBattle;
        const panel = document.getElementById('battle-panel');
        if (!panel || !battle) return;

        panel.hidden = false;
        panel.classList.add('is-arena-active');
        document.body.classList.add('battle-arena-open');
        this.bindBattleActions(panel);

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        const setHp = (id, hp, maxHp) => {
            const el = document.getElementById(id);
            if (!el) return;
            const percent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
            el.style.width = `${percent}%`;
            el.textContent = `${Math.max(0, hp)} / ${maxHp}`;
        };

        setText('battle-round', battle.arcade?.started ? (battle.round > 0 ? `Hit ${battle.round}` : 'Fight!') : 'Press Space');
        setText('battle-attacker-name', battle.attackerName);
        setText('battle-defender-name', battle.defenderName);
        setText('battle-attacker-stats', `HP ${battle.attackerMaxHp} / ATK ${battle.attackerAttack}`);
        setText('battle-defender-stats', `HP ${battle.defenderMaxHp} / ATK ${battle.defenderAttack}`);
        setText('battle-log', battle.log);
        setHp('battle-attacker-hp', battle.attackerHp, battle.attackerMaxHp);
        setHp('battle-defender-hp', battle.defenderHp, battle.defenderMaxHp);
    }

    getArcadeBattleProfile(pieceEl, side) {
        const stats = this.getBattleStatsForPiece(pieceEl);
        const type = stats.type || 'pawn';
        const rangedTypes = ['archer', 'bishop', 'queen', 'dragon'];
        const heavyTypes = ['rook', 'king', 'dragon'];
        const quickTypes = ['pawn', 'knight', 'archer'];
        const moveNames = {
            pawn: ['sword jab', 'shield rush'],
            archer: ['arrow shot', 'triple volley'],
            knight: ['lance slash', 'horse charge'],
            bishop: ['star bolt', 'diagonal beam'],
            rook: ['hammer swing', 'stone charge'],
            queen: ['royal bolt', 'crown storm'],
            king: ['scepter swing', 'royal guard'],
            dragon: ['fire breath', 'wing blast']
        };
        return {
            side,
            type,
            ranged: rangedTypes.includes(type),
            radius: type === 'dragon' ? 18 : heavyTypes.includes(type) ? 15 : 13,
            speed: quickTypes.includes(type) ? 158 : heavyTypes.includes(type) ? 122 : 138,
            damage: Math.max(2, stats.attack),
            cooldown: type === 'dragon' ? 0.55 : rangedTypes.includes(type) ? 0.42 : 0.34,
            specialCooldown: type === 'dragon' ? 1.15 : heavyTypes.includes(type) ? 0.95 : 0.8,
            projectileSpeed: type === 'dragon' ? 260 : type === 'archer' ? 330 : 285,
            slashRange: type === 'dragon' ? 54 : type === 'rook' ? 44 : 38,
            moveNames: moveNames[type] || ['strike', 'special'],
            color: side === 'attacker' ? '#f2d37a' : '#7fd4ff',
            accent: side === 'attacker' ? '#ff5a7a' : '#76f0b4'
        };
    }

    startBattleArcade() {
        const battle = this.activeBattle;
        const canvas = document.getElementById('battle-arena');
        if (!battle || !canvas || typeof canvas.getContext !== 'function') {
            return false;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return false;
        }

        this.stopBattleArcade();

        const width = canvas.width || 640;
        const height = canvas.height || 360;
        const attackerProfile = this.getArcadeBattleProfile(battle.attacker, 'attacker');
        const defenderProfile = this.getArcadeBattleProfile(battle.defender, 'defender');
        battle.arcade = {
            canvas,
            ctx,
            width,
            height,
            running: true,
            started: false,
            keys: new Set(),
            controls: new Set(),
            projectiles: [],
            slashes: [],
            effects: [],
            stars: Array.from({ length: 52 }, (_, index) => ({
                x: (index * 137) % width,
                y: (index * 71) % height,
                size: 1 + (index % 3) * 0.45
            })),
            players: {
                attacker: {
                    ...attackerProfile,
                    x: 88,
                    y: height / 2,
                    vx: 0,
                    vy: 0,
                    aimX: 1,
                    aimY: 0,
                    hp: battle.attackerHp,
                    maxHp: battle.attackerMaxHp,
                    cooldownLeft: 0,
                    specialCooldownLeft: 0,
                    invulnerable: 0
                },
                defender: {
                    ...defenderProfile,
                    x: width - 88,
                    y: height / 2,
                    vx: 0,
                    vy: 0,
                    aimX: -1,
                    aimY: 0,
                    hp: battle.defenderHp,
                    maxHp: battle.defenderMaxHp,
                    cooldownLeft: 0,
                    specialCooldownLeft: 0,
                    invulnerable: 0
                }
            },
            lastTime: performance.now()
        };

        this.bindBattleControls();
        this.renderBattleArcadeFrame();
        const tick = (time) => this.updateBattleArcade(time);
        this.battleFrameRequest = requestAnimationFrame(tick);
        return true;
    }

    stopBattleArcade() {
        if (this.battleFrameRequest) {
            cancelAnimationFrame(this.battleFrameRequest);
            this.battleFrameRequest = null;
        }
        if (this.battleKeyDownHandler) {
            window.removeEventListener('keydown', this.battleKeyDownHandler);
            this.battleKeyDownHandler = null;
        }
        if (this.battleKeyUpHandler) {
            window.removeEventListener('keyup', this.battleKeyUpHandler);
            this.battleKeyUpHandler = null;
        }
        if (this.activeBattle?.arcade) {
            this.activeBattle.arcade.running = false;
        }
        document.getElementById('battle-panel')?.classList.remove('is-arena-active');
        document.body.classList.remove('battle-arena-open');
        document.querySelectorAll('[data-battle-control].is-pressed').forEach(button => {
            button.classList.remove('is-pressed');
        });
    }

    bindBattleControls() {
        const battle = this.activeBattle;
        if (!battle?.arcade) return;

        const normalizeKey = (key) => ({
            ArrowUp: 'up',
            w: 'up',
            W: 'up',
            ArrowDown: 'down',
            s: 'down',
            S: 'down',
            ArrowLeft: 'left',
            a: 'left',
            A: 'left',
            ArrowRight: 'right',
            d: 'right',
            D: 'right',
            ' ': 'attack',
            Spacebar: 'attack',
            j: 'attack',
            J: 'attack',
            Shift: 'special',
            k: 'special',
            K: 'special'
        })[key];

        this.battleKeyDownHandler = (event) => {
            const control = normalizeKey(event.key);
            if (!control || !this.activeBattle?.arcade) return;
            if ((control === 'attack' || control === 'special') && !this.activeBattle.arcade.started) {
                this.startBattleDuel();
                event.preventDefault();
                return;
            }
            this.activeBattle.arcade.keys.add(control);
            if (control === 'attack' || control === 'special') {
                this.tryHumanBattleAttack(control === 'special');
            }
            event.preventDefault();
        };
        this.battleKeyUpHandler = (event) => {
            const control = normalizeKey(event.key);
            if (!control || !this.activeBattle?.arcade) return;
            this.activeBattle.arcade.keys.delete(control);
            event.preventDefault();
        };
        window.addEventListener('keydown', this.battleKeyDownHandler);
        window.addEventListener('keyup', this.battleKeyUpHandler);

        document.querySelectorAll('[data-battle-control]').forEach(button => {
            if (button.dataset.arcadeBound === 'true') return;
            button.dataset.arcadeBound = 'true';
            const control = button.dataset.battleControl;
            const press = (event) => {
                if (!this.activeBattle?.arcade) return;
                if ((control === 'attack' || control === 'special') && !this.activeBattle.arcade.started) {
                    this.startBattleDuel();
                    event.preventDefault();
                    return;
                }
                this.activeBattle.arcade.controls.add(control);
                button.classList.add('is-pressed');
                if (control === 'attack' || control === 'special') {
                    this.tryHumanBattleAttack(control === 'special');
                }
                event.preventDefault();
            };
            const release = (event) => {
                if (this.activeBattle?.arcade) {
                    this.activeBattle.arcade.controls.delete(control);
                }
                button.classList.remove('is-pressed');
                event.preventDefault();
            };
            button.addEventListener('pointerdown', press);
            button.addEventListener('pointerup', release);
            button.addEventListener('pointercancel', release);
            button.addEventListener('pointerleave', release);
        });
    }

    tryHumanBattleAttack(special = false) {
        const battle = this.activeBattle;
        const arcade = battle?.arcade;
        if (!battle || !arcade?.started) return;

        const player = arcade.players[battle.humanSide];
        if (special) {
            if (player.specialCooldownLeft <= 0) {
                this.performBattleAttack(battle.humanSide, true);
            }
        } else if (player.cooldownLeft <= 0) {
            this.performBattleAttack(battle.humanSide, false);
        }
    }

    getBattleInputVector(arcade) {
        const active = (control) => arcade.keys.has(control) || arcade.controls.has(control);
        const x = (active('right') ? 1 : 0) - (active('left') ? 1 : 0);
        const y = (active('down') ? 1 : 0) - (active('up') ? 1 : 0);
        const length = Math.hypot(x, y) || 1;
        return {
            x: x / length,
            y: y / length,
            attacking: active('attack'),
            special: active('special')
        };
    }

    startBattleDuel() {
        const battle = this.activeBattle;
        const arcade = battle?.arcade;
        if (!battle || !arcade || arcade.started) return;

        arcade.started = true;
        arcade.lastTime = performance.now();
        battle.log = `${battle.humanSide === 'attacker' ? battle.attackerName : battle.defenderName} is under your control. Attack with Space/J, special with Shift/K.`;
        this.renderBattlePanel();
        this.setStatusMessage('Battle in progress.', 'thinking');
    }

    updateBattleArcade(time) {
        const battle = this.activeBattle;
        const arcade = battle?.arcade;
        if (!battle || !arcade?.running) return;

        const delta = Math.min(0.04, Math.max(0.001, (time - arcade.lastTime) / 1000));
        arcade.lastTime = time;

        if (arcade.started) {
            this.updateBattlePlayer('attacker', delta);
            this.updateBattlePlayer('defender', delta);
            this.updateBattleProjectiles(delta);
            this.updateBattleSlashes(delta);
        }
        this.updateBattleEffects(delta);
        this.renderBattleArcadeFrame();

        if (!this.activeBattle?.arcade?.running) return;
        this.battleFrameRequest = requestAnimationFrame((nextTime) => this.updateBattleArcade(nextTime));
    }

    updateBattlePlayer(side, delta) {
        const battle = this.activeBattle;
        const arcade = battle?.arcade;
        if (!arcade) return;

        const player = arcade.players[side];
        const targetSide = side === 'attacker' ? 'defender' : 'attacker';
        const target = arcade.players[targetSide];
        let moveX = 0;
        let moveY = 0;
        let attacking = false;
        let special = false;

        if (battle.humanSide === side) {
            const input = this.getBattleInputVector(arcade);
            moveX = input.x;
            moveY = input.y;
            attacking = input.attacking;
            special = input.special;
        } else {
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const distance = Math.hypot(dx, dy) || 1;
            const preferred = player.ranged ? 170 : player.slashRange * 0.78;
            const chase = distance > preferred ? 1 : distance < preferred * 0.62 ? -0.75 : 0;
            const strafe = player.ranged ? Math.sin(performance.now() / 420) * 0.75 : 0.18;
            moveX = (dx / distance) * chase + (-dy / distance) * strafe;
            moveY = (dy / distance) * chase + (dx / distance) * strafe;
            const length = Math.hypot(moveX, moveY) || 1;
            moveX /= length;
            moveY /= length;
            attacking = player.ranged ? distance < 260 : distance < player.slashRange + target.radius + 10;
            special = attacking && player.specialCooldownLeft <= 0 && Math.random() < 0.025;
        }

        if (moveX || moveY) {
            player.aimX = moveX;
            player.aimY = moveY;
        } else {
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const length = Math.hypot(dx, dy) || 1;
            player.aimX = dx / length;
            player.aimY = dy / length;
        }

        player.cooldownLeft = Math.max(0, player.cooldownLeft - delta);
        player.specialCooldownLeft = Math.max(0, player.specialCooldownLeft - delta);
        player.invulnerable = Math.max(0, player.invulnerable - delta);
        player.x = Math.max(player.radius + 8, Math.min(arcade.width - player.radius - 8, player.x + moveX * player.speed * delta));
        player.y = Math.max(player.radius + 8, Math.min(arcade.height - player.radius - 8, player.y + moveY * player.speed * delta));

        if (special && player.specialCooldownLeft <= 0) {
            this.performBattleAttack(side, true);
        } else if (attacking && player.cooldownLeft <= 0) {
            this.performBattleAttack(side, false);
        }
    }

    performBattleAttack(side, special = false) {
        const battle = this.activeBattle;
        const arcade = battle?.arcade;
        if (!arcade) return;

        const player = arcade.players[side];
        const targetSide = side === 'attacker' ? 'defender' : 'attacker';
        const target = arcade.players[targetSide];
        if (special) {
            player.specialCooldownLeft = player.specialCooldown;
            player.cooldownLeft = Math.max(player.cooldownLeft, player.cooldown * 0.65);
        } else {
            player.cooldownLeft = player.cooldown;
        }
        const damage = special ? Math.ceil(player.damage * 1.45) : player.damage;

        if (special) {
            this.performBattleSpecial(side, targetSide, damage);
            return;
        }

        if (player.ranged) {
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const length = Math.hypot(dx, dy) || 1;
            arcade.projectiles.push({
                side,
                targetSide,
                x: player.x + (dx / length) * (player.radius + 4),
                y: player.y + (dy / length) * (player.radius + 4),
                vx: (dx / length) * player.projectileSpeed,
                vy: (dy / length) * player.projectileSpeed,
                radius: player.type === 'dragon' ? 7 : 4,
                damage,
                life: 1.35,
                color: player.type === 'dragon' ? '#ff8848' : player.accent,
                kind: player.type === 'dragon' ? 'fire' : 'bolt',
                moveName: player.moveNames[0]
            });
            return;
        }

        const reach = player.slashRange + target.radius;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const distance = Math.hypot(dx, dy);
        arcade.slashes.push({
            side,
            x: player.x,
            y: player.y,
            aimX: player.aimX,
            aimY: player.aimY,
            range: player.slashRange,
            life: 0.18,
            maxLife: 0.18,
            color: player.accent,
            kind: 'slash'
        });
        if (distance <= reach) {
            this.applyBattleDamage(targetSide, damage, side, player.moveNames[0]);
        }
    }

    performBattleSpecial(side, targetSide, damage) {
        const arcade = this.activeBattle?.arcade;
        if (!arcade) return;

        const player = arcade.players[side];
        const target = arcade.players[targetSide];
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const length = Math.hypot(dx, dy) || 1;
        const aimX = dx / length;
        const aimY = dy / length;
        const moveName = player.moveNames[1];

        if (player.type === 'dragon') {
            [-0.26, 0, 0.26].forEach(offset => {
                const cos = Math.cos(offset);
                const sin = Math.sin(offset);
                arcade.projectiles.push({
                    side,
                    targetSide,
                    x: player.x + aimX * (player.radius + 8),
                    y: player.y + aimY * (player.radius + 8),
                    vx: (aimX * cos - aimY * sin) * 230,
                    vy: (aimX * sin + aimY * cos) * 230,
                    radius: 9,
                    damage,
                    life: 0.9,
                    color: '#ff6a2a',
                    kind: 'fire',
                    moveName
                });
            });
            return;
        }

        if (player.ranged) {
            [-0.18, 0, 0.18].forEach(offset => {
                const cos = Math.cos(offset);
                const sin = Math.sin(offset);
                arcade.projectiles.push({
                    side,
                    targetSide,
                    x: player.x + aimX * (player.radius + 6),
                    y: player.y + aimY * (player.radius + 6),
                    vx: (aimX * cos - aimY * sin) * player.projectileSpeed,
                    vy: (aimX * sin + aimY * cos) * player.projectileSpeed,
                    radius: player.type === 'queen' ? 6 : 4,
                    damage,
                    life: 1.1,
                    color: player.type === 'queen' ? '#ffe58a' : player.accent,
                    kind: player.type === 'bishop' ? 'beam' : 'bolt',
                    moveName
                });
            });
            return;
        }

        const chargeDistance = player.type === 'knight' ? 86 : player.type === 'rook' ? 72 : 54;
        player.x = Math.max(player.radius + 8, Math.min(arcade.width - player.radius - 8, player.x + aimX * chargeDistance));
        player.y = Math.max(player.radius + 8, Math.min(arcade.height - player.radius - 8, player.y + aimY * chargeDistance));
        arcade.slashes.push({
            side,
            x: player.x,
            y: player.y,
            aimX,
            aimY,
            range: player.slashRange + 18,
            life: 0.25,
            maxLife: 0.25,
            color: player.type === 'king' ? '#ffe58a' : player.accent,
            kind: 'special'
        });
        if (Math.hypot(player.x - target.x, player.y - target.y) <= player.slashRange + target.radius + 20) {
            this.applyBattleDamage(targetSide, damage, side, moveName);
        }
    }

    updateBattleProjectiles(delta) {
        const arcade = this.activeBattle?.arcade;
        if (!arcade) return;

        arcade.projectiles = arcade.projectiles.filter(projectile => {
            projectile.x += projectile.vx * delta;
            projectile.y += projectile.vy * delta;
            projectile.life -= delta;

            const target = arcade.players[projectile.targetSide];
            const hit = Math.hypot(projectile.x - target.x, projectile.y - target.y) <= projectile.radius + target.radius;
            if (hit) {
                this.applyBattleDamage(projectile.targetSide, projectile.damage, projectile.side, projectile.moveName);
                return false;
            }
            return projectile.life > 0 &&
                projectile.x > -20 && projectile.x < arcade.width + 20 &&
                projectile.y > -20 && projectile.y < arcade.height + 20;
        });
    }

    updateBattleSlashes(delta) {
        const arcade = this.activeBattle?.arcade;
        if (!arcade) return;
        arcade.slashes = arcade.slashes.filter(slash => {
            slash.life -= delta;
            return slash.life > 0;
        });
    }

    updateBattleEffects(delta) {
        const arcade = this.activeBattle?.arcade;
        if (!arcade) return;
        arcade.effects = arcade.effects.filter(effect => {
            effect.life -= delta;
            effect.radius += 80 * delta;
            return effect.life > 0;
        });
    }

    applyBattleDamage(targetSide, damage, sourceSide, moveName = 'hit') {
        const battle = this.activeBattle;
        const arcade = battle?.arcade;
        if (!battle || !arcade) return;

        const target = arcade.players[targetSide];
        if (target.invulnerable > 0) return;

        target.hp = Math.max(0, target.hp - damage);
        target.invulnerable = 0.22;
        battle.round += 1;
        battle.attackerHp = Math.ceil(arcade.players.attacker.hp);
        battle.defenderHp = Math.ceil(arcade.players.defender.hp);
        const sourceName = sourceSide === 'attacker' ? battle.attackerName : battle.defenderName;
        const targetName = targetSide === 'attacker' ? battle.attackerName : battle.defenderName;
        battle.log = `${sourceName} used ${moveName} on ${targetName} for ${damage}.`;
        arcade.effects.push({ x: target.x, y: target.y, radius: target.radius, life: 0.22, color: '#ffffff' });
        this.renderBattlePanel();

        if (arcade.players.attacker.hp <= 0 || arcade.players.defender.hp <= 0) {
            this.finishBattle(arcade.players.defender.hp <= 0 && (arcade.players.attacker.hp > 0 || battle.attackerAttack >= battle.defenderAttack));
        }
    }

    renderBattleArcadeFrame() {
        const battle = this.activeBattle;
        const arcade = battle?.arcade;
        if (!arcade) return;

        const { ctx, width, height } = arcade;
        ctx.clearRect(0, 0, width, height);
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#08101f');
        gradient.addColorStop(1, '#172642');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        arcade.stars.forEach(star => {
            ctx.fillRect(star.x, star.y, star.size, star.size);
        });

        ctx.strokeStyle = 'rgba(126, 207, 255, 0.16)';
        ctx.lineWidth = 1;
        for (let x = 32; x < width; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 32; y < height; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        arcade.projectiles.forEach(projectile => {
            ctx.fillStyle = projectile.color;
            ctx.strokeStyle = projectile.kind === 'fire' ? '#ffd08a' : projectile.color;
            ctx.lineWidth = projectile.kind === 'beam' ? 4 : 2;
            ctx.beginPath();
            if (projectile.kind === 'fire') {
                ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.35;
                ctx.arc(projectile.x - projectile.vx * 0.02, projectile.y - projectile.vy * 0.02, projectile.radius * 1.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            } else if (projectile.kind === 'beam') {
                ctx.moveTo(projectile.x - projectile.vx * 0.04, projectile.y - projectile.vy * 0.04);
                ctx.lineTo(projectile.x, projectile.y);
                ctx.stroke();
            } else {
                ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        arcade.slashes.forEach(slash => {
            const progress = slash.life / slash.maxLife;
            ctx.strokeStyle = slash.color;
            ctx.globalAlpha = Math.max(0.25, progress);
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(
                slash.x + slash.aimX * 18,
                slash.y + slash.aimY * 18,
                slash.range,
                Math.atan2(slash.aimY, slash.aimX) - 0.65,
                Math.atan2(slash.aimY, slash.aimX) + 0.65
            );
            ctx.stroke();
            ctx.globalAlpha = 1;
        });

        this.drawBattlePlayer(arcade.players.attacker, battle.humanSide === 'attacker');
        this.drawBattlePlayer(arcade.players.defender, battle.humanSide === 'defender');

        arcade.effects.forEach(effect => {
            ctx.strokeStyle = effect.color;
            ctx.globalAlpha = Math.max(0, effect.life / 0.22);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        });

        if (!arcade.started) {
            ctx.fillStyle = 'rgba(7, 16, 30, 0.72)';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = '800 30px Arial, sans-serif';
            ctx.fillText('Press Space to Start', width / 2, height / 2 - 18);
            ctx.font = '700 16px Arial, sans-serif';
            ctx.fillText('Move: WASD / arrows   Attack: Space/J   Special: Shift/K', width / 2, height / 2 + 18);
        }
    }

    drawBattlePlayer(player, isHuman) {
        const arcade = this.activeBattle?.arcade;
        if (!arcade) return;
        const { ctx } = arcade;
        const angle = Math.atan2(player.aimY, player.aimX);

        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(angle);
        ctx.globalAlpha = player.invulnerable > 0 && Math.floor(performance.now() / 70) % 2 === 0 ? 0.5 : 1;
        this.drawBattlePieceShape(ctx, player);
        ctx.restore();

        ctx.fillStyle = isHuman ? '#ffffff' : 'rgba(255,255,255,0.72)';
        ctx.font = '700 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isHuman ? 'YOU' : 'CPU', player.x, player.y - player.radius - 10);
    }

    drawBattlePieceShape(ctx, player) {
        const r = player.radius;
        ctx.lineWidth = 3;
        ctx.fillStyle = player.color;
        ctx.strokeStyle = player.accent;

        const drawBase = () => {
            ctx.beginPath();
            ctx.ellipse(-r * 0.25, r * 0.82, r * 0.95, r * 0.28, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        };
        const drawSword = () => {
            ctx.strokeStyle = '#f8f4df';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(r * 0.2, -r * 0.1);
            ctx.lineTo(r * 1.45, -r * 0.48);
            ctx.stroke();
            ctx.strokeStyle = player.accent;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(r * 0.35, r * 0.15);
            ctx.lineTo(r * 0.05, -r * 0.32);
            ctx.stroke();
        };
        const drawCrown = () => {
            ctx.beginPath();
            ctx.moveTo(-r * 0.7, -r * 0.35);
            ctx.lineTo(-r * 0.42, -r * 1.0);
            ctx.lineTo(-r * 0.08, -r * 0.45);
            ctx.lineTo(r * 0.26, -r * 1.05);
            ctx.lineTo(r * 0.62, -r * 0.32);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        if (player.type === 'dragon') {
            ctx.fillStyle = player.side === 'attacker' ? '#b82034' : '#2774a8';
            ctx.beginPath();
            ctx.ellipse(0, 0, r * 1.2, r * 0.72, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#f05a5a';
            ctx.beginPath();
            ctx.moveTo(-r * 0.4, -r * 0.25);
            ctx.lineTo(-r * 1.35, -r * 1.15);
            ctx.lineTo(-r * 0.05, -r * 0.88);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-r * 0.4, r * 0.25);
            ctx.lineTo(-r * 1.35, r * 1.15);
            ctx.lineTo(-r * 0.05, r * 0.88);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ff9a3c';
            ctx.beginPath();
            ctx.moveTo(r * 1.05, 0);
            ctx.lineTo(r * 1.7, -r * 0.28);
            ctx.lineTo(r * 1.45, 0);
            ctx.lineTo(r * 1.7, r * 0.28);
            ctx.closePath();
            ctx.fill();
            return;
        }

        if (player.type === 'knight') {
            ctx.beginPath();
            ctx.moveTo(-r * 0.75, r * 0.65);
            ctx.lineTo(-r * 0.58, -r * 0.48);
            ctx.lineTo(r * 0.1, -r * 0.95);
            ctx.lineTo(r * 0.82, -r * 0.2);
            ctx.lineTo(r * 0.32, r * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            drawSword();
            return;
        }

        if (player.type === 'rook') {
            ctx.fillRect(-r * 0.72, -r * 0.52, r * 1.35, r * 1.25);
            ctx.strokeRect(-r * 0.72, -r * 0.52, r * 1.35, r * 1.25);
            for (let i = -1; i <= 1; i += 1) {
                ctx.fillRect(i * r * 0.42 - r * 0.14, -r * 0.95, r * 0.28, r * 0.42);
                ctx.strokeRect(i * r * 0.42 - r * 0.14, -r * 0.95, r * 0.28, r * 0.42);
            }
            drawBase();
            return;
        }

        if (player.type === 'bishop') {
            ctx.beginPath();
            ctx.ellipse(0, -r * 0.12, r * 0.68, r * 1.02, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = player.accent;
            ctx.beginPath();
            ctx.moveTo(r * 0.15, -r * 0.85);
            ctx.lineTo(-r * 0.18, -r * 0.12);
            ctx.stroke();
            drawBase();
            return;
        }

        if (player.type === 'queen' || player.type === 'king') {
            ctx.beginPath();
            ctx.ellipse(0, r * 0.1, r * 0.62, r * 0.86, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            drawCrown();
            if (player.type === 'king') {
                ctx.strokeStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(r * 0.85, -r * 0.78);
                ctx.lineTo(r * 0.85, -r * 1.35);
                ctx.moveTo(r * 0.62, -r * 1.08);
                ctx.lineTo(r * 1.08, -r * 1.08);
                ctx.stroke();
            }
            drawBase();
            return;
        }

        if (player.type === 'archer') {
            ctx.beginPath();
            ctx.arc(-r * 0.25, 0, r * 0.72, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#f8f4df';
            ctx.beginPath();
            ctx.arc(r * 0.15, 0, r * 0.95, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(r * 0.2, 0);
            ctx.lineTo(r * 1.45, 0);
            ctx.stroke();
            drawBase();
            return;
        }

        ctx.beginPath();
        ctx.arc(0, -r * 0.55, r * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, r * 0.15, r * 0.58, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawBase();
        drawSword();
    }

    chooseComputerBattleAction(battle, side = 'defender') {
        const hp = side === 'attacker' ? battle.attackerHp : battle.defenderHp;
        const maxHp = side === 'attacker' ? battle.attackerMaxHp : battle.defenderMaxHp;
        if (hp / maxHp < 0.35 && Math.random() < 0.45) {
            return 'guard';
        }
        if (Math.random() < 0.28) {
            return 'power';
        }
        return 'strike';
    }

    rollBattleDamage(attack, action, targetGuarding) {
        let damage = attack + Math.floor(Math.random() * 3) - 1;
        if (action === 'guard') {
            damage = Math.max(1, Math.floor(attack * 0.45));
        } else if (action === 'power') {
            damage = Math.random() < 0.25 ? 0 : Math.ceil(attack * 1.65);
        }
        if (targetGuarding) {
            damage = Math.ceil(damage / 2);
        }
        return Math.max(0, damage);
    }

    describeBattleAction(action) {
        return {
            strike: 'strikes',
            guard: 'guards',
            power: 'swings hard'
        }[action] || 'strikes';
    }

    playBattleRound(playerAction) {
        const battle = this.activeBattle;
        if (!battle) return;

        const defenderAction = this.chooseComputerBattleAction(battle, 'defender');
        const attackerDamage = this.rollBattleDamage(battle.attackerAttack, playerAction, defenderAction === 'guard');
        const defenderDamage = this.rollBattleDamage(battle.defenderAttack, defenderAction, playerAction === 'guard');

        battle.defenderHp -= attackerDamage;
        battle.attackerHp -= defenderDamage;
        battle.log = `${battle.attackerName} ${this.describeBattleAction(playerAction)} for ${attackerDamage}. ${battle.defenderName} ${this.describeBattleAction(defenderAction)} for ${defenderDamage}.`;

        if (battle.defenderHp <= 0 || battle.attackerHp <= 0) {
            this.finishBattle(battle.defenderHp <= 0 && battle.attackerHp <= 0
                ? battle.attackerAttack >= battle.defenderAttack
                : battle.defenderHp <= 0);
            return;
        }

        battle.round += 1;
        this.renderBattlePanel();
    }

    finishBattle(attackerWon) {
        const battle = this.activeBattle;
        if (!battle) return;

        this.stopBattleArcade();
        this.activeBattle = null;
        const panel = document.getElementById('battle-panel');
        if (panel) {
            panel.hidden = true;
            panel.classList.remove('is-arena-active');
        }
        document.body.classList.remove('battle-arena-open');

        if (attackerWon) {
            this.setStatusMessage(`${battle.attackerName} won the battle and takes the square.`, 'ready');
            this.isArcherCapture = battle.archerShot;
            this.movePiece(battle.toRow, battle.toCol);
        } else {
            this.setStatusMessage(`${battle.defenderName} held the square. The capture fails.`, 'warning');
            this.recordLastMove({
                color: battle.attacker.dataset.color,
                type: battle.attacker.dataset.type || this.inferPieceType(battle.attacker.textContent, battle.attacker.dataset.type),
                fromRow: battle.fromRow,
                fromCol: battle.fromCol,
                toRow: battle.toRow,
                toCol: battle.toCol,
                archerShot: battle.archerShot,
                summary: `${battle.attackerName} lost battle at ${this.squareName(battle.toRow, battle.toCol)}`
            });
        }

        if (this.selectedPiece) {
            this.selectedPiece.classList.remove('selected');
        }
        this.clearValidMoves();
        this.selectedPiece = null;
        this.isAiThinking = false;
        this.setBoardDisabled(false);
        this.finishTurnAfterAction();
    }

    autoResolveBattle(captureInfo) {
        const attackerStats = this.getBattleStatsForPiece(captureInfo.attacker);
        const defenderStats = this.getBattleStatsForPiece(captureInfo.defender);
        const battle = {
            attackerHp: attackerStats.hp,
            defenderHp: defenderStats.hp + 1,
            attackerMaxHp: attackerStats.hp,
            defenderMaxHp: defenderStats.hp + 1,
            attackerAttack: attackerStats.attack,
            defenderAttack: defenderStats.attack,
            attackerName: this.getPieceDisplayName(captureInfo.attacker),
            defenderName: this.getPieceDisplayName(captureInfo.defender)
        };

        for (let round = 1; round <= 8 && battle.attackerHp > 0 && battle.defenderHp > 0; round++) {
            const attackerAction = this.chooseComputerBattleAction(battle, 'attacker');
            const defenderAction = this.chooseComputerBattleAction(battle, 'defender');
            battle.defenderHp -= this.rollBattleDamage(battle.attackerAttack, attackerAction, defenderAction === 'guard');
            battle.attackerHp -= this.rollBattleDamage(battle.defenderAttack, defenderAction, attackerAction === 'guard');
        }

        const attackerWon = battle.defenderHp <= 0 && (battle.attackerHp > 0 || battle.attackerAttack >= battle.defenderAttack);
        if (attackerWon) {
            this.setStatusMessage(`${battle.attackerName} won a battle and captured ${battle.defenderName}.`, 'ready');
        } else {
            this.recordLastMove({
                color: captureInfo.attacker.dataset.color,
                type: captureInfo.attacker.dataset.type || this.inferPieceType(captureInfo.attacker.textContent, captureInfo.attacker.dataset.type),
                fromRow: captureInfo.fromRow,
                fromCol: captureInfo.fromCol,
                toRow: captureInfo.toRow,
                toCol: captureInfo.toCol,
                archerShot: captureInfo.archerShot,
                summary: `${battle.attackerName} lost battle at ${this.squareName(captureInfo.toRow, captureInfo.toCol)}`
            });
            this.setStatusMessage(`${battle.defenderName} won the battle. The computer capture fails.`, 'warning');
        }
        return attackerWon;
    }

    finishTurnAfterAction() {
        if (this.gameOver) {
            this.setBoardDisabled(false);
            return;
        }

        const oldPlayer = this.currentPlayer;
        this.currentPlayer = this.getOpponentColor(this.currentPlayer);
        cloudChessLog(`Switched player from ${oldPlayer} to ${this.currentPlayer}`);
        const turnDisplay = document.getElementById('current-turn');
        if (turnDisplay) {
            turnDisplay.textContent = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        }

        const opponentColor = this.currentPlayer;
        const inCheck = this.isKingInCheck(opponentColor);
        let isDraw = false;

        if (inCheck) {
            if (this.isCheckmate(opponentColor)) {
                const winner = opponentColor === 'white' ? 'Black' : 'White';
                this.showGameStatusAnimation('checkmate', 'CHECKMATE!');
                this.gameOver = true;
                this.setStatusMessage(`${winner} wins by checkmate.`, 'game-over');
                setTimeout(() => {
                    alert(`${winner} wins!`);
                }, 2000);
            } else {
                this.showGameStatusAnimation('check', 'CHECK!');
                this.setStatusMessage(`${opponentColor.charAt(0).toUpperCase() + opponentColor.slice(1)} is in check.`, 'check');
            }
        } else if (this.isStalemate(opponentColor)) {
            this.showGameStatusAnimation('stalemate', 'STALEMATE');
            this.gameOver = true;
            this.setStatusMessage('Stalemate. The game is a draw.', 'game-over');
            setTimeout(() => {
                alert('Stalemate! The game is a draw.');
            }, 1500);
            isDraw = true;
        } else if (!this.battleMode || this.gameMode !== 'pvc') {
            this.setStatusMessage(`${this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1)} to move.`, 'ready');
        }

        if (!isDraw && !this.gameOver && this.aiLevel > 0 && this.currentPlayer === 'black') {
            this.isAiThinking = true;
            this.setBoardDisabled(true);
            this.setStatusMessage('The computer is thinking...', 'thinking');
            setTimeout(() => {
                this.makeAIMove();
                this.clearValidMoves();
            }, 500);
        }
    }

    handleTurn() {
        if (this.currentPlayer === 'black') {
            setTimeout(() => this.makeAIMove(), 500); // Delay for better UX
        }
    }

    makeAIMove() {
        if (this.gameOver) {
            this.isAiThinking = false;
            this.setBoardDisabled(false);
            return;
        }

        const opponentColor = this.currentPlayer === 'white' ? 'black' : 'white';
        let moveMade = false;

        if (this.aiLevel === 1) {
            moveMade = this.makeEasyAIMove();
        } else if (this.aiLevel === 2) {
            moveMade = this.makeMediumAIMove();
        } else if (this.aiLevel === 3) {
            moveMade = this.makeHardAIMove();
        }

        if (moveMade === 'battle') {
            return;
        }

        if (!moveMade) {
            cloudChessLog('AI could not find a valid move.');
            this.isAiThinking = false;
            this.setBoardDisabled(false);
            this.setStatusMessage('The computer could not find a legal move.', 'warning');
            return;
        }

        if (this.selectedPiece) {
            this.selectedPiece.classList.remove('selected');
        }
        this.clearValidMoves();
        this.selectedPiece = null;

        let isDraw = false;
        if (this.isKingInCheck(opponentColor)) {
            if (this.isCheckmate(opponentColor)) {
                const winner = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
                this.showGameStatusAnimation('checkmate', 'CHECKMATE!');
                this.gameOver = true;
                this.setStatusMessage(`${winner} wins by checkmate.`, 'game-over');
                setTimeout(() => {
                    alert(`${winner} wins!`);
                }, 2000);
            } else {
                this.showGameStatusAnimation('check', 'CHECK!');
                this.setStatusMessage('Your king is in check. Find a safe move.', 'check');
            }
        } else if (this.isStalemate(opponentColor)) {
            this.showGameStatusAnimation('stalemate', 'STALEMATE');
            this.gameOver = true;
            this.setStatusMessage('Stalemate. The game is a draw.', 'game-over');
            setTimeout(() => {
                alert('Stalemate! The game is a draw.');
            }, 1500);
            isDraw = true;
        }

        this.currentPlayer = opponentColor;
        const turnDisplay = document.getElementById('current-turn');
        if (turnDisplay) {
            turnDisplay.textContent = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        }

        this.isAiThinking = false;
        this.setBoardDisabled(false);

        if (!this.gameOver && !isDraw) {
            this.setStatusMessage('Your move. Select a white piece.', 'ready');
        }
    }

    selectPieceAt(fromRow, fromCol) {
        // Find the square at the given coordinates
        const square = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);

        if (!square) {
            console.error(`No square found at row ${fromRow}, col ${fromCol}`);
            return;
        }

        // Check if there's a piece in the square
        const piece = square.querySelector('.piece');
        if (!piece) {
            console.error(`No piece found at row ${fromRow}, col ${fromCol}`);
            return;
        }

        // Deselect any previously selected piece
        if (this.selectedPiece) {
            this.selectedPiece.classList.remove('selected');
        }

        // Select the new piece
        this.selectedPiece = square;
        square.classList.add('selected');

        // Show valid moves for the selected piece
        this.showValidMoves(fromRow, fromCol);
    }

    makeEasyAIMove() {
        // Prioritize immediate checkmates, then captures, otherwise random move
        const { captureMoves, normalMoves } = this.getAllMovesForColor('black');
        const allMoves = [...captureMoves, ...normalMoves];

        const checkmateMoves = allMoves.filter(move => this.doesMoveDeliverCheckmate(move, 'white'));
        if (checkmateMoves.length > 0) {
            const winningMove = this.pickRandomMove(checkmateMoves);
            if (winningMove) {
                return this.executeMove(winningMove);
            }
        }

        // Choose a move, prioritizing captures
        let move;
        if (captureMoves.length > 0) {
            move = this.pickRandomMove(captureMoves);
        } else if (normalMoves.length > 0) {
            move = this.pickRandomMove(normalMoves);
        } else {
            cloudChessLog("No valid moves for black");
            return false;
        }
        cloudChessLog({ captureMoves, normalMoves })
        cloudChessLog({ move })

        return this.executeMove(move);
    }

    makeMediumAIMove() {
        const { captureMoves, normalMoves } = this.getAllMovesForColor('black');
        const allMoves = [...captureMoves, ...normalMoves];

        const checkmateMoves = allMoves.filter(move => this.doesMoveDeliverCheckmate(move, 'white'));
        if (checkmateMoves.length > 0) {
            const winningCapture = checkmateMoves.filter(move => this.isMoveInList(move, captureMoves));
            const move = winningCapture.length > 0
                ? this.chooseHighestValueCapture(winningCapture)
                : this.pickRandomMove(checkmateMoves);
            if (move) {
                return this.executeMove(move);
            }
        }

        const checkingCaptureMoves = captureMoves.filter(move => this.doesMoveDeliverCheck(move, 'white'));
        if (checkingCaptureMoves.length > 0) {
            const move = this.chooseHighestValueCapture(checkingCaptureMoves);
            return this.executeMove(move);
        }

        const checkingNormalMoves = normalMoves.filter(move => this.doesMoveDeliverCheck(move, 'white'));
        if (checkingNormalMoves.length > 0) {
            const move = this.pickRandomMove(checkingNormalMoves);
            if (move) {
                return this.executeMove(move);
            }
        }

        // First priority: capture moves
        if (captureMoves.length > 0) {
            const move = this.chooseHighestValueCapture(captureMoves);
            return this.executeMove(move);
        }

        // Second priority: avoid pieces that are in danger
        const piecesInDanger = this.findPiecesInDanger('black');

        if (piecesInDanger.length > 0) {
            // Find safe moves for pieces in danger
            const safeMoves = [];

            for (const { row, col } of piecesInDanger) {
                const piece = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                this.selectedPiece = piece;

                // Find all possible moves for this piece
                for (let toRow = 0; toRow < 10; toRow++) {
                    for (let toCol = 0; toCol < 10; toCol++) {
                        if (this.isValidMove(toRow, toCol)) {
                            // Check if this move would make the piece safe
                            if (!this.wouldPieceBeInDanger(row, col, toRow, toCol)) {
                                safeMoves.push({ fromRow: row, fromCol: col, toRow, toCol });
                            }
                        }
                    }
                }
            }

            if (safeMoves.length > 0) {
                // Choose a random safe move
                const move = this.pickRandomMove(safeMoves);
                return this.executeMove(move);
            }
        }

        // Third priority: just make a random move
        if (normalMoves.length > 0) {
            const move = this.pickRandomMove(normalMoves);
            return this.executeMove(move);
        }

        cloudChessLog("No valid moves for black");
        return false;
    }

    makeHardAIMove() {
        const { captureMoves, normalMoves } = this.getAllMovesForColor('black');
        const allMoves = [...captureMoves, ...normalMoves];

        if (allMoves.length === 0) {
            cloudChessLog("No valid moves for black");
            return false;
        }

        const checkmateMoves = allMoves.filter(move => this.doesMoveDeliverCheckmate(move, 'white'));
        if (checkmateMoves.length > 0) {
            const captureFinishes = checkmateMoves.filter(move => this.isMoveInList(move, captureMoves));
            const move = captureFinishes.length > 0
                ? this.chooseHighestValueCapture(captureFinishes)
                : this.pickRandomMove(checkmateMoves);
            if (move) {
                return this.executeMove(move);
            }
        }

        const movesThatPreventMate = allMoves.filter(move => !this.opponentHasMateAfterMove(move, 'black'));
        const candidateMoves = movesThatPreventMate.length > 0 ? movesThatPreventMate : allMoves;

        const safeCaptureMoves = captureMoves.filter(move =>
            this.isMoveInList(move, candidateMoves) &&
            !this.wouldPieceBeInDanger(move.fromRow, move.fromCol, move.toRow, move.toCol)
        );

        const checkingSafeCaptures = safeCaptureMoves.filter(move => this.doesMoveDeliverCheck(move, 'white'));
        if (checkingSafeCaptures.length > 0) {
            const move = this.chooseHighestValueCapture(checkingSafeCaptures);
            return this.executeMove(move);
        }

        if (safeCaptureMoves.length > 0) {
            const move = this.chooseHighestValueCapture(safeCaptureMoves);
            return this.executeMove(move);
        }

        const piecesInDanger = this.findPiecesInDanger('black');
        if (piecesInDanger.length > 0) {
            const safeReliefMoves = [];

            for (const { row, col } of piecesInDanger) {
                const pieceSquare = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                this.selectedPiece = pieceSquare;

                for (let toRow = 0; toRow < 10; toRow++) {
                    for (let toCol = 0; toCol < 10; toCol++) {
                        if (this.isValidMove(toRow, toCol)) {
                            const candidateMove = { fromRow: row, fromCol: col, toRow, toCol };
                            if (
                                this.isMoveInList(candidateMove, candidateMoves) &&
                                !this.wouldPieceBeInDanger(row, col, toRow, toCol)
                            ) {
                                safeReliefMoves.push(candidateMove);
                            }
                        }
                    }
                }
            }

            if (safeReliefMoves.length > 0) {
                const checkingRelief = safeReliefMoves.filter(move => this.doesMoveDeliverCheck(move, 'white'));
                const move = checkingRelief.length > 0
                    ? this.pickRandomMove(checkingRelief)
                    : this.pickRandomMove(safeReliefMoves);
                if (move) {
                    return this.executeMove(move);
                }
            }
        }

        const checkingSafeNormals = candidateMoves
            .filter(move => !this.isMoveInList(move, captureMoves))
            .filter(move => this.doesMoveDeliverCheck(move, 'white') &&
                !this.wouldPieceBeInDanger(move.fromRow, move.fromCol, move.toRow, move.toCol));

        if (checkingSafeNormals.length > 0) {
            const move = this.pickRandomMove(checkingSafeNormals);
            if (move) {
                return this.executeMove(move);
            }
        }

        const quietSafeMoves = candidateMoves.filter(move =>
            !this.isMoveInList(move, captureMoves) &&
            !this.wouldPieceBeInDanger(move.fromRow, move.fromCol, move.toRow, move.toCol)
        );

        if (quietSafeMoves.length > 0) {
            const move = this.pickRandomMove(quietSafeMoves);
            if (move) {
                return this.executeMove(move);
            }
        }

        // Fallback: choose the least costly move if everything is risky
        const pieceValues = {
            '♟': 1, '♙': 1,
            '♟⇣': 2, '♙⇡': 2,
            '♞': 3, '♘': 3,
            '♝': 3, '♗': 3,
            '♜': 5, '♖': 5,
            '🐲': 7, '🐉': 7,
            '♛': 9, '♕': 9,
            '♚': 100, '♔': 100
        };

        const allFallbackMoves = [...normalMoves, ...captureMoves];
        allFallbackMoves.sort((a, b) => {
            const pieceA = document.querySelector(`[data-row="${a.fromRow}"][data-col="${a.fromCol}"]`);
            const pieceB = document.querySelector(`[data-row="${b.fromRow}"][data-col="${b.fromCol}"]`);
            const valueA = pieceA ? (pieceValues[pieceA.textContent] || 10) : 10;
            const valueB = pieceB ? (pieceValues[pieceB.textContent] || 10) : 10;
            return valueA - valueB;
        });

        if (allFallbackMoves.length > 0) {
            return this.executeMove(allFallbackMoves[0]);
        }

        cloudChessLog("No valid moves for black");
        return false;
    }

    executeMove(move) {
        const { fromRow, fromCol, toRow, toCol, archerShot } = move;
        if (!this.selectedPiece) {
            this.selectPieceAt(fromRow, fromCol);
        }
        // Ensure archerShot behavior is honored for engine-controlled moves
        this.isArcherCapture = !!archerShot;
        const captureInfo = this.getMoveCaptureInfo(fromRow, fromCol, toRow, toCol, this.isArcherCapture);
        if (this.shouldBattleForCapture(captureInfo)) {
            this.startBattleForMove(captureInfo);
            return 'battle';
        }
        this.movePiece(toRow, toCol);
        return true;
    }

    findPieces(color) {
        const pieces = [];
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const piece = document.querySelector(`[data-row="${row}"][data-col="${col}"] .piece`);
                if (piece && piece.dataset.color === color) {
                    pieces.push({ row, col });
                }
            }
        }
        return pieces;
    }

    findAllMoves(pieces) {
        const captureMoves = [];
        const normalMoves = [];

        for (const { row, col } of pieces) {
            // Set the selected piece for the current iteration
            const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (!square) continue;

            this.selectedPiece = square; // Set the selected piece
            const pieceEl = square.querySelector('.piece');
            const pieceColor = pieceEl ? pieceEl.dataset.color : null;

            for (let toRow = 0; toRow < 10; toRow++) {
                for (let toCol = 0; toCol < 10; toCol++) {
                    const moveIsValid = this.isValidMove(toRow, toCol);
                    const wasArcherCapture = this.isArcherCapture;
                    this.isArcherCapture = false;

                    if (moveIsValid) {
                        const targetSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
                        const targetPiece = targetSquare ? targetSquare.querySelector('.piece') : null;
                        const isCapture = wasArcherCapture || (targetPiece && pieceColor && targetPiece.dataset.color !== pieceColor);

                        const move = { fromRow: row, fromCol: col, toRow, toCol, archerShot: wasArcherCapture };

                        // Filter out moves that would leave own king in check
                        const leavesInCheck = this.wouldMoveLeaveKingInCheck(row, col, toRow, toCol, wasArcherCapture);
                        if (!leavesInCheck) {
                            if (isCapture) {
                                captureMoves.push(move);
                            } else {
                                normalMoves.push(move);
                            }
                        }
                    }
                }
            }
        }

        // Clear the selected piece after processing
        this.selectedPiece = null;
        return { captureMoves, normalMoves };
    }

    getAllMovesForColor(color) {
        const pieces = this.findPieces(color);
        return this.findAllMoves(pieces);
    }

    pickRandomMove(moves) {
        if (!moves || moves.length === 0) {
            return null;
        }
        const index = Math.floor(Math.random() * moves.length);
        return moves[index];
    }

    resetGraveyards() {
        this.capturedPieces.white = [];
        this.capturedPieces.black = [];
        this.scores.white = 0;
        this.scores.black = 0;

        ['white', 'black'].forEach(color => {
            const container = document.getElementById(`${color}-graveyard`);
            if (container) {
                container.innerHTML = '';
            }
        });

        this.updateScoreboard();
    }

    updateScoreboard() {
        const whiteScoreEl = document.getElementById('white-score');
        if (whiteScoreEl) {
            whiteScoreEl.textContent = this.scores.white;
        }
        const blackScoreEl = document.getElementById('black-score');
        if (blackScoreEl) {
            blackScoreEl.textContent = this.scores.black;
        }
    }

    createCapturedPieceElement(pieceEl) {
        const clone = pieceEl.cloneNode(true);
        clone.classList.add('captured-piece');
        clone.removeAttribute('style');
        return clone;
    }

    recordCapture(capturingColor, capturedPieceEl) {
        if (!capturedPieceEl) {
            return;
        }

        const type = capturedPieceEl.dataset.type || this.inferPieceType(capturedPieceEl.dataset.symbol || capturedPieceEl.textContent, capturedPieceEl.dataset.type);
        const value = this.pieceScoreValues[type] ?? 0;
        this.scores[capturingColor] += value;

        const displayPiece = this.createCapturedPieceElement(capturedPieceEl);
        const container = document.getElementById(`${capturingColor}-graveyard`);
        if (container) {
            container.appendChild(displayPiece);
        }

        this.capturedPieces[capturingColor].push({
            type,
            symbol: capturedPieceEl.dataset.symbol || capturedPieceEl.textContent,
            color: capturedPieceEl.dataset.color || this.inferPieceColor(capturedPieceEl.dataset.symbol || capturedPieceEl.textContent, capturedPieceEl.dataset.color)
        });

        this.updateScoreboard();
    }

    isMoveInList(move, moves) {
        return moves.some(candidate =>
            candidate.fromRow === move.fromRow &&
            candidate.fromCol === move.fromCol &&
            candidate.toRow === move.toRow &&
            candidate.toCol === move.toCol
        );
    }

    simulateMoveOnBoard(move, evaluator) {
        const fromSquare = document.querySelector(`[data-row="${move.fromRow}"][data-col="${move.fromCol}"]`);
        const toSquare = document.querySelector(`[data-row="${move.toRow}"][data-col="${move.toCol}"]`);

        if (!fromSquare || !toSquare) {
            return false;
        }

        const piece = fromSquare.querySelector('.piece');
        if (!piece) {
            return false;
        }

        const originalFromHTML = fromSquare.innerHTML;
        const originalToHTML = toSquare.innerHTML;
        const originalSelected = this.selectedPiece;
        const originalIsArcherCapture = this.isArcherCapture;

        let midSquare = null;
        let originalMidHTML = null;
        let result = false;

        try {
            const pieceClone = piece.cloneNode(true);
            const pieceColor = piece.dataset.color || this.inferPieceColor(piece.textContent, piece.dataset.color);
            const pieceType = piece.dataset.type || this.inferPieceType(piece.textContent, piece.dataset.type);
            const rowDiff = move.toRow - move.fromRow;
            const colDiff = move.toCol - move.fromCol;
            const targetPiece = toSquare.querySelector('.piece');
            const direction = pieceColor === 'white' ? -1 : 1;

            const isArcherCapture =
                pieceType === 'archer' &&
                targetPiece &&
                (
                    (rowDiff === 0 && Math.abs(colDiff) === 1) ||
                    (colDiff === 0 && rowDiff === direction) ||
                    (Math.abs(colDiff) === 1 && rowDiff === direction)
                );

            if (isArcherCapture) {
                toSquare.innerHTML = '';
            } else {
                if (pieceType === 'dragon') {
                    const rowDiffAbs = Math.abs(rowDiff);
                    const colDiffAbs = Math.abs(colDiff);
                    if (rowDiffAbs === 2 || colDiffAbs === 2) {
                        if (rowDiff === 0 || colDiff === 0 || rowDiffAbs === colDiffAbs) {
                            const midRow = (move.fromRow + move.toRow) / 2;
                            const midCol = (move.fromCol + move.toCol) / 2;
                            midSquare = document.querySelector(`[data-row="${midRow}"][data-col="${midCol}"]`);
                            if (midSquare) {
                                originalMidHTML = midSquare.innerHTML;
                                const midPiece = midSquare.querySelector('.piece');
                                if (midPiece && midPiece.dataset.color !== pieceColor) {
                                    midSquare.innerHTML = '';
                                }
                            }
                        }
                    }
                }

                fromSquare.innerHTML = '';
                toSquare.innerHTML = '';
                toSquare.appendChild(pieceClone);

                const isPawn = pieceType === 'pawn';
                const isArcher = pieceType === 'archer';

                if ((isPawn || isArcher) &&
                    ((pieceColor === 'white' && move.toRow === 0) ||
                        (pieceColor === 'black' && move.toRow === 9))) {
                    pieceClone.textContent = pieceColor === 'white' ? '♕' : '♛';
                    pieceClone.classList.remove('archer-piece', 'archer-up', 'archer-down');
                    pieceClone.removeAttribute('data-base');
                    pieceClone.removeAttribute('data-arrow');
                    pieceClone.dataset.type = 'queen';
                    pieceClone.dataset.symbol = pieceClone.textContent;
                    pieceClone.dataset.color = pieceColor;
                }
            }

            result = evaluator();
        } finally {
            fromSquare.innerHTML = originalFromHTML;
            toSquare.innerHTML = originalToHTML;
            if (midSquare) {
                midSquare.innerHTML = originalMidHTML;
            }
            this.selectedPiece = originalSelected;
            this.isArcherCapture = originalIsArcherCapture;
        }

        return result;
    }

    doesMoveDeliverCheckmate(move, opponentColor) {
        return this.simulateMoveOnBoard(move, () => this.isCheckmate(opponentColor));
    }

    doesMoveDeliverCheck(move, opponentColor) {
        return this.simulateMoveOnBoard(move, () => this.isKingInCheck(opponentColor));
    }

    opponentHasMateAfterMove(move, playerColor) {
        const opponentColor = playerColor === 'white' ? 'black' : 'white';
        return this.simulateMoveOnBoard(move, () => {
            const { captureMoves, normalMoves } = this.getAllMovesForColor(opponentColor);
            const opponentMoves = [...captureMoves, ...normalMoves];
            return opponentMoves.some(oppMove =>
                this.simulateMoveOnBoard(oppMove, () => this.isCheckmate(playerColor))
            );
        });
    }

    getPieceValue(row, col) {
        const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        const piece = square ? square.querySelector('.piece') : null;
        if (!piece) {
            return 0;
        }

        const symbol = piece.textContent || '';
        const type = piece.dataset.type || '';

        if (type === 'dragon') return 7;

        if (symbol.includes('♛') || symbol.includes('♕')) return 9;
        if (symbol.includes('♜') || symbol.includes('♖')) return 5;
        if (symbol.includes('♝') || symbol.includes('♗')) return 3;
        if (symbol.includes('♞') || symbol.includes('♘')) return 3;
        if (symbol.includes('♟⇣') || symbol.includes('♙⇡')) return 2;
        if (symbol.includes('♟') || symbol.includes('♙')) return 1;
        if (symbol.includes('♚') || symbol.includes('♔')) return 100;

        return 0;
    }

    chooseHighestValueCapture(captureMoves) {
        let bestValue = -Infinity;
        let bestMoves = [];

        captureMoves.forEach(move => {
            const value = this.getPieceValue(move.toRow, move.toCol);
            if (value > bestValue) {
                bestValue = value;
                bestMoves = [move];
            } else if (value === bestValue) {
                bestMoves.push(move);
            }
        });

        if (bestMoves.length === 0) {
            return captureMoves[Math.floor(Math.random() * captureMoves.length)];
        }

        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    findPiecesInDanger(color) {
        const boardState = this.getBoardSnapshot();
        if (!boardState) {
            return [];
        }

        const opponentColor = color === 'white' ? 'black' : 'white';
        const threatened = [];

        for (let row = 0; row < boardState.length; row++) {
            for (let col = 0; col < boardState[row].length; col++) {
                const piece = boardState[row][col];
                if (piece && piece.color === color) {
                    if (this.isSquareAttackedBy(row, col, opponentColor, boardState)) {
                        threatened.push({ row, col });
                    }
                }
            }
        }

        return threatened;
    }

    wouldPieceBeInDanger(fromRow, fromCol, toRow, toCol) {
        const boardState = this.getBoardSnapshot();
        if (!boardState) {
            return false;
        }

        const piece = boardState[fromRow]?.[fromCol];
        if (!piece) {
            return false;
        }

        const updatedState = boardState.map(row => row.map(cell => (cell ? { ...cell } : null)));
        const opponentColor = piece.color === 'white' ? 'black' : 'white';
        const isArcherSpecial = piece.type === 'archer' && this.isArcherCapture;

        // Remove captured target regardless of movement
        if (updatedState[toRow]) {
            updatedState[toRow][toCol] = null;
        }

        if (!isArcherSpecial) {
            updatedState[fromRow][fromCol] = null;

            if (piece.type === 'dragon' && (Math.abs(toRow - fromRow) === 2 || Math.abs(toCol - fromCol) === 2)) {
                const rowStep = Math.sign(toRow - fromRow);
                const colStep = Math.sign(toCol - fromCol);
                const midRow = fromRow + rowStep;
                const midCol = fromCol + colStep;
                if (midRow >= 0 && midRow < updatedState.length && midCol >= 0 && midCol < updatedState[midRow].length) {
                    updatedState[midRow][midCol] = null;
                }
            }

            updatedState[toRow][toCol] = { ...piece };
        } else {
            // Archer stays in place after special capture
            updatedState[fromRow][fromCol] = { ...piece };
        }

        const finalRow = isArcherSpecial ? fromRow : toRow;
        const finalCol = isArcherSpecial ? fromCol : toCol;
        return this.isSquareAttackedBy(finalRow, finalCol, opponentColor, updatedState);
    }

    wouldMoveLeaveKingInCheck(fromRow, fromCol, toRow, toCol, isArcherCaptureMove = this.isArcherCapture) {
        const fromSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        if (!fromSquare || !toSquare) {
            return false;
        }
        const piece = fromSquare.querySelector('.piece');
        if (!piece) {
            return false;
        }
        const color = piece.dataset.color;

        // Temporarily make the move
        const originalToContent = toSquare.innerHTML;
        const originalFromContent = fromSquare.innerHTML;

        if (isArcherCaptureMove && (piece.dataset.type === 'archer' || (piece.dataset.symbol || '').includes('⇡') || (piece.dataset.symbol || '').includes('⇣'))) {
            toSquare.innerHTML = '';
        } else {
            toSquare.innerHTML = '';
            toSquare.appendChild(piece.cloneNode(true));
            fromSquare.innerHTML = '';
        }

        // Check if the king is in check after the move
        const inCheck = this.isKingInCheck(color);

        // Restore the original board state
        fromSquare.innerHTML = originalFromContent;
        toSquare.innerHTML = originalToContent;

        return inCheck;
    }

    getBoardSnapshot() {
        const boardElement = this.board || document.getElementById('board');
        if (!boardElement) {
            return null;
        }
        this.board = boardElement;

        const snapshot = Array.from({ length: 10 }, () => Array(10).fill(null));
        const squares = boardElement.querySelectorAll('.square');

        squares.forEach(square => {
            const row = parseInt(square.dataset.row, 10);
            const col = parseInt(square.dataset.col, 10);
            const pieceEl = square.querySelector('.piece');

            if (pieceEl) {
                snapshot[row][col] = this.extractPieceInfo(pieceEl);
            }
        });

        return snapshot;
    }

    extractPieceInfo(pieceEl) {
        const symbol = pieceEl.textContent || '';
        const type = this.inferPieceType(symbol, pieceEl.dataset.type);
        const color = this.inferPieceColor(symbol, pieceEl.dataset.color);

        return {
            type,
            color,
            symbol
        };
    }

    inferPieceType(symbol, datasetType) {
        const text = symbol || '';

        if (text.includes('♔') || text.includes('♚')) return 'king';
        if (text.includes('♕') || text.includes('♛')) return 'queen';
        if (text.includes('♖') || text.includes('♜')) return 'rook';
        if (text.includes('♗') || text.includes('♝')) return 'bishop';
        if (text.includes('♘') || text.includes('♞')) return 'knight';
        if (text.includes('♙') || text.includes('♟')) {
            if (text.includes('⇡') || text.includes('⇣')) {
                return 'archer';
            }
            return 'pawn';
        }

        if (datasetType && datasetType.length > 0) {
            return datasetType;
        }

        return '';
    }

    inferPieceColor(symbol, datasetColor) {
        const text = symbol || '';

        if (text.length > 0) {
            const base = text.charAt(0);
            if ('♔♕♖♗♘♙'.includes(base)) return 'white';
            if ('♚♛♜♝♞♟'.includes(base)) return 'black';
        }

        if (datasetColor && datasetColor.length > 0) {
            return datasetColor;
        }

        return '';
    }

    isSquareAttackedBy(row, col, attackerColor, boardState) {
        if (!boardState) {
            return false;
        }

        const size = boardState.length;
        const inBounds = (r, c) => r >= 0 && r < size && c >= 0 && c < size;

        // Knights
        const knightOffsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of knightOffsets) {
            const r = row + dr;
            const c = col + dc;
            if (!inBounds(r, c)) continue;
            const piece = boardState[r][c];
            if (piece && piece.color === attackerColor && piece.type === 'knight') {
                return true;
            }
        }

        // Pawns and archers (diagonal captures)
        const forward = attackerColor === 'white' ? 1 : -1;
        const pawnRow = row + forward;
        if (inBounds(pawnRow, col - 1)) {
            const piece = boardState[pawnRow][col - 1];
            if (piece && piece.color === attackerColor && (piece.type === 'pawn' || piece.type === 'archer')) {
                return true;
            }
        }
        if (inBounds(pawnRow, col + 1)) {
            const piece = boardState[pawnRow][col + 1];
            if (piece && piece.color === attackerColor && (piece.type === 'pawn' || piece.type === 'archer')) {
                return true;
            }
        }

        // Archer forward capture (captures without moving)
        if (inBounds(pawnRow, col)) {
            const piece = boardState[pawnRow][col];
            if (piece && piece.color === attackerColor && piece.type === 'archer') {
                return true;
            }
        }

        // Archer diagonal forward captures (already covered by pawn logic above when piece.type==='archer')

        // King adjacency
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (!inBounds(r, c)) continue;
                const piece = boardState[r][c];
                if (piece && piece.color === attackerColor && piece.type === 'king') {
                    return true;
                }
            }
        }

        // Dragon attacks (one square away)
        const dragonDirections = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        for (const [dr, dc] of dragonDirections) {
            const r1 = row + dr;
            const c1 = col + dc;
            if (!inBounds(r1, c1)) continue;
            const piece = boardState[r1][c1];
            if (piece && piece.color === attackerColor && piece.type === 'dragon') {
                return true;
            }
        }

        // Dragon attacks (two squares away with special capture rules)
        for (const [dr, dc] of dragonDirections) {
            const r2 = row + 2 * dr;
            const c2 = col + 2 * dc;
            if (!inBounds(r2, c2)) continue;
            const target = boardState[r2][c2];
            if (target && target.color === attackerColor && target.type === 'dragon') {
                const mid = boardState[row + dr][col + dc];
                if (!(mid && mid.color === attackerColor)) {
                    return true;
                }
            }
        }

        // Straight-line attacks (rook / queen)
        const straightDirs = [
            [1, 0], [-1, 0], [0, 1], [0, -1]
        ];
        for (const [dr, dc] of straightDirs) {
            let r = row + dr;
            let c = col + dc;
            while (inBounds(r, c)) {
                const piece = boardState[r][c];
                if (piece) {
                    if (piece.color === attackerColor && (piece.type === 'rook' || piece.type === 'queen')) {
                        return true;
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }

        // Diagonal attacks (bishop / queen)
        const diagonalDirs = [
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];
        for (const [dr, dc] of diagonalDirs) {
            let r = row + dr;
            let c = col + dc;
            while (inBounds(r, c)) {
                const piece = boardState[r][c];
                if (piece) {
                    if (piece.color === attackerColor && (piece.type === 'bishop' || piece.type === 'queen')) {
                        return true;
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }

        return false;
    }

    isKingInCheck(color) {
        const boardState = this.getBoardSnapshot();
        if (!boardState) {
            return false;
        }

        let kingRow = -1;
        let kingCol = -1;

        for (let row = 0; row < boardState.length; row++) {
            for (let col = 0; col < boardState[row].length; col++) {
                const piece = boardState[row][col];
                if (piece && piece.color === color && piece.type === 'king') {
                    kingRow = row;
                    kingCol = col;
                    break;
                }
            }
            if (kingRow !== -1) {
                break;
            }
        }

        if (kingRow === -1) {
            cloudChessLog(`King not found for ${color}`);
            return false;
        }

        const opponentColor = color === 'white' ? 'black' : 'white';
        return this.isSquareAttackedBy(kingRow, kingCol, opponentColor, boardState);
    }

    isCheckmate(color) {
        if (!this.isKingInCheck(color)) {
            return false;
        }
        return !this.hasLegalMove(color);
    }

    isStalemate(color) {
        if (this.isKingInCheck(color)) {
            return false;
        }
        return !this.hasLegalMove(color);
    }

    hasLegalMove(color) {
        for (let fromRow = 0; fromRow < 10; fromRow++) {
            for (let fromCol = 0; fromCol < 10; fromCol++) {
                const fromSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
                const piece = fromSquare?.querySelector('.piece');

                if (piece && piece.dataset.color === color) {
                    for (let toRow = 0; toRow < 10; toRow++) {
                        for (let toCol = 0; toCol < 10; toCol++) {
                            const originalSelectedPiece = this.selectedPiece;
                            this.selectedPiece = fromSquare;
                            const moveValid = this.isValidMove(toRow, toCol);
                            const potentialArcherCapture = this.isArcherCapture;
                            this.isArcherCapture = false;
                            if (moveValid) {
                                const leavesInCheck = this.wouldMoveLeaveKingInCheck(fromRow, fromCol, toRow, toCol, potentialArcherCapture);
                                this.selectedPiece = originalSelectedPiece;
                                if (!leavesInCheck) {
                                    return true;
                                }
                            } else {
                                this.selectedPiece = originalSelectedPiece;
                            }
                        }
                    }
                }
            }
        }

        return false;
    }

    showGameStatusAnimation(type, text) {
        // Create the animation element
        const animation = document.createElement('div');
        animation.className = `game-status-animation ${type}-animation`;
        animation.textContent = text;

        // Add it to the board
        if (this.board) {
            this.board.appendChild(animation);

            // Remove it after the animation completes
            setTimeout(() => {
                if (animation.parentNode === this.board) {
                    this.board.removeChild(animation);
                }
            }, type === 'checkmate' ? 3000 : 2000);
        }
    }

    setStatusMessage(message, type = '') {
        const status = document.getElementById('game-status-message');
        if (!status) {
            return;
        }

        status.textContent = message;
        status.dataset.status = type;
    }

    setBoardDisabled(disabled) {
        const boardEl = this.board || document.getElementById('board');
        if (boardEl) {
            boardEl.classList.toggle('board-disabled', disabled);
        }
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            gameBoard.classList.toggle('ai-thinking', disabled);
        }
    }

    startGame(mode, aiLevel = 0, options = {}) {
        this.stopBattleArcade();
        this.gameMode = mode;
        this.aiLevel = aiLevel;
        this.battleMode = mode === 'pvc' && Boolean(options.battleMode);
        this.activeBattle = null;
        this.isAiThinking = false;
        this.gameOver = false;
        this.kingCaptured = null;

        // Clear any existing game boards
        const gameBoard = document.getElementById('game-board');
        const boardContainer = document.getElementById('board');

        // Clear the board container
        if (boardContainer) {
            boardContainer.innerHTML = '';
        }

        // Initialize the game board
        this.gameBoard = this.createInitialBoard();
        this.board = boardContainer;
        this.initializeBoard();
        this.resetGraveyards();
        this.resetMoveHistory();

        // Reset game state
        this.selectedPiece = null;
        this.currentPlayer = 'white';

        // Update turn display
        const turnDisplay = document.getElementById('current-turn');
        if (turnDisplay) {
            turnDisplay.textContent = 'White';
        }

        // Show the game board, hide mode selection
        const modeSelection = document.getElementById('mode-selection');
        if (modeSelection) {
            modeSelection.style.display = 'none';
        }
        if (gameBoard) {
            gameBoard.hidden = false;
            gameBoard.style.display = 'flex';
            gameBoard.classList.toggle('single-player-mode', mode === 'pvc');
            gameBoard.classList.toggle('battle-mode-active', this.battleMode);
        }

        const battlePanel = document.getElementById('battle-panel');
        if (battlePanel) {
            battlePanel.hidden = true;
        }

        // Update navigation
        updateNavigation(true);
        this.setBoardDisabled(false);
        this.setStatusMessage(
            mode === 'pvc'
                ? `Single player: you are White. Computer difficulty ${aiLevel}${this.battleMode ? ' with battle captures' : ''}.`
                : 'Local two-player: pass the device between White and Black.',
            'ready'
        );

        // Show the "Begin" animation
        setTimeout(() => {
            this.showGameStatusAnimation('game-begin', 'BEGIN!');
        }, 100);

        // Track game usage
        if (mode === 'computer' || mode === 'pvc') {
            updateGameStats('Vs Computer Level ' + aiLevel + (this.battleMode ? ' Battle Chess' : ''));
        } else if (mode === 'player' || mode === 'pvp') {
            updateGameStats('Player Vs Player (Local)');
        }

        // Make sure to add the event listener for the board
        if (this.board) {
            // Remove any existing event listeners first
            this.board.removeEventListener('click', this.handleSquareClick);

            // Add the click event listener
            this.board.addEventListener('click', this.handleSquareClick);

        }
    }

    clearValidMoves() {
        // Get all squares with highlighting classes
        const highlightedSquares = document.querySelectorAll('.valid-move, .illegal-move');

        // Remove the highlight classes from each square
        highlightedSquares.forEach(square => {
            square.classList.remove('valid-move', 'illegal-move');
        });
    }

    // Get the current board state
    getBoard() {
        return this.board;
    }

    // Set the board state
    setBoard(boardState) {
        this.board = boardState;
    }


    /**
     * Checks if a piece belongs to the current player
     */
    isPieceOwnedByCurrentPlayer(piece) {
        return piece && piece.dataset.color === this.currentPlayer;
    }

    /**
     * Selects a piece
     */
    selectPiece(square) {
        cloudChessLog("--- ChessGame.selectPiece ---"); // Log entry
        if (this.selectedPiece) {
            cloudChessLog("Deselecting previous piece:", this.selectedPiece);
            this.selectedPiece.classList.remove('selected');
        }

        this.selectedPiece = square;
        square.classList.add('selected');
        cloudChessLog("Selected new piece:", this.selectedPiece);
        cloudChessLog("Calling showValidMoves...");
        this.showValidMoves(); // Note: showValidMoves calls isValidMove repeatedly
        cloudChessLog("--- End ChessGame.selectPiece ---");
    }

    /**
     * Try to move the currently selected piece to the target position
     */
    tryMove(row, col) {
        if (this.gameOver) return;
        cloudChessLog(`--- ChessGame.tryMove to ${row}, ${col} ---`); // Log entry
        if (!this.selectedPiece) {
             console.error("tryMove called but no piece selected!");
             return;
        }

        const selectedRow = parseInt(this.selectedPiece.dataset.row);
        const selectedCol = parseInt(this.selectedPiece.dataset.col);
        cloudChessLog(`Selected piece at: ${selectedRow}, ${selectedCol}`);

        // If clicking on the same square, deselect it
        if (selectedRow === row && selectedCol === col) {
            cloudChessLog("Clicked same square, deselecting.");
            this.selectedPiece.classList.remove('selected');
            this.clearValidMoves();
            this.selectedPiece = null;
             cloudChessLog("--- End ChessGame.tryMove (deselected) ---");
            return;
        }

        // Check if the move is valid
        const valid = this.isValidMove(row, col);
        cloudChessLog(`Is move valid? ${valid}`);

        if (valid) {
            const isArcherCaptureMove = this.isArcherCapture;
            // Check if the move would leave the king in check
            const leavesKingInCheck = this.wouldMoveLeaveKingInCheck(selectedRow, selectedCol, row, col, isArcherCaptureMove);
            cloudChessLog(`Would move leave king in check? ${leavesKingInCheck}`);

            if (leavesKingInCheck) {
                cloudChessLog("Move aborted - would leave king in check.");
                this.setStatusMessage('That move would leave your king in check.', 'warning');
                const illegalSquare = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (illegalSquare) {
                    illegalSquare.classList.add('illegal-move');
                    setTimeout(() => illegalSquare.classList.remove('illegal-move'), 900);
                }
                cloudChessLog("--- End ChessGame.tryMove (check violation) ---");
                return;
            }
            this.isArcherCapture = isArcherCaptureMove;

            const captureInfo = this.getMoveCaptureInfo(selectedRow, selectedCol, row, col, isArcherCaptureMove);
            if (this.shouldBattleForCapture(captureInfo)) {
                this.startBattleForMove(captureInfo);
                cloudChessLog("--- End ChessGame.tryMove (battle started) ---");
                return;
            }

            // Move the piece
            cloudChessLog("Calling movePiece...");
            this.movePiece(row, col); // This is the actual move execution

            // Clear selection and valid moves
             cloudChessLog("Clearing selection and highlights after move.");
            this.selectedPiece.classList.remove('selected'); // Should be null after movePiece? No, movePiece doesn't null it.
            this.clearValidMoves();
            this.selectedPiece = null; // Nullify selection AFTER move

            this.finishTurnAfterAction();
        } else {
            // If the move is not valid, try to select a different piece
            const clickedSquare = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            const pieceOnTarget = clickedSquare ? clickedSquare.querySelector('.piece') : null;

            if (pieceOnTarget && this.isPieceOwnedByCurrentPlayer(pieceOnTarget)) {
                // Clear previous selection
                 cloudChessLog("Invalid move, but clicked on own piece. Selecting new piece.");
                this.selectedPiece.classList.remove('selected');
                this.clearValidMoves();

                // Select new piece
                 cloudChessLog("Calling selectPiece for the newly clicked piece...");
                this.selectPiece(clickedSquare); // Calls selectPiece again
            } else {
                 cloudChessLog("Invalid move and didn't click own piece. Doing nothing.");
                this.setStatusMessage('That piece cannot move there.', 'warning');
            }
        }
         cloudChessLog("--- End ChessGame.tryMove ---");
    }
}

// Add this function to chess.js if it doesn't already have access to the one in index.html
function updateGameStats(gameType) {
    const formData = new FormData();
    formData.append('game_type', gameType);

    fetch('api/update_game_stats.php', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                cloudChessLog('Game usage updated:', data);
            } else {
                console.error('Failed to update game usage:', data.message);
            }
        })
        .catch(error => {
            console.error('Error updating game usage:', error);
        });
}
