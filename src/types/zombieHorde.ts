import type { Piece, PieceType, Position } from "./chess";

export interface ZombieWaveState {
  currentWave: number;
  zombiesKilled: number;
  playerMovesSinceLastSpawn: number;
  isZombiesThinking: boolean;
}

export interface ZombieHordeState {
  pieces: Piece[];
  selectedPiece: Piece | null;
  validMoves: Position[];
  isCheck: boolean;
  gameOver: boolean;
  /** "white" = player wins, "zombie" = horde wins, null = in progress */
  winner: "white" | "zombie" | null;
  wave: ZombieWaveState;
  pendingPromotion: { piece: Piece; to: Position } | null;
  startTime: number;
  firstMoveTime: number | null;
  moveCount: number;
}

export interface PendingZombiePromotion {
  piece: Piece;
  to: Position;
  promotionType: PieceType;
}
