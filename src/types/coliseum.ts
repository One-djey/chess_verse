import type { Piece, MoveRecord, Position } from "./chess";

export type ArenaPieceType =
  | "king"
  | "queen"
  | "rook"
  | "bishop"
  | "knight"
  | "pawn";

export interface ArenaPiece {
  y: number;
  x: number;
  piece: ArenaPieceType;
  player: number; // 0-indexed
}

export interface Arena {
  grid: number[][]; // 0 = void, 1 = playable
  spawnZones: [number, number][]; // [y, x] per player
  pieces: ArenaPiece[];
  totalCells: number;
  freeCells: number;
  attempts: number;
  elapsed: number;
  fallback: boolean;
  seed: number;
}

export interface ColiseumGameState {
  arena: Arena;
  pieces: Piece[];
  currentTurn: "white" | "black";
  selectedPiece: Piece | null;
  validMoves: Position[];
  isCheck: boolean;
  gameOver: boolean;
  winner: "white" | "black" | null;
  surrenderedBy?: "white" | "black";
  moveCount: { white: number; black: number };
  moves: MoveRecord[];
}
