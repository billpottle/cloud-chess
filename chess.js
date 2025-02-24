class ChessGame {
    constructor() {
        this.board = document.getElementById('board');
        this.currentPlayer = 'white';
        this.selectedPiece = null;
        this.gameBoard = this.createInitialBoard();
        this.initializeBoard();
    }

    createInitialBoard() {
        // Create a 10x10 board with empty spaces
        const board = Array(10).fill().map(() => Array(10).fill(''));
        
        // Black pieces (top row)
        board[0][1] = '♜'; board[0][2] = '♞'; board[0][3] = '♝'; board[0][4] = '♛';
        board[0][5] = '♚'; board[0][6] = '♝'; board[0][7] = '♞'; board[0][8] = '♜';
        
        // Black pawns (second row)
        for (let col = 1; col <= 8; col++) {
            board[1][col] = '♟';
        }
        
        // White pawns (second-to-last row)
        for (let col = 1; col <= 8; col++) {
            board[8][col] = '♙';
        }
        
        // White pieces (bottom row)
        board[9][1] = '♖'; board[9][2] = '♘'; board[9][3] = '♗'; board[9][4] = '♕';
        board[9][5] = '♔'; board[9][6] = '♗'; board[9][7] = '♘'; board[9][8] = '♖';
        
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
        
        // Remove any piece at the destination (capture)
        if (toSquare.querySelector('.piece')) {
            toSquare.removeChild(toSquare.querySelector('.piece'));
        }
        
        // Move the piece
        fromSquare.removeChild(piece);
        toSquare.appendChild(piece);
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    new ChessGame();
}); 