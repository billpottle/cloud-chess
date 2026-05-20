const fs = require('fs');
const path = require('path');

function loadMultiplayerScript() {
  const multiplayerPath = path.resolve(__dirname, '../js/multiplayer.js');
  const multiplayerCode = fs.readFileSync(multiplayerPath, 'utf8');
  const scriptEl = document.createElement('script');
  scriptEl.textContent = multiplayerCode;
  document.head.appendChild(scriptEl);
}

function buildGameDom() {
  document.body.innerHTML = `
    <div id="current-turn"></div>
    <div id="last-move-inline-white"></div>
    <div id="last-move-inline-black"></div>
    <div id="white-score"></div>
    <div id="black-score"></div>
    <div id="white-graveyard"></div>
    <div id="black-graveyard"></div>
    <div id="board"></div>
  `;
}

function boardStateWithout(...removedSquares) {
  const game = new ChessGame();
  return game.createInitialBoard().flatMap((row, rowIndex) =>
    row.flatMap((symbol, colIndex) => {
      if (!symbol || removedSquares.some(([row, col]) => row === rowIndex && col === colIndex)) {
        return [];
      }

      const symbolMap = {
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

      return [{ row: rowIndex, col: colIndex, ...symbolMap[symbol] }];
    })
  );
}

describe('multiplayer capture display', () => {
  beforeAll(() => {
    loadMultiplayerScript();
  });

  beforeEach(() => {
    buildGameDom();
  });

  test('reconstructs graveyards and scores from server board state', () => {
    const boardState = boardStateWithout(
      [0, 4], // black queen
      [8, 4]  // white archer
    );

    window.initializeMultiplayerGame(13, 'white', 'white', boardState, false);

    const whiteCaptures = document.getElementById('white-graveyard');
    const blackCaptures = document.getElementById('black-graveyard');

    expect(whiteCaptures.querySelector('[data-type="queen"][data-color="black"]')).not.toBeNull();
    expect(blackCaptures.querySelector('[data-type="archer"][data-color="white"]')).not.toBeNull();
    expect(document.getElementById('white-score').textContent).toBe('9');
    expect(document.getElementById('black-score').textContent).toBe('3');
  });
});
