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

describe('Battle chess captures', () => {
  let game;
  let board;

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="navbar"><a href="#"></a></div>
      <div id="current-turn"></div>
      <div id="game-status-message"></div>
      <div id="mode-selection"></div>
      <div id="game-board">
        <div id="board"></div>
        <section id="battle-panel" hidden>
          <span id="battle-round"></span>
          <div id="battle-attacker-name"></div>
          <div id="battle-defender-name"></div>
          <div><span id="battle-attacker-hp"></span></div>
          <div><span id="battle-defender-hp"></span></div>
          <div id="battle-attacker-stats"></div>
          <div id="battle-defender-stats"></div>
          <div id="battle-log"></div>
          <button type="button" class="battle-action" data-action="strike">Strike</button>
        </section>
      </div>
      <ol id="move-history-list"></ol>
    `;
    game = new ChessGame();
    game.startGame('pvc', 1, { battleMode: true, finishingMoves: true });
    board = document.getElementById('board');
    clearPieces(board);
    placePiece(board, 9, 5, { type: 'king', color: 'white', symbol: '♔' });
    placePiece(board, 0, 5, { type: 'king', color: 'black', symbol: '♚' });
    placePiece(board, 4, 4, { type: 'pawn', color: 'white', symbol: '♙' });
    placePiece(board, 3, 5, { type: 'pawn', color: 'black', symbol: '♟' });
  });

  test('player capture starts a battle before moving the piece', () => {
    game.selectPiece(board.querySelector('[data-row="4"][data-col="4"]'));

    game.tryMove(3, 5);

    expect(game.activeBattle).toMatchObject({
      fromRow: 4,
      fromCol: 4,
      toRow: 3,
      toCol: 5,
      attackerName: 'White Pawn',
      defenderName: 'Black Pawn'
    });
    expect(game.activeBattle).toMatchObject({
      attackerAttack: 3,
      attackerBonusPercent: 50,
      attackerMaxHp: 12,
      defenderMaxHp: 13,
      finishingMoves: true
    });
    expect(document.getElementById('battle-panel').hidden).toBe(false);
    expect(board.querySelector('[data-row="4"][data-col="4"] .piece')?.dataset.color).toBe('white');
    expect(board.querySelector('[data-row="3"][data-col="5"] .piece')?.dataset.color).toBe('black');
    expect(game.currentPlayer).toBe('white');
  });

  test('defender victory removes the attacking piece', () => {
    game.selectPiece(board.querySelector('[data-row="4"][data-col="4"]'));
    game.tryMove(3, 5);
    game.aiLevel = 0;

    game.finishBattle(false);

    expect(board.querySelector('[data-row="4"][data-col="4"] .piece')).toBeNull();
    expect(board.querySelector('[data-row="3"][data-col="5"] .piece')?.dataset.color).toBe('black');
    expect(game.capturedPieces.black).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'pawn', color: 'white' })])
    );
    expect(game.scores.black).toBe(1);
    expect(game.activeBattle).toBeNull();
  });

  test('computer capture starts a player-defense battle', () => {
    game.currentPlayer = 'black';

    const result = game.executeMove({
      fromRow: 3,
      fromCol: 5,
      toRow: 4,
      toCol: 4
    });

    expect(result).toBe('battle');
    expect(game.activeBattle).toMatchObject({
      fromRow: 3,
      fromCol: 5,
      toRow: 4,
      toCol: 4,
      humanSide: 'defender',
      aiSide: 'attacker',
      attackerName: 'Black Pawn',
      defenderName: 'White Pawn'
    });
    expect(document.getElementById('battle-panel').hidden).toBe(false);
    expect(board.querySelector('[data-row="3"][data-col="5"] .piece')?.dataset.color).toBe('black');
    expect(board.querySelector('[data-row="4"][data-col="4"] .piece')?.dataset.color).toBe('white');
  });
});
