// Load the game code into the global scope
const fs = require('fs');
const path = require('path');

// Create a mock window object
global.window = global;
global.document = {
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn().mockReturnValue([]),
  createElement: jest.fn().mockReturnValue({
    classList: { add: jest.fn() },
    appendChild: jest.fn()
  })
};

// Mock other browser objects
global.alert = jest.fn();
global.setTimeout = jest.fn();

// Define ChessGame class for testing
global.ChessGame = class ChessGame {
  constructor(boardState = null) {
    this.board = [];
    this.currentPlayer = 'white';
    this.selectedPiece = null;
    this.gameBoard = null;
    this.aiLevel = 0;
    this.gameMode = null;
    this.isArcherCapture = false;
    this.wrathPath = null;
  }

  createInitialBoard() {
    // Create a 10x10 board with empty spaces
    const board = Array(10).fill().map(() => Array(10).fill(''));
    
    // Black pieces (top row)
    board[0][0] = 'dragon-black';
    board[0][1] = '♜'; board[0][2] = '♞'; board[0][3] = '♝'; 
    board[0][4] = '♛'; board[0][5] = '♚';
    board[0][6] = '♝'; board[0][7] = '♞'; board[0][8] = '♜';
    board[0][9] = 'dragon-black';
    
    // Black pawns and archers (second row)
    board[1][0] = '♟'; board[1][1] = '♟'; board[1][2] = '♟'; board[1][3] = '♟';
    board[1][4] = '♟⇣'; board[1][5] = '♟⇣';
    board[1][6] = '♟'; board[1][7] = '♟'; board[1][8] = '♟'; board[1][9] = '♟';
    
    // White pawns and archers (ninth row)
    board[8][0] = '♙'; board[8][1] = '♙'; board[8][2] = '♙'; board[8][3] = '♙';
    board[8][4] = '♙⇡'; board[8][5] = '♙⇡';
    board[8][6] = '♙'; board[8][7] = '♙'; board[8][8] = '♙'; board[8][9] = '♙';
    
    // White pieces (bottom row)
    board[9][0] = 'dragon-white';
    board[9][1] = '♖'; board[9][2] = '♘'; board[9][3] = '♗'; 
    board[9][4] = '♕'; board[9][5] = '♔';
    board[9][6] = '♗'; board[9][7] = '♘'; board[9][8] = '♖';
    board[9][9] = 'dragon-white';
    
    return board;
  }

  // Mock methods for testing
  initializeBoard() { /* Mock implementation */ }
  selectPiece() { /* Mock implementation */ }
  showValidMoves() { /* Mock implementation */ }
  tryMove() { /* Mock implementation */ }
  isValidMove() { /* Mock implementation */ }
  movePiece() { /* Mock implementation */ }
  isKingInCheck() { /* Mock implementation */ }
  isCheckmate() { /* Mock implementation */ }
  makeAIMove() { /* Mock implementation */ }
  startGame(mode, aiLevel = 0) {
    this.gameMode = mode;
    this.aiLevel = aiLevel;
    this.currentPlayer = 'white';
  }
};

// Read the chess.js file
const chessCode = fs.readFileSync(path.resolve(__dirname, './chess.js'), 'utf8');

// Execute the code in the global scope
eval(chessCode); 