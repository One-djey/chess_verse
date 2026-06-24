import type { Piece, Position } from "../types/chess";
import { ChessAI } from "./ChessAI";
import { gameModes } from "../utils/gameModes";
import { getValidMoves } from "../utils/chess/moves";
import { getSmartFallbackMove } from "../utils/chess/aiFallback";

const ZOMBIE_DEPTH = 3;

const CLASSIC_MODE = gameModes.find((m) => m.id === "classic") ?? {
  id: "classic",
  title: "Classic",
  description: "",
  image: "",
  rules: {},
};

/**
 * A fixed pool of ChessAI workers used to calculate zombie moves in parallel.
 * Each worker handles one zombie piece's move independently.
 */
export class ZombieAIPool {
  private workers: ChessAI[];

  constructor(poolSize = 8) {
    this.workers = Array.from({ length: poolSize }, () => new ChessAI());
  }

  /**
   * Computes the best move for each zombie piece in parallel using Stockfish.
   * Returns a Map from piece.id to the chosen move.
   * Pieces with no legal moves or whose calculation fails are omitted from the result.
   */
  async getMovesForAllZombies(
    pieces: Piece[],
    zombiePieces: Piece[],
  ): Promise<Map<string, { from: Position; to: Position }>> {
    if (zombiePieces.length === 0) return new Map();

    const requests = zombiePieces.map((zombie, i) => {
      const worker = this.workers[i % this.workers.length];
      const legalDestinations = getValidMoves(zombie, pieces, CLASSIC_MODE);

      if (legalDestinations.length === 0) {
        return Promise.resolve<{ id: string; move: { from: Position; to: Position } | null }>({
          id: zombie.id,
          move: null,
        });
      }

      const searchMoves = legalDestinations.map((to) => ({
        from: zombie.position,
        to,
      }));

      return worker
        .getNextMove(pieces, undefined, undefined, {
          searchMoves,
          depth: ZOMBIE_DEPTH,
        })
        .then((move) => ({ id: zombie.id, move }))
        .catch(() => {
          // Stockfish can't evaluate positions without a black king (zombie horde).
          // Fall back to getSmartFallbackMove scoped to this zombie only.
          const fallback = getSmartFallbackMove(
            [...pieces.filter((p) => p.color === "white"), zombie],
            CLASSIC_MODE,
          );
          return { id: zombie.id, move: fallback };
        });
    });

    const results = await Promise.allSettled(requests);
    const moveMap = new Map<string, { from: Position; to: Position }>();

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.move !== null) {
        moveMap.set(result.value.id, result.value.move);
      }
    }

    return moveMap;
  }

  /** Terminates all workers. Call on component unmount. */
  destroy(): void {
    for (const worker of this.workers) {
      worker.destroy();
    }
  }

  /** Restarts all workers (e.g., after an engine crash). */
  restart(): void {
    for (const worker of this.workers) {
      worker.restart();
    }
  }
}
