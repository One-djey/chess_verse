export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type PieceColor = 'white' | 'black';

export interface Piece {
  id: string;
  type: PieceType;
  color: PieceColor;
  position: Position;
  hasMoved?: boolean;
}

export interface Position {
  x: number;
  y: number;
}

export interface GameMode {
  id: string;
  title: string;
  description: string;
  image: string;
  rules?: {
    borderless?: boolean;
    randomPieces?: boolean;
  };
}

export interface GameState {
  pieces: Piece[];
  currentTurn: PieceColor;
  selectedPiece: Piece | null;
  validMoves: Position[];
  isCheck: boolean;
  startTime: number;
  moveCount: { white: number; black: number };
  gameOver: boolean;
  winner: PieceColor | null;
  gameMode: GameMode;
}

export interface CastlingMove {
  kingTarget: Position;
  rookTarget: Position;
  rook: Piece;
}