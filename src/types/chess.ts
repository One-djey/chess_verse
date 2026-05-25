export type PieceType =
  | "pawn"
  | "rook"
  | "knight"
  | "bishop"
  | "queen"
  | "king";
export type PieceColor = "white" | "black";

export interface Piece {
  id: string;
  type: PieceType;
  color: PieceColor;
  position: Position;
  hasMoved?: boolean;
  /** Movement types acquired by capturing in Assimilation mode. */
  acquiredTypes?: PieceType[];
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
    assimilation?: boolean;
  };
}

/** A record of a single move, appended after each half-move. */
export interface MoveRecord {
  piece: Piece;
  from: Position;
  to: Position;
  capturedPiece: Piece | null;
  wasPromotion: boolean;
}

export interface GameState {
  pieces: Piece[];
  currentTurn: PieceColor;
  selectedPiece: Piece | null;
  validMoves: Position[];
  isCheck: boolean;
  startTime: number;
  moveCount: { white: number; black: number };
  /** Full move history — one entry per half-move (ply). */
  moves: MoveRecord[];
  gameOver: boolean;
  winner: PieceColor | null;
  drawReason?: "stalemate" | "only-kings";
  surrenderedBy?: PieceColor;
  gameMode: GameMode;
}

export interface CastlingMove {
  kingTarget: Position;
  rookTarget: Position;
  rook: Piece;
}
