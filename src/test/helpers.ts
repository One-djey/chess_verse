import type {
  GameMode,
  GameState,
  Piece,
  PieceColor,
  PieceType,
  Position,
} from "../types/chess";
import { makeInitialState } from "../hooks/useChessGame";

/** Modes de jeu minimaux pour les tests (les champs visuels sont vides). */
function mode(id: string, rules?: GameMode["rules"]): GameMode {
  return { id, title: id, description: "", image: "", rules };
}

export const CLASSIC = mode("classic");
export const BORDERLESS = mode("borderless", { borderless: true });
export const ALL_RANDOM = mode("all-random", { randomPieces: true });
export const ASSIMILATION = mode("assimilation", { assimilation: true });

let nextId = 0;

/** Crée une pièce de test avec un id unique auto-généré. */
export function makePiece(
  color: PieceColor,
  type: PieceType,
  x: number,
  y: number,
  opts: Partial<Pick<Piece, "id" | "hasMoved" | "acquiredTypes">> = {},
): Piece {
  return {
    id: opts.id ?? `test-${color}-${type}-${nextId++}`,
    type,
    color,
    position: { x, y },
    ...(opts.hasMoved !== undefined && { hasMoved: opts.hasMoved }),
    ...(opts.acquiredTypes && { acquiredTypes: opts.acquiredTypes }),
  };
}

/** Construit un GameState prêt à jouer à partir d'une liste de pièces. */
export function makeState(
  pieces: Piece[],
  gameMode: GameMode = CLASSIC,
  overrides: Partial<GameState> = {},
): GameState {
  return { ...makeInitialState(pieces, gameMode), ...overrides };
}

/** Raccourci position. */
export function pos(x: number, y: number): Position {
  return { x, y };
}

/** Vrai si la liste de coups contient la position donnée. */
export function includesPos(moves: Position[], x: number, y: number): boolean {
  return moves.some((m) => m.x === x && m.y === y);
}
