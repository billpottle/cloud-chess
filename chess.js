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
        this.wrathPath = null;
        
        // Bind the handleSquareClick method
        this.handleSquareClick = this.handleSquareClick.bind(this);
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
        board[1][6] = '♟'; board[1][7] = '♟'; board[1][8] = '♟'; board[1][9] = '♟';
        
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
        this.board.style.gridTemplateColumns = 'repeat(10, 60px)';
        this.board.style.gridTemplateRows = 'repeat(10, 60px)';
        this.board.style.maxWidth = '600px';
        this.board.style.boxSizing = 'content-box';
        this.board.style.border = '2px solid #333';
        
        // Create the squares and place the pieces
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.classList.add((row + col) % 2 === 0 ? 'white' : 'black');
                square.dataset.row = row;
                square.dataset.col = col;
                
                // Set the square dimensions explicitly
                square.style.width = '60px';
                square.style.height = '60px';
                
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
                            piece.classList.add('white-piece');
                        } else if (pieceSymbol.includes('⇣')) {
                            piece.dataset.type = 'archer';
                            piece.dataset.color = 'black';
                            piece.classList.add('black-piece');
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
    
        // Make sure we're targeting the square, not the piece
        let square = event.target;
        if (!square.classList.contains('square')) {
            // If we clicked on something inside a square (like a piece),
            // find the parent square
            square = square.closest('.square');
            if (!square) {
                console.log('No square found for click');
                return;
            }
        }
        console.log(square);
        
        // Get row and col from the square data attributes
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        
        
        // Continue with your existing logic...
        const piece = square.querySelector('.piece');
        if (this.selectedPiece) {
            // If a piece is already selected, try to move it
            this.tryMove(row, col);
        } else if (piece && this.isPieceOwnedByCurrentPlayer(piece)) {
            // If no piece is selected and we clicked on our own piece, select it
            this.selectPiece(square);
        }
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
                    const midRow = Math.round((fromRow + toRow) / 2);
                    const midCol = Math.round((fromCol + toCol) / 2);
                    
                    // Check if there's a piece in the middle square
                    const midSquare = document.querySelector(`[data-row="${midRow}"][data-col="${midCol}"]`);
                    const midPiece = midSquare.querySelector('.piece');
                    
                    // For dragon, we allow capturing through a piece
                    if (midPiece) {
                        // Store the path for later use in movePiece
                        this.wrathPath = { midRow, midCol };
                        
                        // Can only capture enemy pieces
                        if (midPiece.dataset.color === piece.dataset.color) {
                            return false;
                        }
                    } else {
                        this.wrathPath = null;
                    }
                } else {
                    this.wrathPath = null;
                }
                
                return true;
            }
            
            return false;
        } 
        // Queen movement (♛ or ♕)
        else if (pieceType === '♛' || pieceType === '♕') {
           // console.log(`Checking queen move from ${fromRow},${fromCol} to ${toRow},${toCol}`);
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
            
            // Archer can either move like a pawn or capture diagonally without moving
            
            // Capture without moving (archer special ability)
            if (rowDiff === 0 && colDiff === 1 && targetPiece) {
                this.isArcherCapture = true;
                return true;
            }
            
            // Regular pawn move (forward 1 square)
            if (colDiff === 0 && rowDiff === direction && !targetPiece) {
                this.isArcherCapture = false;
                return true;
            }
            
            // Initial pawn move (forward 2 squares)
            if (colDiff === 0 && rowDiff === 2 * direction && fromRow === startRow && !targetPiece) {
                // Check if the path is clear
                const midRow = fromRow + direction;
                const midSquare = document.querySelector(`[data-row="${midRow}"][data-col="${fromCol}"]`);
                this.isArcherCapture = false;
                return !midSquare.querySelector('.piece');
            }
            
            // Pawn capture (diagonal 1 square)
            if (colDiff === 1 && rowDiff === direction && targetPiece) {
                this.isArcherCapture = false;
                return true;
            }
            
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

    showValidMoves(row, col) {
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 10; j++) {
                if (this.isValidMove(i, j)) {
                    document.querySelector(`[data-row="${i}"][data-col="${j}"]`)
                        .classList.add('valid-move');
                }
            }
        }
    }

    movePiece(toRow, toCol) {

        const fromSquare = this.selectedPiece;
        console.log({fromSquare, toRow, toCol})
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        const piece = fromSquare.querySelector('.piece');
        
        // Check if this is an archer capture without moving
        const isArcher = piece.textContent === '♟⇣' || piece.textContent === '♙⇡';
        const isPawn = piece.textContent === '♟' || piece.textContent === '♙';
        const isArcherCapture = isArcher && this.isArcherCapture;
        
        if (isArcherCapture) {
            // For archer capture without moving, just remove the target piece
            console.log("Archer capturing without moving");
            toSquare.innerHTML = '';
        } else {
            // Handle dragon's wrath ability (capturing through a piece)
            if (this.wrathPath) {
                const midSquare = document.querySelector(`[data-row="${this.wrathPath.midRow}"][data-col="${this.wrathPath.midCol}"]`);
                midSquare.innerHTML = '';
                this.wrathPath = null;
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
                
                // Show promotion animation
                this.showGameStatusAnimation('promotion', 'PROMOTION!');
            }
        }
    }

    handleTurn() {
        if (this.currentPlayer === 'black') {
            setTimeout(() => this.makeAIMove(), 500); // Delay for better UX
        }
    }

    makeAIMove() {
        if (this.aiLevel === 1) {
            this.makeEasyAIMove();
        } else if (this.aiLevel === 2) {
            this.makeMediumAIMove();
        } else if (this.aiLevel === 3) {
            this.makeHardAIMove();
        }
        
         // Clear selection and valid moves
         this.selectedPiece.classList.remove('selected');
         this.clearValidMoves();
         this.selectedPiece = null;
         
         // Switch turns
         this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
         const turnDisplay = document.getElementById('current-turn');
         if (turnDisplay) {
             turnDisplay.textContent = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
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
        // This is the existing AI logic - prioritize captures, otherwise random move
        const blackPieces = this.findPieces('black');
        const { captureMoves, normalMoves } = this.findAllMoves(blackPieces);
      
        // Choose a move, prioritizing captures
        let move;
        if (captureMoves.length > 0) {
            move = captureMoves[Math.floor(Math.random() * captureMoves.length)];
        } else if (normalMoves.length > 0) {
            move = normalMoves[Math.floor(Math.random() * normalMoves.length)];
        } else {
            console.log("No valid moves for black");
            return;
        }
        
        this.executeMove(move);
    }

    makeMediumAIMove() {
        const blackPieces = this.findPieces('black');
        const { captureMoves, normalMoves } = this.findAllMoves(blackPieces);
        
        // First priority: capture moves
        if (captureMoves.length > 0) {
            const move = captureMoves[Math.floor(Math.random() * captureMoves.length)];
            this.executeMove(move);
            return;
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
                const move = safeMoves[Math.floor(Math.random() * safeMoves.length)];
                this.executeMove(move);
                return;
            }
        }
        
        // Third priority: just make a random move
        if (normalMoves.length > 0) {
            const move = normalMoves[Math.floor(Math.random() * normalMoves.length)];
            this.executeMove(move);
        } else {
            console.log("No valid moves for black");
        }
    }

    makeHardAIMove() {
        const blackPieces = this.findPieces('black');
        const { captureMoves, normalMoves } = this.findAllMoves(blackPieces);
        
        // First priority: capture moves that don't put the piece in danger
        if (captureMoves.length > 0) {
            const safeCapturesMoves = captureMoves.filter(move => 
                !this.wouldPieceBeInDanger(move.fromRow, move.fromCol, move.toRow, move.toCol)
            );
            
            if (safeCapturesMoves.length > 0) {
                const move = safeCapturesMoves[Math.floor(Math.random() * safeCapturesMoves.length)];
                this.executeMove(move);
                return;
            }
        }
        
        // Second priority: save pieces that are in danger
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
                const move = safeMoves[Math.floor(Math.random() * safeMoves.length)];
                this.executeMove(move);
                return;
            }
        }
        
        // Third priority: make a move that doesn't put a piece in danger
        const safeMoves = normalMoves.filter(move => 
            !this.wouldPieceBeInDanger(move.fromRow, move.fromCol, move.toRow, move.toCol)
        );
        
        if (safeMoves.length > 0) {
            const move = safeMoves[Math.floor(Math.random() * safeMoves.length)];
            this.executeMove(move);
            return;
        }
        
        // Fourth priority: if all moves would put pieces in danger, sacrifice the least valuable piece
        if (normalMoves.length > 0 || captureMoves.length > 0) {
            const allMoves = [...normalMoves, ...captureMoves];
            
            // Assign piece values
            const pieceValues = {
                '♟': 1, '♙': 1,  // Pawns
                '♟⇣': 2, '♙⇡': 2, // Archers
                '♞': 3, '♘': 3,   // Knights
                '♝': 3, '♗': 3,   // Bishops
                '♜': 5, '♖': 5,   // Rooks
                '🐲': 7, '🐉': 7,  // Wraths (Dragons)
                '♛': 9, '♕': 9,   // Queens
                '♚': 100, '♔': 100 // Kings (extremely high value to avoid sacrificing)
            };
            
            // Sort moves by piece value (ascending)
            allMoves.sort((a, b) => {
                const pieceA = document.querySelector(`[data-row="${a.fromRow}"][data-col="${a.fromCol}"]`);
                const pieceB = document.querySelector(`[data-row="${b.fromRow}"][data-col="${b.fromCol}"]`);
                return pieceValues[pieceA.textContent] - pieceValues[pieceB.textContent];
            });
            
            // Choose the first move in the sorted list
            const move = allMoves[0];
            this.executeMove(move);
        }
    }

    executeMove(move) {
        const { fromRow, fromCol, toRow, toCol } = move;
        console.log(this.selectedPiece)
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
            
            for (let toRow = 0; toRow < 10; toRow++) {
                for (let toCol = 0; toCol < 10; toCol++) {
                    if (this.isValidMove(toRow, toCol)) {
                        const move = { fromRow: row, fromCol: col, toRow, toCol };
                        if (this.isArcherCapture) {
                            captureMoves.push(move);
                        } else {
                            normalMoves.push(move);
                        }
                    }
                }
            }
        }
        
        // Clear the selected piece after processing
        this.selectedPiece = null;
        return { captureMoves, normalMoves };
    }

    findPiecesInDanger(color) {
        const pieces = this.findPieces(color);
        const inDanger = [];
        for (const { row, col } of pieces) {
            if (this.isKingInCheck(color)) {
                inDanger.push({ row, col });
            }
        }
        return inDanger;
    }

    wouldPieceBeInDanger(fromRow, fromCol, toRow, toCol) {
        const move = { fromRow, fromCol, toRow, toCol };
        return this.wouldMoveLeaveKingInCheck(fromRow, fromCol, toRow, toCol);
    }

    wouldMoveLeaveKingInCheck(fromRow, fromCol, toRow, toCol) {
        const fromSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        const piece = fromSquare.querySelector('.piece');
        const color = piece.dataset.color;
        
        // Temporarily make the move
        const originalToContent = toSquare.innerHTML;
        const originalFromContent = fromSquare.innerHTML;
        
        toSquare.innerHTML = '';
        toSquare.appendChild(piece.cloneNode(true));
        fromSquare.innerHTML = '';
        
        // Check if the king is in check after the move
        const inCheck = this.isKingInCheck(color);
        
        // Restore the original board state
        fromSquare.innerHTML = originalFromContent;
        toSquare.innerHTML = originalToContent;
        
        return inCheck;
    }

    isKingInCheck(color) {
        // Find the king's position
        let kingRow = -1;
        let kingCol = -1;
        
        // Look for the king on the board
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                const piece = square?.querySelector('.piece');
                
                if (piece && piece.dataset.color === color) {
                    // Check for king pieces
                    if (piece.dataset.type === 'king' || 
                        piece.textContent === '♔' || 
                        piece.textContent === '♚') {
                        kingRow = row;
                        kingCol = col;
                
                        break;
                    }
                }
            }
            if (kingRow !== -1) break;
        }
        
        if (kingRow === -1) {
            console.log(`King not found for ${color}`);
            return false; // King not found
        }
        
    
        
        // Check if any opponent piece can capture the king
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                const piece = square?.querySelector('.piece');
                
                if (piece && piece.dataset.color === opponentColor) {
                    // Save current selected piece
                    const originalSelectedPiece = this.selectedPiece;
                    
                    // Temporarily select this opponent piece
                    this.selectedPiece = square;
                    
                    // Log the piece type and position
                  //  console.log(`Checking if ${opponentColor} ${piece.textContent || piece.dataset.type} at ${row},${col} can capture the ${color} king at ${kingRow},${kingCol}`);

                    // Check if it can capture the king
                    const canCapture = this.isValidMove(kingRow, kingCol);
                   // console.log(`Can capture: ${canCapture}`);

                    // Restore original selection
                    this.selectedPiece = originalSelectedPiece;
                    
                    if (canCapture) {
                        console.log(`${opponentColor} piece at ${row},${col} can capture the ${color} king`);
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    isCheckmate(color) {
        // If the king is not in check, it's not checkmate
        if (!this.isKingInCheck(color)) {
            return false;
        }
        
        // Check if any move can get the king out of check
        for (let fromRow = 0; fromRow < 10; fromRow++) {
            for (let fromCol = 0; fromCol < 10; fromCol++) {
                const fromSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
                const piece = fromSquare?.querySelector('.piece');
                
                if (piece && piece.dataset.color === color) {
                    // Try all possible moves for this piece
                    for (let toRow = 0; toRow < 10; toRow++) {
                        for (let toCol = 0; toCol < 10; toCol++) {
                            // Save current selected piece
                            const originalSelectedPiece = this.selectedPiece;
                            
                            // Temporarily select this piece
                            this.selectedPiece = fromSquare;
                            
                            // Check if the move is valid
                            if (this.isValidMove(toRow, toCol)) {
                                // Check if this move would get the king out of check
                                if (!this.wouldMoveLeaveKingInCheck(fromRow, fromCol, toRow, toCol)) {
                                    // Restore original selection
                                    this.selectedPiece = originalSelectedPiece;
                                    return false; // Found a legal move, not checkmate
                                }
                            }
                            
                            // Restore original selection
                            this.selectedPiece = originalSelectedPiece;
                        }
                    }
                }
            }
        }
        
        // No legal moves found, it's checkmate
        return true;
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
        // Get all squares with the valid-move class
        const validMoveSquares = document.querySelectorAll('.valid-move');
        
        // Remove the class from each square
        validMoveSquares.forEach(square => {
            square.classList.remove('valid-move');
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
    
    // Make a move
    move(from, to) {
        // ... existing move logic ...
        
        // Make sure the board state is updated
        const piece = this.board[from.row][from.col];
        this.board[from.row][from.col] = null;
        this.board[to.row][to.col] = piece;
        
        // ... rest of move logic ...
        
        return { success: true, from, to, piece };
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
        if (this.selectedPiece) {
            this.selectedPiece.classList.remove('selected');
        }
        
        this.selectedPiece = square;
        square.classList.add('selected');
        this.showValidMoves();
    }

    /**
     * Try to move the currently selected piece to the target position
     */
    tryMove(row, col) {
        const selectedRow = parseInt(this.selectedPiece.dataset.row);
        const selectedCol = parseInt(this.selectedPiece.dataset.col);
        
        // If clicking on the same square, deselect it
        if (selectedRow === row && selectedCol === col) {
            this.selectedPiece.classList.remove('selected');
            this.clearValidMoves();
            this.selectedPiece = null;
            return;
        }
        
        // Check if the move is valid
        if (this.isValidMove(row, col)) {
            // Check if the move would leave the king in check
            if (this.wouldMoveLeaveKingInCheck(selectedRow, selectedCol, row, col)) {
                alert("That move would leave your king in check!");
                return;
            }
            
            // Move the piece
            this.movePiece(row, col);
            
            // Clear selection and valid moves
            this.selectedPiece.classList.remove('selected');
            this.clearValidMoves();
            this.selectedPiece = null;
            
            // Switch turns
            this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
            const turnDisplay = document.getElementById('current-turn');
            if (turnDisplay) {
                turnDisplay.textContent = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
            }
            
            // Check if the opponent's king is in check
            const opponentColor = this.currentPlayer;
            const inCheck = this.isKingInCheck(opponentColor);
            console.log(`${opponentColor} king in check: ${inCheck}`);
            
            if (inCheck) {
                // Check if it's checkmate
                if (this.isCheckmate(opponentColor)) {
                    const winner = opponentColor === 'white' ? 'Black' : 'White';
                    this.showGameStatusAnimation('checkmate', 'CHECKMATE!');
                    setTimeout(() => {
                        alert(`${winner} wins!`);
                    }, 2000);
                } else {
                    this.showGameStatusAnimation('check', 'CHECK!');
                }
            }
            
            // If playing against AI, make the AI move
            if (this.aiLevel > 0 && this.currentPlayer === 'black') {
                setTimeout(() => {
                    this.makeAIMove();
                    this.clearValidMoves();
                }, 500);
            }
        } else {
            // If the move is not valid, try to select a different piece
            const piece = document.querySelector(`[data-row="${row}"][data-col="${col}"]`).querySelector('.piece');
            if (piece && piece.dataset.color === this.currentPlayer) {
                // Clear previous selection
                this.selectedPiece.classList.remove('selected');
                this.clearValidMoves();
                
                // Select new piece
                this.selectedPiece = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                this.selectedPiece.classList.add('selected');
                this.showValidMoves();
            }
        }
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