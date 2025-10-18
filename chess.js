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

        console.log('Navigation updated for game mode - New Game button should be visible');
    } else {
        // In home mode, hide the "Home" link since we're already home
        homeLink.style.display = 'none';
        console.log('Navigation updated for home mode - Home button hidden');
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
            if (difficulty > 0) {
                window.gameInstance.startGame('pvc', difficulty);
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
    console.log(`Found ${squares.length} squares`);
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
        this.isArcherCapture = false;
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
    }

    handleSquareClick(event) {
        console.log("--- ChessGame.handleSquareClick ---"); // Base log

        // Make sure we're targeting the square, not the piece
        let square = event.target;
        if (!square.classList.contains('square')) {
            // If we clicked on something inside a square (like a piece),
            // find the parent square
            square = square.closest('.square');
            if (!square) {
                console.log('No square found for click - returning');
                return;
            }
        }

        // Get row and col from the square data attributes
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        console.log(`Clicked square: row=${row}, col=${col}`);

        // Continue with your existing logic...
        const piece = square.querySelector('.piece');
        console.log("Piece found:", piece ? piece.textContent : 'None');
        console.log("Current player:", this.currentPlayer);
        console.log("Is piece selected?", !!this.selectedPiece, this.selectedPiece ? `(Row: ${this.selectedPiece.dataset.row}, Col: ${this.selectedPiece.dataset.col})` : '');


        if (this.selectedPiece) {
            // If a piece is already selected, try to move it
            console.log("Attempting to call tryMove...");
            this.tryMove(row, col);
        } else if (piece) {
            const owned = this.isPieceOwnedByCurrentPlayer(piece);
            console.log(`Is piece owned by current player (${this.currentPlayer})?`, owned);
            if (owned) {
                // If no piece is selected and we clicked on our own piece, select it
                console.log("Attempting to call selectPiece...");
                this.selectPiece(square);
            } else {
                 console.log("Clicked on opponent's piece, doing nothing.");
            }
        } else {
             console.log("Clicked on empty square with no piece selected, doing nothing.");
        }
        console.log("--- End ChessGame.handleSquareClick ---");
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
            //  console.log(`Checking queen move from ${fromRow},${fromCol} to ${toRow},${toCol}`);
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);

            // Queen can move any number of squares horizontally, vertically, or diagonally
            if (!(rowDiff === 0 || colDiff === 0 || rowDiff === colDiff)) {
                //        console.log('Invalid queen move - not horizontal, vertical, or diagonal');
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
                    //       console.log(`Path blocked at ${currentRow},${currentCol}`);
                    return false; // Path is blocked
                }
                currentRow += rowStep;
                currentCol += colStep;
            }

            console.log('Valid queen move');
            return true;
        }
        // Rook movement (♜ or ♖)
        else if (pieceType === '♜' || pieceType === '♖') {
            // console.log(`Checking rook move from ${fromRow},${fromCol} to ${toRow},${toCol}`);
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);

            // Rook can only move horizontally or vertically
            if (!(rowDiff === 0 || colDiff === 0) || (rowDiff === 0 && colDiff === 0)) {
                //        console.log('Invalid rook move - not horizontal or vertical');
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
                    console.log(`Path blocked at ${currentRow},${currentCol}`);
                    return false; // Path is blocked
                }
                currentRow += rowStep;
                currentCol += colStep;
            }

            console.log('Valid rook move');
            return true;
        }
        // Bishop movement (♝ or ♗)
        else if (pieceType === '♝' || pieceType === '♗') {
            //  console.log(`Checking bishop move from ${fromRow},${fromCol} to ${toRow},${toCol}`);
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);

            // Bishop can only move diagonally
            if (rowDiff !== colDiff || rowDiff === 0) {
                //    console.log('Invalid bishop move - not diagonal');
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
                    //       console.log(`Path blocked at ${currentRow},${currentCol}`);
                    return false; // Path is blocked
                }
                currentRow += rowStep;
                currentCol += colStep;
            }

            console.log('Valid bishop move');
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

            // Archer special: capture without moving, diagonally forward only
            if (targetPiece && colDiff === 1 && rowDiff === direction) {
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
        console.log({ fromSquare, toRow, toCol })
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        const piece = fromSquare.querySelector('.piece');
        console.log({ piece })

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
            console.log("Archer capturing without moving");
            if (targetPiece && targetPiece.dataset.color !== movingColor) {
                this.recordCapture(movingColor, targetPiece);
            }
            toSquare.innerHTML = '';
        } else {
            // Handle wrath ability (capturing through a piece)
            const rowDiff = Math.abs(fromSquare.dataset.row - toRow);
            const colDiff = Math.abs(fromSquare.dataset.col - toCol);

            if (targetPiece && targetPiece.dataset.color !== movingColor) {
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
                            console.log("Wrath activated: Capturing middle piece");
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

        // Notify hooks/listeners about the completed move (before turn switches)
        if (typeof this.onAfterMove === 'function') {
            const didCapture = !!targetPiece || midCaptureOccurred;
            try {
                this.onAfterMove({ fromRow: fromRowInt, fromCol: fromColInt, toRow, toCol, didCapture });
            } catch (e) {
                console.error('onAfterMove hook error:', e);
            }
        }

        this.isArcherCapture = false;
    }

    handleTurn() {
        if (this.currentPlayer === 'black') {
            setTimeout(() => this.makeAIMove(), 500); // Delay for better UX
        }
    }

    makeAIMove() {
        const opponentColor = this.currentPlayer === 'white' ? 'black' : 'white';
        let moveMade = false;

        if (this.aiLevel === 1) {
            moveMade = this.makeEasyAIMove();
        } else if (this.aiLevel === 2) {
            moveMade = this.makeMediumAIMove();
        } else if (this.aiLevel === 3) {
            moveMade = this.makeHardAIMove();
        }

        if (!moveMade) {
            console.warn('AI could not find a valid move.');
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
                setTimeout(() => {
                    alert(`${winner} wins!`);
                }, 2000);
            } else {
                this.showGameStatusAnimation('check', 'CHECK!');
            }
        } else if (this.isStalemate(opponentColor)) {
            this.showGameStatusAnimation('stalemate', 'STALEMATE');
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

        if (isDraw) {
            return;
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
                this.executeMove(winningMove);
                return true;
            }
        }

        // Choose a move, prioritizing captures
        let move;
        if (captureMoves.length > 0) {
            move = this.pickRandomMove(captureMoves);
        } else if (normalMoves.length > 0) {
            move = this.pickRandomMove(normalMoves);
        } else {
            console.log("No valid moves for black");
            return false;
        }
        console.log({ captureMoves, normalMoves })
        console.log({ move })

        this.executeMove(move);
        return true;
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
                this.executeMove(move);
                return true;
            }
        }

        const checkingCaptureMoves = captureMoves.filter(move => this.doesMoveDeliverCheck(move, 'white'));
        if (checkingCaptureMoves.length > 0) {
            const move = this.chooseHighestValueCapture(checkingCaptureMoves);
            this.executeMove(move);
            return true;
        }

        const checkingNormalMoves = normalMoves.filter(move => this.doesMoveDeliverCheck(move, 'white'));
        if (checkingNormalMoves.length > 0) {
            const move = this.pickRandomMove(checkingNormalMoves);
            if (move) {
                this.executeMove(move);
                return true;
            }
        }

        // First priority: capture moves
        if (captureMoves.length > 0) {
            const move = this.chooseHighestValueCapture(captureMoves);
            this.executeMove(move);
            return true;
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
                this.executeMove(move);
                return true;
            }
        }

        // Third priority: just make a random move
        if (normalMoves.length > 0) {
            const move = this.pickRandomMove(normalMoves);
            this.executeMove(move);
            return true;
        }

        console.log("No valid moves for black");
        return false;
    }

    makeHardAIMove() {
        const { captureMoves, normalMoves } = this.getAllMovesForColor('black');
        const allMoves = [...captureMoves, ...normalMoves];

        if (allMoves.length === 0) {
            console.log("No valid moves for black");
            return false;
        }

        const checkmateMoves = allMoves.filter(move => this.doesMoveDeliverCheckmate(move, 'white'));
        if (checkmateMoves.length > 0) {
            const captureFinishes = checkmateMoves.filter(move => this.isMoveInList(move, captureMoves));
            const move = captureFinishes.length > 0
                ? this.chooseHighestValueCapture(captureFinishes)
                : this.pickRandomMove(checkmateMoves);
            if (move) {
                this.executeMove(move);
                return true;
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
            this.executeMove(move);
            return true;
        }

        if (safeCaptureMoves.length > 0) {
            const move = this.chooseHighestValueCapture(safeCaptureMoves);
            this.executeMove(move);
            return true;
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
                    this.executeMove(move);
                    return true;
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
                this.executeMove(move);
                return true;
            }
        }

        const quietSafeMoves = candidateMoves.filter(move =>
            !this.isMoveInList(move, captureMoves) &&
            !this.wouldPieceBeInDanger(move.fromRow, move.fromCol, move.toRow, move.toCol)
        );

        if (quietSafeMoves.length > 0) {
            const move = this.pickRandomMove(quietSafeMoves);
            if (move) {
                this.executeMove(move);
                return true;
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
            this.executeMove(allFallbackMoves[0]);
            return true;
        }

        console.log("No valid moves for black");
        return false;
    }

    executeMove(move) {
        const { fromRow, fromCol, toRow, toCol } = move;
        if (!this.selectedPiece) {
            this.selectPieceAt(fromRow, fromCol);
        }
        this.movePiece(toRow, toCol);
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

                        const move = { fromRow: row, fromCol: col, toRow, toCol };

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

        // Archer special captures are only diagonal forward without moving (handled by pawnRow +/- 1 above)

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
            console.warn(`King not found for ${color}`);
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

    startGame(mode, aiLevel = 0) {
        this.gameMode = mode;
        this.aiLevel = aiLevel;

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
            gameBoard.style.display = 'block';
        }

        // Update navigation
        updateNavigation(true);

        // Show the "Begin" animation
        setTimeout(() => {
            this.showGameStatusAnimation('game-begin', 'BEGIN!');
        }, 100);

        // Track game usage
        if (mode === 'computer') {
            updateGameStats('Vs Computer Level ' + aiLevel);
        } else if (mode === 'player') {
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
        console.log("--- ChessGame.selectPiece ---"); // Log entry
        if (this.selectedPiece) {
            console.log("Deselecting previous piece:", this.selectedPiece);
            this.selectedPiece.classList.remove('selected');
        }

        this.selectedPiece = square;
        square.classList.add('selected');
        console.log("Selected new piece:", this.selectedPiece);
        console.log("Calling showValidMoves...");
        this.showValidMoves(); // Note: showValidMoves calls isValidMove repeatedly
        console.log("--- End ChessGame.selectPiece ---");
    }

    /**
     * Try to move the currently selected piece to the target position
     */
    tryMove(row, col) {
        console.log(`--- ChessGame.tryMove to ${row}, ${col} ---`); // Log entry
        if (!this.selectedPiece) {
             console.error("tryMove called but no piece selected!");
             return;
        }

        const selectedRow = parseInt(this.selectedPiece.dataset.row);
        const selectedCol = parseInt(this.selectedPiece.dataset.col);
        console.log(`Selected piece at: ${selectedRow}, ${selectedCol}`);

        // If clicking on the same square, deselect it
        if (selectedRow === row && selectedCol === col) {
            console.log("Clicked same square, deselecting.");
            this.selectedPiece.classList.remove('selected');
            this.clearValidMoves();
            this.selectedPiece = null;
             console.log("--- End ChessGame.tryMove (deselected) ---");
            return;
        }

        // Check if the move is valid
        const valid = this.isValidMove(row, col);
        console.log(`Is move valid? ${valid}`);

        if (valid) {
            const isArcherCaptureMove = this.isArcherCapture;
            // Check if the move would leave the king in check
            const leavesKingInCheck = this.wouldMoveLeaveKingInCheck(selectedRow, selectedCol, row, col, isArcherCaptureMove);
            console.log(`Would move leave king in check? ${leavesKingInCheck}`);

            if (leavesKingInCheck) {
                console.log("Move aborted - would leave king in check.");
                console.log("--- End ChessGame.tryMove (check violation) ---");
                return;
            }
            this.isArcherCapture = isArcherCaptureMove;

            // Move the piece
            console.log("Calling movePiece...");
            this.movePiece(row, col); // This is the actual move execution

            // Clear selection and valid moves
             console.log("Clearing selection and highlights after move.");
            this.selectedPiece.classList.remove('selected'); // Should be null after movePiece? No, movePiece doesn't null it.
            this.clearValidMoves();
            this.selectedPiece = null; // Nullify selection AFTER move

            // Switch turns - IMPORTANT: This might be overridden in multiplayer.js!
            const oldPlayer = this.currentPlayer;
            this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
            console.log(`Switched player from ${oldPlayer} to ${this.currentPlayer} (in base class)`);
            const turnDisplay = document.getElementById('current-turn');
            if (turnDisplay) {
                turnDisplay.textContent = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
            }

            // Check if the opponent's king is in check
            const opponentColor = this.currentPlayer;
            const inCheck = this.isKingInCheck(opponentColor);
            console.log(`${opponentColor} king in check: ${inCheck}`);
            let isDraw = false;

            if (inCheck) {
                // Check if it's checkmate
                if (this.isCheckmate(opponentColor)) {
                    const winner = opponentColor === 'white' ? 'Black' : 'White';
                     console.log("Checkmate detected!");
                    this.showGameStatusAnimation('checkmate', 'CHECKMATE!');
                    setTimeout(() => {
                        alert(`${winner} wins!`);
                    }, 2000);
                } else {
                     console.log("Check detected.");
                    this.showGameStatusAnimation('check', 'CHECK!');
                }
            } else if (this.isStalemate(opponentColor)) {
                 console.log("Stalemate detected.");
                this.showGameStatusAnimation('stalemate', 'STALEMATE');
                setTimeout(() => {
                    alert('Stalemate! The game is a draw.');
                }, 1500);
                isDraw = true;
            }

            // If playing against AI, make the AI move
            if (!isDraw && this.aiLevel > 0 && this.currentPlayer === 'black') {
                 console.log("Handing over to AI...");
                setTimeout(() => {
                    this.makeAIMove();
                    this.clearValidMoves();
                }, 500);
            }
        } else {
            // If the move is not valid, try to select a different piece
            const clickedSquare = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            const pieceOnTarget = clickedSquare ? clickedSquare.querySelector('.piece') : null;

            if (pieceOnTarget && this.isPieceOwnedByCurrentPlayer(pieceOnTarget)) {
                // Clear previous selection
                 console.log("Invalid move, but clicked on own piece. Selecting new piece.");
                this.selectedPiece.classList.remove('selected');
                this.clearValidMoves();

                // Select new piece
                 console.log("Calling selectPiece for the newly clicked piece...");
                this.selectPiece(clickedSquare); // Calls selectPiece again
            } else {
                 console.log("Invalid move and didn't click own piece. Doing nothing.");
            }
        }
         console.log("--- End ChessGame.tryMove ---");
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
                console.log('Game usage updated:', data);
            } else {
                console.error('Failed to update game usage:', data.message);
            }
        })
        .catch(error => {
            console.error('Error updating game usage:', error);
        });
}
