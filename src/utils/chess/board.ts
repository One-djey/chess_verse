import { Piece, PieceType, PieceColor, Position, GameMode } from '../../types/chess';

export const BOARD_SIZE = 8;

export const UNICODE_PIECES: Record<PieceColor, Record<PieceType, string>> = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

export const getDifficultyDescription = (level: number, withElo = false): string => {
  const labels = [
    'Beginner', 'Beginner',
    'Club Beginner', 'Club Beginner',
    'Intermediate Club Player', 'Intermediate Club Player',
    'Advanced Club Player', 'Advanced Club Player',
    'Candidate Master', 'Candidate Master',
    'FIDE Master', 'FIDE Master',
    'International Master', 'International Master',
    'Grandmaster', 'Grandmaster',
    'Super Grandmaster', 'Super Grandmaster',
    'Superhuman', 'Superhuman',
  ];
  const description = labels[level - 1];
  return withElo ? `${description} (Elo ~${1000 + level * 100})` : description;
};

// ── Standard layout ──────────────────────────────────────────────────────────

const BACK_ROW: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

function buildStandardPieces(): Piece[] {
  const pieces: Piece[] = [];
  (['white', 'black'] as PieceColor[]).forEach((color) => {
    const backY = color === 'white' ? 7 : 0;
    const pawnY = color === 'white' ? 6 : 1;
    const prefix = color[0];
    BACK_ROW.forEach((type, x) => {
      pieces.push({ id: `${prefix}${type[0]}${x}`, type, color, position: { x, y: backY }, hasMoved: false });
    });
    for (let x = 0; x < BOARD_SIZE; x++) {
      pieces.push({ id: `${prefix}p${x}`, type: 'pawn', color, position: { x, y: pawnY } });
    }
  });
  return pieces;
}

// ── Random layout ────────────────────────────────────────────────────────────

const PIECE_POOL_WEIGHTS: { type: PieceType; weight: number }[] = [
  { type: 'pawn', weight: 8 },
  { type: 'rook', weight: 2 },
  { type: 'knight', weight: 2 },
  { type: 'bishop', weight: 2 },
  { type: 'queen', weight: 1 },
];
const TOTAL_WEIGHT = PIECE_POOL_WEIGHTS.reduce((s, p) => s + p.weight, 0);

function pickRandomType(): PieceType {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const { type, weight } of PIECE_POOL_WEIGHTS) {
    r -= weight;
    if (r <= 0) return type;
  }
  return 'pawn';
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildRandomPieces(): Piece[] {
  const pieces: Piece[] = [];
  (['white', 'black'] as PieceColor[]).forEach((color) => {
    const backY = color === 'white' ? 7 : 0;
    const pawnY = color === 'white' ? 6 : 1;
    const prefix = color[0];
    let idx = 0;

    // King always at x=4
    pieces.push({ id: `${prefix}k0`, type: 'king', color, position: { x: 4, y: backY }, hasMoved: false });

    const positions: Position[] = shuffle([
      ...[0, 1, 2, 3, 5, 6, 7].map((x) => ({ x, y: backY })),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((x) => ({ x, y: pawnY })),
    ]);

    for (const pos of positions) {
      const type = pickRandomType();
      pieces.push({ id: `${prefix}${type[0]}${idx++}`, type, color, position: pos, hasMoved: false });
    }
  });
  return pieces;
}

// ── Public API ───────────────────────────────────────────────────────────────

export const getInitialPieces = (gameMode: GameMode): Piece[] =>
  gameMode.rules?.randomPieces ? buildRandomPieces() : buildStandardPieces();

/** Convenience: classic board — used as a fallback reference */
export const initialPieces: Piece[] = buildStandardPieces();
