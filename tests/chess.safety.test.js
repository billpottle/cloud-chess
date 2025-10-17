const BOARD_SIZE = 10;

function buildBoard() {
  document.body.innerHTML = '<div id="board"></div>';
  const board = document.getElementById('board');

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const square = document.createElement('div');
      square.className = 'square';
      square.dataset.row = String(row);
      square.dataset.col = String(col);
      board.appendChild(square);
    }
  }

  return board;
}

function placePiece(board, row, col, { type, color, symbol }) {
  const square = board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  square.innerHTML = '';
  const piece = document.createElement('div');
  piece.className = 'piece';
  if (type) {
    piece.dataset.type = type;
  }
  if (color) {
    piece.dataset.color = color;
  }
  if (symbol !== undefined) {
    piece.textContent = symbol;
  }
  square.appendChild(piece);
  return piece;
}

function clearPieces(board) {
  board.querySelectorAll('.square').forEach((square) => {
    square.innerHTML = '';
  });
}

describe('ChessGame threat detection helpers', () => {
  let game;
  let board;

  beforeEach(() => {
    board = buildBoard();
    game = new ChessGame();
    game.board = board;
    clearPieces(board);
  });

  test('findPiecesInDanger identifies linear threats', () => {
    placePiece(board, 4, 4, { type: 'bishop', color: 'white', symbol: '♗' });
    placePiece(board, 4, 7, { type: 'rook', color: 'black', symbol: '♜' });
    placePiece(board, 0, 0, { type: 'rook', color: 'white', symbol: '♖' }); // safe piece

    const threatened = game.findPiecesInDanger('white');

    expect(threatened).toEqual(
      expect.arrayContaining([{ row: 4, col: 4 }])
    );
    expect(threatened).not.toEqual(
      expect.arrayContaining([{ row: 0, col: 0 }])
    );
  });

  test('wouldPieceBeInDanger detects risky rook move', () => {
    placePiece(board, 4, 4, { type: 'rook', color: 'white', symbol: '♖' });
    placePiece(board, 4, 7, { type: 'rook', color: 'black', symbol: '♜' });

    const result = game.wouldPieceBeInDanger(4, 4, 4, 5);
    expect(result).toBe(true);
  });

  test('wouldPieceBeInDanger handles dragon leap captures', () => {
    placePiece(board, 4, 4, { type: 'dragon', color: 'white' });
    placePiece(board, 4, 5, { type: 'pawn', color: 'black', symbol: '♟' }); // mid piece
    placePiece(board, 4, 6, { type: 'rook', color: 'black', symbol: '♜' });

    const result = game.wouldPieceBeInDanger(4, 4, 4, 6);
    expect(result).toBe(false);
  });

  test('wouldPieceBeInDanger respects archer capture without moving', () => {
    placePiece(board, 6, 5, { type: 'archer', color: 'white', symbol: '♙⇡' });
    placePiece(board, 6, 4, { type: 'pawn', color: 'black', symbol: '♟' });
    placePiece(board, 0, 5, { type: 'rook', color: 'black', symbol: '♜' });

    game.isArcherCapture = true;
    const result = game.wouldPieceBeInDanger(6, 5, 6, 4);
    expect(result).toBe(true);
  });

  test('getBoardSnapshot captures dataset metadata', () => {
    placePiece(board, 2, 2, { type: 'knight', color: 'white', symbol: '♘' });
    placePiece(board, 7, 7, { type: 'queen', color: 'black', symbol: '♛' });

    const snapshot = game.getBoardSnapshot();
    expect(snapshot[2][2]).toMatchObject({ type: 'knight', color: 'white' });
    expect(snapshot[7][7]).toMatchObject({ type: 'queen', color: 'black' });
  });
});
