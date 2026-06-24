import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZombieAIPool } from "./ZombieAIPool";
import { makePiece } from "../test/helpers";
import type { Piece } from "../types/chess";

// ── MockWorker (same pattern as ChessAI.test.ts) ─────────────────────────────

class MockWorker {
  static instances: MockWorker[] = [];
  url: string;
  posted: string[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    MockWorker.instances.push(this);
  }

  postMessage(message: string) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }
}

function emit(worker: MockWorker, data: string) {
  worker.onmessage?.({ data } as MessageEvent);
}

function handshake(worker: MockWorker) {
  emit(worker, "uciok");
  emit(worker, "readyok");
}

beforeEach(() => {
  MockWorker.instances = [];
  vi.stubGlobal("Worker", MockWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function readyPool(size = 2): ZombieAIPool {
  const pool = new ZombieAIPool(size);
  for (const worker of MockWorker.instances) {
    handshake(worker);
  }
  return pool;
}

/** White king + standard white pieces setup for attack-checking in getValidMoves */
function whiteKingOnly(): Piece[] {
  return [makePiece("white", "king", 4, 7)];
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe("ZombieAIPool constructor", () => {
  it("creates exactly poolSize ChessAI workers", () => {
    new ZombieAIPool(3);
    expect(MockWorker.instances).toHaveLength(3);
  });

  it("defaults to 8 workers", () => {
    new ZombieAIPool();
    expect(MockWorker.instances).toHaveLength(8);
  });
});

// ── destroy / restart ─────────────────────────────────────────────────────────

describe("destroy and restart", () => {
  it("destroy() terminates all workers", () => {
    const pool = new ZombieAIPool(3);
    pool.destroy();
    expect(MockWorker.instances.every((w) => w.terminated)).toBe(true);
  });

  it("restart() creates new workers after terminating old ones", () => {
    const pool = new ZombieAIPool(2);
    const originals = [...MockWorker.instances];
    pool.restart();
    expect(originals.every((w) => w.terminated)).toBe(true);
    expect(MockWorker.instances).toHaveLength(4); // 2 old + 2 new
  });
});

// ── getMovesForAllZombies ─────────────────────────────────────────────────────

describe("getMovesForAllZombies", () => {
  it("returns empty Map when zombiePieces is empty", async () => {
    const pool = readyPool(2);
    const result = await pool.getMovesForAllZombies(whiteKingOnly(), []);
    expect(result.size).toBe(0);
  });

  it("skips zombies with no legal moves", async () => {
    const pool = readyPool(2);
    // A black pawn at y=7 (rank 1) has no valid moves downward (off board)
    // and no forward since y increases downward in our coord system.
    // Actually black pawns move DOWN (y increases). A pawn at y=7 has no moves.
    const blockedPawn = makePiece("black", "pawn", 4, 7, { id: "zh-blocked" });
    const whiteKing = makePiece("white", "king", 0, 7);
    // white king blocks e8 (4,7) area — pawn at y=7 can't move forward
    const result = await pool.getMovesForAllZombies(
      [whiteKing, blockedPawn],
      [blockedPawn],
    );
    expect(result.has("zh-blocked")).toBe(false);
  });

  it("distributes zombies round-robin across workers", async () => {
    const pool = readyPool(2);
    const pawn1 = makePiece("black", "pawn", 2, 1, { id: "zh0" });
    const pawn2 = makePiece("black", "pawn", 5, 1, { id: "zh1" });
    const pieces = [makePiece("white", "king", 4, 7), pawn1, pawn2];

    // Start both requests; they will be pending until we emit bestmove
    const movePromise = pool.getMovesForAllZombies(pieces, [pawn1, pawn2]);

    // Worker 0 handles pawn1, worker 1 handles pawn2
    const [w0, w1] = MockWorker.instances;
    emit(w0, "bestmove c7c6"); // pawn1: c7c6 = (2,1)→(2,2)
    emit(w1, "bestmove f7f6"); // pawn2: f7f6 = (5,1)→(5,2)

    const result = await movePromise;
    expect(result.has("zh0")).toBe(true);
    expect(result.has("zh1")).toBe(true);
  });

  it("uses getSmartFallbackMove when Stockfish rejects (partial failure)", async () => {
    // When Stockfish returns (none) for pawn1, the fallback picks a legal move for it.
    // pawn2 gets a normal bestmove response.
    const pool = readyPool(2);
    const pawn1 = makePiece("black", "pawn", 2, 1, { id: "zh0" });
    const pawn2 = makePiece("black", "pawn", 5, 1, { id: "zh1" });
    const pieces = [makePiece("white", "king", 4, 7), pawn1, pawn2];

    const movePromise = pool.getMovesForAllZombies(pieces, [pawn1, pawn2]);

    const [w0, w1] = MockWorker.instances;
    emit(w0, "bestmove (none)"); // pawn1: Stockfish fails → fallback used
    emit(w1, "bestmove f7f6");   // pawn2: succeeds normally

    const result = await movePromise;
    // pawn1 gets a fallback move (it has legal destinations: c7c6 or c7c5)
    expect(result.has("zh0")).toBe(true);
    expect(result.get("zh0")?.from).toEqual({ x: 2, y: 1 });
    // pawn2 gets its Stockfish move
    expect(result.has("zh1")).toBe(true);
  });

  it("omits zombie from result when no legal moves and Stockfish fails", async () => {
    // A pawn at y=7 (bottom of board) has no valid moves. The early-exit before
    // calling Stockfish already handles this — result should be null/omitted.
    const pool = readyPool(1);
    const blockedPawn = makePiece("black", "pawn", 4, 7, { id: "zh-blocked" });
    const pieces = [makePiece("white", "king", 0, 0), blockedPawn];

    const result = await pool.getMovesForAllZombies(pieces, [blockedPawn]);
    expect(result.has("zh-blocked")).toBe(false);
  });

  it("sends searchmoves in the go command for each zombie", async () => {
    const pool = readyPool(1);
    const pawn = makePiece("black", "pawn", 4, 1, { id: "zh0" });
    const pieces = [makePiece("white", "king", 4, 7), pawn];

    const movePromise = pool.getMovesForAllZombies(pieces, [pawn]);
    const [w] = MockWorker.instances;
    // Verify searchmoves is sent before emitting bestmove
    const goCmd = w.posted.find((m) => m.startsWith("go depth"));
    expect(goCmd).toBeDefined();
    expect(goCmd).toContain("searchmoves");
    emit(w, "bestmove e7e6");
    await movePromise;
  });
});
