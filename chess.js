// Game initialization
window.addEventListener('load', () => {
    const modeSelection = document.getElementById('mode-selection');
    const gameBoard = document.getElementById('game-board');
    const vsPlayerBtn = document.getElementById('vs-player');
    const vsComputer1Btn = document.getElementById('vs-computer-1');
    const vsComputer2Btn = document.getElementById('vs-computer-2');
    
    vsPlayerBtn.addEventListener('click', () => {
        modeSelection.style.display = 'none';
        gameBoard.style.display = 'block';
        new ChessGame(0); // 0 means not vs computer
    });
    
    vsComputer1Btn.addEventListener('click', () => {
        modeSelection.style.display = 'none';
        gameBoard.style.display = 'block';
        new ChessGame(1); // 1 means vs computer level 1 (easy)
    });
    
    vsComputer2Btn.addEventListener('click', () => {
        modeSelection.style.display = 'none';
        gameBoard.style.display = 'block';
        new ChessGame(2); // 2 means vs computer level 2 (medium)
    });
});

class ChessGame {
    constructor(aiLevel) {
        this.board = document.getElementById('board');
        this.currentPlayer = 'white';
        this.selectedPiece = null;
        this.gameBoard = this.createInitialBoard();
        this.aiLevel = aiLevel; // 0: no AI, 1: easy AI, 2: medium AI
        this.initializeBoard();
        
        // Initialize turn handling if playing vs computer
        if (this.aiLevel > 0) {
            this.handleTurn();
        }
    }

    createInitialBoard() {
        // Create a 10x10 board with empty spaces
        const board = Array(10).fill().map(() => Array(10).fill(''));
        
        // Black pieces (top row) - wraths in corners, other pieces moved inward
        board[0][0] = '🐉'; // Black Wrath (dragon) in left corner
        board[0][1] = '♜'; board[0][2] = '♞'; board[0][3] = '♝'; 
        board[0][4] = '♛'; board[0][5] = '♚'; // Queen and King
        board[0][6] = '♝'; board[0][7] = '♞'; board[0][8] = '♜';
        board[0][9] = '🐉'; // Black Wrath (dragon) in right corner
        
        // Black pawns and archers (second row)
        board[1][0] = '♟'; board[1][1] = '♟'; board[1][2] = '♟'; board[1][3] = '♟';
        board[1][4] = '🏹'; // Black archer in front of queen
        board[1][5] = '🏹'; // Black archer in front of king
        board[1][6] = '♟'; board[1][7] = '♟'; board[1][8] = '♟'; board[1][9] = '♟';
        
        // White pawns and archers (ninth row)
        board[8][0] = '♙'; board[8][1] = '♙'; board[8][2] = '♙'; board[8][3] = '♙';
        board[8][4] = '🏹'; // White archer in front of queen
        board[8][5] = '🏹'; // White archer in front of king
        board[8][6] = '♙'; board[8][7] = '♙'; board[8][8] = '♙'; board[8][9] = '♙';
        
        // White pieces (bottom row) - wraths in corners, other pieces moved inward
        board[9][0] = '🐉'; // White Wrath (dragon) in left corner
        board[9][1] = '♖'; board[9][2] = '♘'; board[9][3] = '♗'; 
        board[9][4] = '♕'; board[9][5] = '♔'; // Queen and King
        board[9][6] = '♗'; board[9][7] = '♘'; board[9][8] = '♖';
        board[9][9] = '🐉'; // White Wrath (dragon) in right corner
        
        return board;
    }

    initializeBoard() {
        // Update CSS grid to 10x10
        this.board.style.gridTemplateColumns = 'repeat(10, 60px)';
        this.board.style.gridTemplateRows = 'repeat(10, 60px)';
        
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                if (this.gameBoard[row][col]) {
                    const piece = document.createElement('div');
                    piece.className = 'piece';
                    piece.textContent = this.gameBoard[row][col];
                    piece.dataset.color = row < 2 ? 'black' : (row > 7 ? 'white' : '');
                    square.appendChild(piece);
                }

                square.addEventListener('click', (e) => this.handleSquareClick(e));
                this.board.appendChild(square);
            }
        }
    }

    handleSquareClick(event) {
        // Only allow moves for the current player
        if (this.aiLevel > 0 && this.currentPlayer === 'black') return;
        
        const square = event.target.classList.contains('square') 
            ? event.target 
            : event.target.parentElement;
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        const piece = square.querySelector('.piece');

        // Clear previous selections
        this.clearHighlights();

        if (this.selectedPiece) {
            if (this.isValidMove(row, col)) {
                this.movePiece(row, col);
                this.selectedPiece = null;
                this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
                document.getElementById('current-turn').textContent = 
                    this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
                
                // Trigger AI move if playing vs computer and it's black's turn
                if (this.aiLevel > 0 && this.currentPlayer === 'black') {
                    this.handleTurn();
                }
            } else {
                this.selectedPiece = null;
            }
        } else if (piece && piece.dataset.color === this.currentPlayer) {
            this.selectedPiece = square;
            square.classList.add('selected');
            this.showValidMoves(row, col);
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
        if (targetPiece && targetPiece.dataset.color === this.currentPlayer) {
            return false;
        }

        // Movement rules for each piece type
        switch (pieceType) {
            case '🏹': // Archer
                // Store whether this is a capture move for later use in movePiece
                this.isArcherCapture = false;
                
                if (piece.dataset.color === 'black') {
                    if (fromCol === toCol && !targetPiece) { // Moving straight (no capture)
                        if (fromRow === 1 && toRow === 3) return true; // First move can be 2 squares
                        return toRow === fromRow + 1; // Regular move 1 square
                    } else if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + 1 && targetPiece) {
                        this.isArcherCapture = true; // Diagonal capture
                        return true;
                    }
                } else { // White archer
                    if (fromCol === toCol && !targetPiece) { // Moving straight (no capture)
                        if (fromRow === 8 && toRow === 6) return true; // First move can be 2 squares
                        return toRow === fromRow - 1; // Regular move 1 square
                    } else if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow - 1 && targetPiece) {
                        this.isArcherCapture = true; // Diagonal capture
                        return true;
                    }
                }
                return false;

            case '♟': // Black pawn
                if (fromCol === toCol) { // Moving straight
                    if (!targetPiece) { // No piece blocking
                        if (fromRow === 1 && toRow === 3) return true; // First move can be 2 squares
                        return toRow === fromRow + 1; // Regular move 1 square
                    }
                } else if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + 1) {
                    return targetPiece !== null; // Diagonal capture
                }
                return false;

            case '♙': // White pawn
                if (fromCol === toCol) { // Moving straight
                    if (!targetPiece) { // No piece blocking
                        if (fromRow === 8 && toRow === 6) return true; // First move can be 2 squares
                        return toRow === fromRow - 1; // Regular move 1 square
                    }
                } else if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow - 1) {
                    return targetPiece !== null; // Diagonal capture
                }
                return false;

            case '♜':
            case '♖': // Rook
                return (fromRow === toRow || fromCol === toCol) && 
                       this.isPathClear(fromRow, fromCol, toRow, toCol);

            case '♝':
            case '♗': // Bishop
                return (Math.abs(fromRow - toRow) === Math.abs(fromCol - toCol)) && 
                       this.isPathClear(fromRow, fromCol, toRow, toCol);

            case '♛':
            case '♕': // Queen
                return ((fromRow === toRow || fromCol === toCol) || 
                       (Math.abs(fromRow - toRow) === Math.abs(fromCol - toCol))) && 
                       this.isPathClear(fromRow, fromCol, toRow, toCol);

            case '♚':
            case '♔': // King
                return Math.abs(fromRow - toRow) <= 1 && Math.abs(fromCol - toCol) <= 1;

            case '♞':
            case '♘': // Knight
                return (Math.abs(fromRow - toRow) === 2 && Math.abs(fromCol - toCol) === 1) ||
                       (Math.abs(fromRow - toRow) === 1 && Math.abs(fromCol - toCol) === 2);

            case '🐉': // Wrath (dragon)
                // Can move 1 or 2 squares in any direction
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
                        
                        // Store information about the path for later use in movePiece
                        this.wrathPath = {
                            fromRow: fromRow,
                            fromCol: fromCol,
                            toRow: toRow,
                            toCol: toCol
                        };
                    }
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
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        const piece = fromSquare.querySelector('.piece');
        const pieceType = piece.textContent;
        
        // Special handling for archer capture
        if (pieceType === '🏹' && this.isArcherCapture) {
            // Remove the target piece (capture without moving)
            toSquare.removeChild(toSquare.querySelector('.piece'));
            this.isArcherCapture = false;
            return;
        }
        
        // Special handling for Wrath (dragon) movement
        if (pieceType === '🐉' && this.wrathPath) {
            const { fromRow, fromCol, toRow, toCol } = this.wrathPath;
            
            // Calculate the middle square for 2-square moves
            if (Math.abs(toRow - fromRow) === 2 || Math.abs(toCol - fromCol) === 2) {
                const midRow = Math.round((fromRow + toRow) / 2);
                const midCol = Math.round((fromCol + toCol) / 2);
                
                // Check if there's a piece in the middle square
                const midSquare = document.querySelector(`[data-row="${midRow}"][data-col="${midCol}"]`);
                const midPiece = midSquare.querySelector('.piece');
                
                // Capture the middle piece if it exists and isn't the player's own piece
                if (midPiece && midPiece.dataset.color !== this.currentPlayer) {
                    midSquare.removeChild(midPiece);
                }
            }
            
            this.wrathPath = null;
        }
        
        // Regular piece movement
        // Remove any piece at the destination (capture)
        if (toSquare.querySelector('.piece')) {
            toSquare.removeChild(toSquare.querySelector('.piece'));
        }
        
        // Move the piece
        fromSquare.removeChild(piece);
        toSquare.appendChild(piece);
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
        }
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

    findPieces(color) {
        const pieces = [];
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                const piece = square.querySelector('.piece');
                if (piece && piece.dataset.color === color) {
                    pieces.push({ row, col, square, piece });
                }
            }
        }
        return pieces;
    }

    findAllMoves(pieces) {
        const captureMoves = [];
        const normalMoves = [];
        
        for (const { row, col, square } of pieces) {
            this.selectedPiece = square;
            
            for (let toRow = 0; toRow < 10; toRow++) {
                for (let toCol = 0; toCol < 10; toCol++) {
                    if (this.isValidMove(toRow, toCol)) {
                        const targetSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
                        const targetPiece = targetSquare.querySelector('.piece');
                        
                        if (targetPiece) {
                            captureMoves.push({ fromRow: row, fromCol: col, toRow, toCol });
                        } else {
                            normalMoves.push({ fromRow: row, fromCol: col, toRow, toCol });
                        }
                    }
                }
            }
        }
        
        return { captureMoves, normalMoves };
    }

    findPiecesInDanger(color) {
        const piecesInDanger = [];
        const pieces = this.findPieces(color);
        const opponentColor = color === 'white' ? 'black' : 'white';
        const opponentPieces = this.findPieces(opponentColor);
        
        // For each of our pieces, check if any opponent piece can capture it
        for (const { row, col } of pieces) {
            for (const { square: opponentSquare } of opponentPieces) {
                const originalSelectedPiece = this.selectedPiece;
                this.selectedPiece = opponentSquare;
                
                if (this.isValidMove(row, col)) {
                    piecesInDanger.push({ row, col });
                    break; // No need to check other opponent pieces
                }
                
                this.selectedPiece = originalSelectedPiece;
            }
        }
        
        return piecesInDanger;
    }

    wouldPieceBeInDanger(fromRow, fromCol, toRow, toCol) {
        // Temporarily move the piece to see if it would be in danger
        const fromSquare = document.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toSquare = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
        const piece = fromSquare.querySelector('.piece');
        const color = piece.dataset.color;
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        // Simulate the move
        const originalToContent = toSquare.innerHTML;
        const originalFromContent = fromSquare.innerHTML;
        
        toSquare.innerHTML = '';
        toSquare.appendChild(piece.cloneNode(true));
        fromSquare.innerHTML = '';
        
        // Check if any opponent piece can capture the moved piece
        const opponentPieces = this.findPieces(opponentColor);
        let inDanger = false;
        
        for (const { square: opponentSquare } of opponentPieces) {
            const originalSelectedPiece = this.selectedPiece;
            this.selectedPiece = opponentSquare;
            
            if (this.isValidMove(toRow, toCol)) {
                inDanger = true;
                this.selectedPiece = originalSelectedPiece;
                break;
            }
            
            this.selectedPiece = originalSelectedPiece;
        }
        
        // Restore the board
        fromSquare.innerHTML = originalFromContent;
        toSquare.innerHTML = originalToContent;
        
        return inDanger;
    }

    executeMove(move) {
        const fromSquare = document.querySelector(`[data-row="${move.fromRow}"][data-col="${move.fromCol}"]`);
        this.selectedPiece = fromSquare;
        this.movePiece(move.toRow, move.toCol);
        
        // Update turn
        this.selectedPiece = null;
        this.currentPlayer = 'white';
        document.getElementById('current-turn').textContent = 'White';
    }
} 