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
    coliseum?: boolean;
    zombieHorde?: boolean;
  };
  /** Piece and board skins automatically applied when playing this mode. */
  forcedSkins?: {
    pieces: string;
    board: string;
  };
}

/** A record of a single move, appended after each half-move. */
export interface MoveRecord {
  piece: Piece;
  from: Position;
  to: Position;
  capturedPiece: Piece | null;
  wasPromotion: boolean;
  /** True when the move was an en passant capture (pawn captures diagonally on empty ep-target square). */
  isEnPassant?: boolean;
}

export interface GameState {
  pieces: Piece[];
  currentTurn: PieceColor;
  selectedPiece: Piece | null;
  validMoves: Position[];
  isCheck: boolean;
  startTime: number;
  /** Timestamp of the first move played; undefined until a move is made. */
  firstMoveTime?: number;
  moveCount: { white: number; black: number };
  /** Full move history — one entry per half-move (ply). */
  moves: MoveRecord[];
  gameOver: boolean;
  winner: PieceColor | null;
  drawReason?: "stalemate" | "only-kings" | "repetition" | "fifty-moves";
  surrenderedBy?: PieceColor;
  gameMode: GameMode;
  /** Square where an en passant capture can land (the square skipped by the double pawn push). */
  enPassantTarget?: Position;
  /** Half-move clock for the 50-move rule; resets on pawn move or capture. */
  halfMoveClock?: number;
  /** Position hash → occurrence count, for triple-repetition draw detection. */
  positionHistory?: Record<string, number>;
}

export interface CastlingMove {
  kingTarget: Position;
  rookTarget: Position;
  rook: Piece;
}
