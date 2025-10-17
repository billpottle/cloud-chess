const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'http://localhost'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

global.alert = jest.fn();
global.confirm = jest.fn(() => true);
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ success: true })
  })
);

class MockFormData {
  constructor() {
    this.fields = {};
  }

  append(key, value) {
    this.fields[key] = value;
  }
}

global.FormData = MockFormData;

const storage = {};
global.localStorage = {
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
  },
  setItem(key, value) {
    storage[key] = String(value);
  },
  removeItem(key) {
    delete storage[key];
  },
  clear() {
    Object.keys(storage).forEach((key) => delete storage[key]);
  }
};

const chessPath = path.resolve(__dirname, './chess.js');
const chessCode = fs.readFileSync(chessPath, 'utf8');
const scriptEl = document.createElement('script');
scriptEl.textContent = chessCode;
document.head.appendChild(scriptEl);

global.ChessGame = window.ChessGame;

beforeEach(() => {
  global.fetch.mockClear();
  global.localStorage.clear();
});
