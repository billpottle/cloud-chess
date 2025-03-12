/**
 * Chess Game Test Suite - Simplified Version
 */

describe('ChessGame Basic Tests', () => {
  let game;
  
  beforeEach(() => {
    // Create a new game instance
    game = new ChessGame();
  });
  
  test('should create initial board correctly', () => {
    const board = game.createInitialBoard();
    
    // Check board dimensions
    expect(board.length).toBe(10);
    expect(board[0].length).toBe(10);
    
    // Check specific pieces
    expect(board[0][5]).toBe('♚'); // Black king
    expect(board[9][5]).toBe('♔'); // White king
    expect(board[1][4]).toBe('♟⇣'); // Black archer
    expect(board[8][4]).toBe('♙⇡'); // White archer
    expect(board[0][0]).toBe('dragon-black'); // Black dragon
    expect(board[9][9]).toBe('dragon-white'); // White dragon
  });
  
  test('should initialize game with correct default values', () => {
    expect(game.currentPlayer).toBe('white');
    expect(game.selectedPiece).toBeNull();
    expect(game.aiLevel).toBe(0);
    expect(game.gameMode).toBeNull();
  });
  
  test('should start a new PvP game with correct settings', () => {
    game.startGame('pvp');
    
    expect(game.gameMode).toBe('pvp');
    expect(game.aiLevel).toBe(0);
    expect(game.currentPlayer).toBe('white');
  });
  
  test('should start a new PvC game with correct AI level', () => {
    game.startGame('pvc', 2);
    
    expect(game.gameMode).toBe('pvc');
    expect(game.aiLevel).toBe(2);
    expect(game.currentPlayer).toBe('white');
  });
}); 