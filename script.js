const UNICODE_PIECES = {
  'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
  'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};

const PIECE_VALUES = {
  'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0,
  'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0
};

const BOTS_CONFIG = {
  200: { name: "Noob Bot", rating: 200, avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Iniciante" },
  600: { name: "Aprendiz Bot", rating: 600, avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Aprendiz" },
  1000: { name: "Estrategista Bot", rating: 1000, avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Estrategista" },
  1500: { name: "Mestre CP67", rating: 1500, avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Mestre" }
};

const initialBoard = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', ''],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

let board, turn, selectedCell, validMoves, capturedPieces, isGameOver;
let gameMode = 'pvp';
let currentBotRating = null;

// Controle de estado para Roque
let movedState = {
  whiteKing: false, blackKing: false,
  whiteRookA: false, whiteRookH: false,
  blackRookA: false, blackRookH: false
};

// Histórico de partida para revisão
let gameHistory = [];
let reviewIndex = 0;
let isReviewMode = false;

const boardElement = document.getElementById('board');
const piecesLayerElement = document.getElementById('pieces-layer');
const statusElement = document.getElementById('status');
const modalElement = document.getElementById('game-over-modal');
const winnerMessage = document.getElementById('winner-message');
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const botDisplayInfo = document.getElementById('bot-display-info');

// Elementos de Revisão
const reviewControls = document.getElementById('review-controls');
const analysisBox = document.getElementById('analysis-box');
const evaluationTag = document.getElementById('analysis-evaluation');
const moveCounter = document.getElementById('move-counter');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

function selectGameMode(mode, botRating = null) {
  gameMode = mode;
  currentBotRating = botRating;
  menuScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  if (mode === 'bot') {
    const bot = BOTS_CONFIG[botRating];
    botDisplayInfo.classList.remove('hidden');
    botDisplayInfo.innerHTML = `
      <img src="${bot.avatar}" alt="${bot.name}">
      <span>${bot.name} (${bot.rating})</span>
    `;
    document.getElementById('black-label').textContent = bot.name;
  } else {
    botDisplayInfo.classList.add('hidden');
    document.getElementById('black-label').textContent = "Pretas";
  }

  resetGame();
}

function showMenu() {
  modalElement.classList.add('hidden');
  gameScreen.classList.add('hidden');
  menuScreen.classList.remove('hidden');
  statusElement.textContent = "Escolha um modo de jogo";
}

function resetGame() {
  board = JSON.parse(JSON.stringify(initialBoard));
  turn = 'white';
  selectedCell = null;
  validMoves = [];
  capturedPieces = { white: [], black: [] };
  isGameOver = false;
  isReviewMode = false;
  gameHistory = [];
  reviewIndex = 0;

  movedState = {
    whiteKing: false, blackKing: false,
    whiteRookA: false, whiteRookH: false,
    blackRookA: false, blackRookH: false
  };

  reviewControls.classList.add('hidden');
  analysisBox.classList.add('hidden');
  modalElement.classList.add('hidden');
  statusElement.textContent = 'Vez das Brancas';

  saveGameState(null);
  renderBoard();
}

function saveGameState(lastMoveDetails) {
  gameHistory.push({
    board: JSON.parse(JSON.stringify(board)),
    turn: turn,
    capturedPieces: JSON.parse(JSON.stringify(capturedPieces)),
    lastMove: lastMoveDetails
  });
}

function isWhite(piece) { return piece && piece === piece.toUpperCase(); }
function isBlack(piece) { return piece && piece === piece.toLowerCase(); }

function findKing(currentBoard, color) {
  const targetKing = color === 'white' ? 'K' : 'k';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (currentBoard[r][c] === targetKing) return { r, c };
    }
  }
  return null;
}

function isSquareAttacked(currentBoard, targetR, targetC, attackerColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = currentBoard[r][c];
      if (!piece) continue;
      if ((attackerColor === 'white' && isWhite(piece)) || (attackerColor === 'black' && isBlack(piece))) {
        const moves = getPseudoMoves(currentBoard, r, c);
        if (moves.some(m => m.r === targetR && m.c === targetC)) return true;
      }
    }
  }
  return false;
}

function isCheck(currentBoard, color) {
  const kingPos = findKing(currentBoard, color);
  if (!kingPos) return false;
  const enemyColor = color === 'white' ? 'black' : 'white';
  return isSquareAttacked(currentBoard, kingPos.r, kingPos.c, enemyColor);
}

function renderBoard() {
  boardElement.innerHTML = '';
  piecesLayerElement.innerHTML = '';
  
  const boardWrapper = document.querySelector('.board-wrapper');

  // Ativa a rotação no PVP se for a vez do jogador das pretas
  if (gameMode === 'pvp' && turn === 'black' && !isReviewMode) {
    boardWrapper.classList.add('rotate-black');
  } else {
    boardWrapper.classList.remove('rotate-black');
  }

  const inCheckColor = isCheck(board, turn) ? turn : null;
  const kingPosInCheck = inCheckColor ? findKing(board, inCheckColor) : null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = document.createElement('div');
      const isWhiteSquare = (r + c) % 2 === 0;
      square.className = `square ${isWhiteSquare ? 'white-sq' : 'black-sq'}`;

      if (!isReviewMode) {
        if (selectedCell && selectedCell.r === r && selectedCell.c === c) square.classList.add('selected');
        if (validMoves.some(m => m.r === r && m.c === c)) square.classList.add('valid-move');
      }
      if (kingPosInCheck && kingPosInCheck.r === r && kingPosInCheck.c === c) square.classList.add('in-check');

      square.addEventListener('click', () => handleCellClick(r, c));
      boardElement.appendChild(square);

      const piece = board[r][c];
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = `animated-piece ${isWhite(piece) ? 'piece-white' : 'piece-black'}`;
        pieceEl.textContent = UNICODE_PIECES[piece];
        pieceEl.style.left = `${c * 65}px`;
        pieceEl.style.top = `${r * 65}px`;

        pieceEl.addEventListener('click', (e) => {
          e.stopPropagation();
          handleCellClick(r, c);
        });

        piecesLayerElement.appendChild(pieceEl);
      }
    }
  }

  updateCapturesUI();
}

function handleCellClick(r, c) {
  if (isGameOver || isReviewMode || (gameMode === 'bot' && turn === 'black')) return;
  const piece = board[r][c];

  if (selectedCell) {
    const move = validMoves.find(m => m.r === r && m.c === c);
    if (move) {
      executeMove(selectedCell.r, selectedCell.c, r, c);
      selectedCell = null;
      validMoves = [];
      return;
    }
  }

  if (piece && ((turn === 'white' && isWhite(piece)) || (turn === 'black' && isBlack(piece)))) {
    selectedCell = { r, c };
    validMoves = getLegalMoves(r, c);
  } else {
    selectedCell = null;
    validMoves = [];
  }

  renderBoard();
}

function executeMove(fromR, fromC, toR, toC) {
  let piece = board[fromR][fromC];
  const targetPiece = board[toR][toC];

  if (targetPiece) {
    capturedPieces[turn].push(targetPiece);
  }

  // Roque
  if (piece.toLowerCase() === 'k' && Math.abs(toC - fromC) === 2) {
    if (toC === 6) { board[fromR][5] = board[fromR][7]; board[fromR][7] = ''; }
    else if (toC === 2) { board[fromR][3] = board[fromR][0]; board[fromR][0] = ''; }
  }

  if (piece === 'K') movedState.whiteKing = true;
  if (piece === 'k') movedState.blackKing = true;
  if (fromR === 7 && fromC === 0) movedState.whiteRookA = true;
  if (fromR === 7 && fromC === 7) movedState.whiteRookH = true;
  if (fromR === 0 && fromC === 0) movedState.blackRookA = true;
  if (fromR === 0 && fromC === 7) movedState.blackRookH = true;

  let isPromotion = false;
  if (piece.toLowerCase() === 'p' && (toR === 0 || toR === 7)) {
    piece = turn === 'white' ? 'Q' : 'q';
    isPromotion = true;
  }

  const animatedPieces = Array.from(piecesLayerElement.children);
  const movingPieceEl = animatedPieces.find(el => 
    parseInt(el.style.left) === fromC * 65 && parseInt(el.style.top) === fromR * 65
  );

  if (movingPieceEl) {
    movingPieceEl.style.left = `${toC * 65}px`;
    movingPieceEl.style.top = `${toR * 65}px`;
  }

  board[toR][toC] = piece;
  board[fromR][fromC] = '';

  const currentMoveDetails = {
    piece, targetPiece, fromR, fromC, toR, toC, isPromotion, playerTurn: turn
  };

  turn = turn === 'white' ? 'black' : 'white';
  saveGameState(currentMoveDetails);

  setTimeout(() => {
    if (!hasAnyLegalMoves(turn)) {
      isGameOver = true;
      if (isCheck(board, turn)) {
        const winner = turn === 'white' ? 'Pretas' : 'Brancas';
        winnerMessage.textContent = `Xeque-Mate! Vitória das ${winner}!`;
      } else {
        winnerMessage.textContent = 'Empate por Afogamento!';
      }
      modalElement.classList.remove('hidden');
    } else {
      statusElement.textContent = `Vez das ${turn === 'white' ? 'Brancas' : 'Pretas'}${isCheck(board, turn) ? ' (XEQUE!)' : ''}`;
    }

    renderBoard();

    if (gameMode === 'bot' && turn === 'black' && !isGameOver) {
      setTimeout(makeBotMove, 400);
    }
  }, 350);
}

/* Modo de Revisão */
function startReviewMode() {
  isReviewMode = true;
  modalElement.classList.add('hidden');
  reviewControls.classList.remove('hidden');
  analysisBox.classList.remove('hidden');
  statusElement.textContent = "Modo de Revisão da Partida";

  reviewIndex = gameHistory.length - 1;
  loadReviewState(reviewIndex);
}

function navigateHistory(direction) {
  const newIndex = reviewIndex + direction;
  if (newIndex >= 0 && newIndex < gameHistory.length) {
    reviewIndex = newIndex;
    loadReviewState(reviewIndex);
  }
}

function loadReviewState(index) {
  const state = gameHistory[index];
  board = JSON.parse(JSON.stringify(state.board));
  turn = state.turn;
  capturedPieces = JSON.parse(JSON.stringify(state.capturedPieces));

  moveCounter.textContent = `Lance: ${index} / ${gameHistory.length - 1}`;
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === gameHistory.length - 1;

  evaluateMoveWithBot(state.lastMove);
  renderBoard();
}

function evaluateMoveWithBot(move) {
  if (!move) {
    evaluationTag.textContent = "Início do Jogo";
    evaluationTag.className = "evaluation-tag eval-good";
    return;
  }

  const pieceVal = PIECE_VALUES[move.piece] || 0;
  const targetVal = move.targetPiece ? (PIECE_VALUES[move.targetPiece] || 0) : 0;
  const isOpponentInCheck = isCheck(board, turn);

  if ((isGameOver && reviewIndex === gameHistory.length - 1) || move.isPromotion) {
    evaluationTag.textContent = "💎 Genial";
    evaluationTag.className = "evaluation-tag eval-brilliant";
  } 
  else if (targetVal >= 3 || (isOpponentInCheck && targetVal > 0)) {
    evaluationTag.textContent = "🟢 Excelente";
    evaluationTag.className = "evaluation-tag eval-excellent";
  } 
  else if (targetVal > 0 || isOpponentInCheck) {
    evaluationTag.textContent = "🟡 Bom";
    evaluationTag.className = "evaluation-tag eval-good";
  } 
  else {
    const enemyColor = move.playerTurn === 'white' ? 'black' : 'white';
    const isAttacked = isSquareAttacked(board, move.toR, move.toC, enemyColor);

    if (isAttacked && pieceVal >= 3) {
      evaluationTag.textContent = "🔴 Péssimo";
      evaluationTag.className = "evaluation-tag eval-bad";
    } else {
      evaluationTag.textContent = "🟡 Bom";
      evaluationTag.className = "evaluation-tag eval-good";
    }
  }
}

function getLegalMoves(r, c) {
  const pseudoMoves = getPseudoMoves(board, r, c);
  const legalMoves = [];
  const currentPiece = board[r][c];
  const currentColor = isWhite(currentPiece) ? 'white' : 'black';

  pseudoMoves.forEach(move => {
    const target = board[move.r][move.c];
    if (target.toLowerCase() === 'k') return;

    board[move.r][move.c] = currentPiece;
    board[r][c] = '';

    if (!isCheck(board, currentColor)) {
      legalMoves.push(move);
    }

    board[r][c] = currentPiece;
    board[move.r][move.c] = target;
  });

  if (currentPiece.toLowerCase() === 'k') {
    const row = currentColor === 'white' ? 7 : 0;
    const kingMoved = currentColor === 'white' ? movedState.whiteKing : movedState.blackKing;
    const rookAMoved = currentColor === 'white' ? movedState.whiteRookA : movedState.blackRookA;
    const rookHMoved = currentColor === 'white' ? movedState.whiteRookH : movedState.blackRookH;
    const enemyColor = currentColor === 'white' ? 'black' : 'white';

    if (!kingMoved && !isCheck(board, currentColor) && r === row && c === 4) {
      if (!rookHMoved && board[row][5] === '' && board[row][6] === '') {
        if (!isSquareAttacked(board, row, 5, enemyColor) && !isSquareAttacked(board, row, 6, enemyColor)) {
          legalMoves.push({ r: row, c: 6 });
        }
      }
      if (!rookAMoved && board[row][1] === '' && board[row][2] === '' && board[row][3] === '') {
        if (!isSquareAttacked(board, row, 2, enemyColor) && !isSquareAttacked(board, row, 3, enemyColor)) {
          legalMoves.push({ r: row, c: 2 });
        }
      }
    }
  }

  return legalMoves;
}

function makeBotMove() {
  const allMoves = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isBlack(board[r][c])) {
        const moves = getLegalMoves(r, c);
        moves.forEach(m => allMoves.push({ fromR: r, fromC: c, toR: m.r, toC: m.c }));
      }
    }
  }

  if (allMoves.length === 0) return;

  let selectedMove;

  if (currentBotRating === 200) {
    selectedMove = allMoves[Math.floor(Math.random() * allMoves.length)];
  } 
  else if (currentBotRating === 600) {
    const captureMoves = allMoves.filter(m => board[m.toR][m.toC] !== '');
    if (captureMoves.length > 0 && Math.random() < 0.6) {
      selectedMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
    } else {
      selectedMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    }
  } 
  else if (currentBotRating === 1000) {
    let bestScore = -Infinity;
    let bestMoves = [];

    allMoves.forEach(m => {
      const target = board[m.toR][m.toC];
      let score = target ? PIECE_VALUES[target] * 10 : 0;
      if (board[m.fromR][m.fromC].toLowerCase() === 'k' && Math.abs(m.toC - m.fromC) === 2) score += 8;

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [m];
      } else if (score === bestScore) {
        bestMoves.push(m);
      }
    });

    selectedMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  } 
  else if (currentBotRating === 1500) {
    let bestScore = -Infinity;
    let bestMoves = [];

    allMoves.forEach(m => {
      let score = 0;
      const target = board[m.toR][m.toC];
      const piece = board[m.fromR][m.fromC];

      if (target) score += PIECE_VALUES[target] * 15;
      if ((m.toR === 3 || m.toR === 4) && (m.toC === 3 || m.toC === 4)) score += 4;
      if (piece.toLowerCase() === 'k' && Math.abs(m.toC - m.fromC) === 2) score += 12;

      board[m.toR][m.toC] = piece;
      board[m.fromR][m.fromC] = '';

      if (isCheck(board, 'white')) score += 6;
      if (!hasAnyLegalMoves('white') && isCheck(board, 'white')) score += 1000;

      board[m.fromR][m.fromC] = piece;
      board[m.toR][m.toC] = target;

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [m];
      } else if (score === bestScore) {
        bestMoves.push(m);
      }
    });

    selectedMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  executeMove(selectedMove.fromR, selectedMove.fromC, selectedMove.toR, selectedMove.toC);
}

function hasAnyLegalMoves(color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && ((color === 'white' && isWhite(piece)) || (color === 'black' && isBlack(piece)))) {
        if (getLegalMoves(r, c).length > 0) return true;
      }
    }
  }
  return false;
}

function getPseudoMoves(currentBoard, r, c) {
  const piece = currentBoard[r][c];
  if (!piece) return [];
  const moves = [];
  const isWhitePiece = isWhite(piece);
  const type = piece.toLowerCase();

  const addMove = (targetR, targetC) => {
    if (targetR < 0 || targetR > 7 || targetC < 0 || targetC > 7) return false;
    const targetPiece = currentBoard[targetR][targetC];
    if (!targetPiece) {
      moves.push({ r: targetR, c: targetC });
      return true;
    }
    if ((isWhitePiece && isBlack(targetPiece)) || (!isWhitePiece && isWhite(targetPiece))) {
      moves.push({ r: targetR, c: targetC });
    }
    return false;
  };

  if (type === 'p') {
    const dir = isWhitePiece ? -1 : 1;
    const startRow = isWhitePiece ? 6 : 1;
    if (r + dir >= 0 && r + dir <= 7 && !currentBoard[r + dir][c]) {
      moves.push({ r: r + dir, c });
      if (r === startRow && !currentBoard[r + (2 * dir)][c]) {
        moves.push({ r: r + (2 * dir), c });
      }
    }
    [-1, 1].forEach(dc => {
      const targetC = c + dc;
      const targetR = r + dir;
      if (targetR >= 0 && targetR <= 7 && targetC >= 0 && targetC <= 7) {
        const targetPiece = currentBoard[targetR][targetC];
        if (targetPiece && ((isWhitePiece && isBlack(targetPiece)) || (!isWhitePiece && isWhite(targetPiece)))) {
          moves.push({ r: targetR, c: targetC });
        }
      }
    });
  } else if (type === 'n') {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => addMove(r + dr, c + dc));
  } else if (type === 'k') {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr, dc]) => addMove(r + dr, c + dc));
  } else {
    const directions = [];
    if (type === 'r' || type === 'q') directions.push([-1,0], [1,0], [0,-1], [0,1]);
    if (type === 'b' || type === 'q') directions.push([-1,-1], [-1,1], [1,-1], [1,1]);

    directions.forEach(([dr, dc]) => {
      let step = 1;
      while (addMove(r + (dr * step), c + (dc * step))) step++;
    });
  }

  return moves;
}

function updateCapturesUI() {
  const whiteCapEl = document.getElementById('captured-by-white');
  const blackCapEl = document.getElementById('captured-by-black');
  const advWhiteEl = document.getElementById('adv-white');
  const advBlackEl = document.getElementById('adv-black');

  whiteCapEl.innerHTML = ''; blackCapEl.innerHTML = '';
  let whiteScore = 0, blackScore = 0;

  capturedPieces.white.forEach(p => {
    whiteScore += PIECE_VALUES[p];
    const span = document.createElement('span');
    span.textContent = UNICODE_PIECES[p];
    span.className = 'piece-black';
    whiteCapEl.appendChild(span);
  });

  capturedPieces.black.forEach(p => {
    blackScore += PIECE_VALUES[p];
    const span = document.createElement('span');
    span.textContent = UNICODE_PIECES[p];
    span.className = 'piece-white';
    blackCapEl.appendChild(span);
  });

  if (whiteScore > blackScore) {
    advWhiteEl.textContent = `+${whiteScore - blackScore}`;
    advBlackEl.textContent = '';
  } else if (blackScore > whiteScore) {
    advBlackEl.textContent = `+${blackScore - whiteScore}`;
    advWhiteEl.textContent = '';
  } else {
    advWhiteEl.textContent = '';
    advBlackEl.textContent = '';
  }
}