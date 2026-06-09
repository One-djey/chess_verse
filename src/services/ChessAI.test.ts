import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChessAI } from "./ChessAI";
import { makePiece } from "../test/helpers";
import type { Piece } from "../types/chess";

/**
 * Mock Worker for the node environment (no real Web Worker available).
 * Captures every postMessage payload and exposes assignable
 * onmessage/onerror handlers, exactly like the DOM Worker interface
 * surface that ChessAI uses.
 */
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

/** Simulates an engine message arriving from the worker. */
function emit(worker: MockWorker, data: string) {
  worker.onmessage?.({ data } as MessageEvent);
}

/** Drives the full UCI handshake: uciok -> isready -> readyok. */
function handshake(worker: MockWorker) {
  emit(worker, "uciok");
  emit(worker, "readyok");
}

function lastWorker(): MockWorker {
  return MockWorker.instances[MockWorker.instances.length - 1];
}

/** Kings only: white king e1 (4,7), black king e8 (4,0). */
function kingsOnly(): Piece[] {
  return [makePiece("white", "king", 4, 7), makePiece("black", "king", 4, 0)];
}

/** Kings + black pawn e7 (4,1) + white pawn e2 (4,6). */
function kingsAndPawns(): Piece[] {
  return [
    makePiece("black", "king", 4, 0),
    makePiece("black", "pawn", 4, 1),
    makePiece("white", "pawn", 4, 6),
    makePiece("white", "king", 4, 7),
  ];
}

/** Creates a ChessAI whose worker has completed the UCI handshake. */
function readyAI(): { ai: ChessAI; worker: MockWorker } {
  const ai = new ChessAI();
  const worker = lastWorker();
  handshake(worker);
  return { ai, worker };
}

beforeEach(() => {
  MockWorker.instances = [];
  vi.stubGlobal("Worker", MockWorker);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ChessAI initialization", () => {
  it("creates a Worker pointing at the stockfish script", () => {
    new ChessAI();
    expect(MockWorker.instances).toHaveLength(1);
    expect(MockWorker.instances[0].url).toBe("/stockfish/stockfish.js");
  });

  it("sends 'uci' as the first message on construction", () => {
    new ChessAI();
    expect(lastWorker().posted[0]).toBe("uci");
  });

  it("applies the default difficulty (level 10 -> skill 9) on construction", () => {
    new ChessAI();
    // NOTE: setDifficulty posts the setoption before the engine has answered
    // uciok/readyok; real Stockfish tolerates this but it is pre-handshake.
    expect(lastWorker().posted).toContain("setoption name Skill Level value 9");
  });

  it("sends 'isready' after receiving 'uciok' and is not ready before 'readyok'", () => {
    const ai = new ChessAI();
    const worker = lastWorker();
    expect(ai.ready).toBe(false);
    emit(worker, "uciok");
    expect(worker.posted).toContain("isready");
    expect(ai.ready).toBe(false);
  });

  it("becomes ready after receiving 'readyok'", () => {
    const ai = new ChessAI();
    const worker = lastWorker();
    emit(worker, "uciok");
    emit(worker, "readyok");
    expect(ai.ready).toBe(true);
  });
});

describe("getNextMove before initialization", () => {
  it("rejects when the handshake has not completed", async () => {
    const ai = new ChessAI();
    await expect(ai.getNextMove(kingsOnly())).rejects.toThrow(
      "L'IA n'est pas encore initialisée",
    );
  });

  it("rejects after destroy() removed the worker", async () => {
    const { ai } = readyAI();
    ai.destroy();
    await expect(ai.getNextMove(kingsOnly())).rejects.toThrow(
      "L'IA n'est pas encore initialisée",
    );
  });
});

describe("getNextMove happy path", () => {
  it("sends the position FEN with black to move and the correct placement", () => {
    const { ai, worker } = readyAI();
    void ai.getNextMove(kingsAndPawns()).catch(() => {});
    const positionMsg = worker.posted.find((m) => m.startsWith("position fen"));
    expect(positionMsg).toBe(
      "position fen 4k3/4p3/8/8/8/8/4P3/4K3 b KQkq - 0 1",
    );
  });

  it("sends 'go movetime' using the configured difficulty's movetime", () => {
    const { ai, worker } = readyAI();
    ai.setDifficulty(1); // movetime 100
    void ai.getNextMove(kingsAndPawns()).catch(() => {});
    expect(worker.posted).toContain("go movetime 100");
  });

  it("re-asserts the configured skill level before each search", () => {
    const { ai, worker } = readyAI();
    ai.setDifficulty(20);
    worker.posted = [];
    void ai.getNextMove(kingsAndPawns()).catch(() => {});
    const goIndex = worker.posted.indexOf("go movetime 3000");
    const skillIndex = worker.posted.indexOf(
      "setoption name Skill Level value 20",
    );
    expect(skillIndex).toBeGreaterThanOrEqual(0);
    expect(skillIndex).toBeLessThan(goIndex);
  });

  it("resolves with from/to converted from algebraic to board coordinates", async () => {
    const { ai, worker } = readyAI();
    const promise = ai.getNextMove(kingsAndPawns());
    // e7 -> file e = x 4, rank 7 = y 1 ; e5 -> x 4, rank 5 = y 3
    emit(worker, "bestmove e7e5");
    await expect(promise).resolves.toEqual({
      from: { x: 4, y: 1 },
      to: { x: 4, y: 3 },
      promotionType: undefined,
    });
  });

  it("parses bestmove even when followed by a ponder token", async () => {
    const { ai, worker } = readyAI();
    const promise = ai.getNextMove(kingsAndPawns());
    emit(worker, "bestmove e7e5 ponder e2e4");
    await expect(promise).resolves.toMatchObject({
      from: { x: 4, y: 1 },
      to: { x: 4, y: 3 },
    });
  });

  it("maps corner squares correctly (a1 and h8)", async () => {
    const { ai, worker } = readyAI();
    const promise = ai.getNextMove(kingsOnly());
    emit(worker, "bestmove a1h8");
    await expect(promise).resolves.toMatchObject({
      from: { x: 0, y: 7 },
      to: { x: 7, y: 0 },
    });
  });
});

describe("promotion parsing", () => {
  it("parses a queen promotion suffix", async () => {
    const { ai, worker } = readyAI();
    const pieces = [...kingsOnly(), makePiece("black", "pawn", 0, 6)]; // a2
    const promise = ai.getNextMove(pieces);
    emit(worker, "bestmove a2a1q");
    await expect(promise).resolves.toEqual({
      from: { x: 0, y: 6 },
      to: { x: 0, y: 7 },
      promotionType: "queen",
    });
  });

  it.each([
    ["r", "rook"],
    ["b", "bishop"],
    ["n", "knight"],
  ])("parses a '%s' promotion suffix as %s", async (suffix, type) => {
    const { ai, worker } = readyAI();
    const promise = ai.getNextMove(kingsOnly());
    emit(worker, `bestmove a2a1${suffix}`);
    await expect(promise).resolves.toMatchObject({ promotionType: type });
  });
});

describe("UCI sentinels (no legal move)", () => {
  it("rejects on 'bestmove (none)'", async () => {
    const { ai, worker } = readyAI();
    const promise = ai.getNextMove(kingsOnly());
    emit(worker, "bestmove (none)");
    await expect(promise).rejects.toThrow("no legal move");
  });

  it("rejects on 'bestmove 0000'", async () => {
    const { ai, worker } = readyAI();
    const promise = ai.getNextMove(kingsOnly());
    emit(worker, "bestmove 0000");
    await expect(promise).rejects.toThrow("no legal move");
  });

  it("allows a fresh search after a sentinel rejection", async () => {
    const { ai, worker } = readyAI();
    const first = ai.getNextMove(kingsOnly());
    emit(worker, "bestmove (none)");
    await expect(first).rejects.toThrow("no legal move");

    const second = ai.getNextMove(kingsAndPawns());
    emit(worker, "bestmove e7e5");
    await expect(second).resolves.toMatchObject({ from: { x: 4, y: 1 } });
  });
});

describe("search timeout", () => {
  it("rejects with 'AI move timeout' when no bestmove arrives within 5s", async () => {
    vi.useFakeTimers();
    const { ai } = readyAI();
    const promise = ai.getNextMove(kingsOnly());
    const rejection = expect(promise).rejects.toThrow("AI move timeout");
    await vi.advanceTimersByTimeAsync(5001);
    await rejection;
  });

  it("does not reject when bestmove arrives before the 5s deadline", async () => {
    vi.useFakeTimers();
    const { ai, worker } = readyAI();
    const promise = ai.getNextMove(kingsAndPawns());
    await vi.advanceTimersByTimeAsync(4999);
    emit(worker, "bestmove e7e5");
    await expect(promise).resolves.toMatchObject({ to: { x: 4, y: 3 } });
    // Firing the now-stale timer must be a no-op.
    await vi.advanceTimersByTimeAsync(10000);
  });
});

describe("setDifficulty mapping", () => {
  it("maps level 1 to skill 0", () => {
    const { ai, worker } = readyAI();
    ai.setDifficulty(1);
    expect(worker.posted).toContain("setoption name Skill Level value 0");
  });

  it("maps level 20 to skill 20", () => {
    const { ai, worker } = readyAI();
    ai.setDifficulty(20);
    expect(worker.posted).toContain("setoption name Skill Level value 20");
  });

  it("maps level 10 to skill 9 (rounded)", () => {
    const { ai, worker } = readyAI();
    worker.posted = [];
    ai.setDifficulty(10);
    expect(worker.posted).toContain("setoption name Skill Level value 9");
  });

  it.each([
    [1, 100],
    [10, 1474],
    [20, 3000],
  ])("level %i searches with movetime %i", (level, movetime) => {
    const { ai, worker } = readyAI();
    ai.setDifficulty(level);
    void ai.getNextMove(kingsOnly()).catch(() => {});
    expect(worker.posted).toContain(`go movetime ${movetime}`);
  });
});

describe("search cancellation (stopPending)", () => {
  it("rejects the previous search with 'search cancelled' and sends 'stop'", async () => {
    const { ai, worker } = readyAI();
    const first = ai.getNextMove(kingsAndPawns());
    const firstRejection = expect(first).rejects.toThrow("search cancelled");
    const second = ai.getNextMove(kingsAndPawns());
    void second.catch(() => {});
    expect(worker.posted).toContain("stop");
    await firstRejection;
  });

  it("discards the stale bestmove of the cancelled search", async () => {
    const { ai, worker } = readyAI();
    const first = ai.getNextMove(kingsAndPawns());
    void first.catch(() => {});
    const second = ai.getNextMove(kingsAndPawns());
    void second.catch(() => {});

    // Stale bestmove emitted in response to "stop": must NOT resolve `second`.
    emit(worker, "bestmove e7e6");
    let secondSettled = false;
    void second.then(
      () => (secondSettled = true),
      () => (secondSettled = true),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(secondSettled).toBe(false);

    // The new search resolves only with its own bestmove.
    emit(worker, "bestmove e7e5");
    await expect(second).resolves.toMatchObject({
      from: { x: 4, y: 1 },
      to: { x: 4, y: 3 },
    });
  });

  it("getHintMove also cancels a pending getNextMove search", async () => {
    const { ai, worker } = readyAI();
    const search = ai.getNextMove(kingsAndPawns());
    const rejection = expect(search).rejects.toThrow("search cancelled");
    const hint = ai.getHintMove(kingsAndPawns(), "white");
    void hint.catch(() => {});
    expect(worker.posted).toContain("stop");
    await rejection;
  });
});

describe("getHintMove", () => {
  it("rejects when the AI is not ready", async () => {
    const ai = new ChessAI();
    await expect(ai.getHintMove(kingsOnly(), "white")).rejects.toThrow(
      "L'IA n'est pas disponible",
    );
  });

  it("sets skill to 20, searches the given color with movetime 1500", () => {
    const { ai, worker } = readyAI();
    ai.setDifficulty(1);
    worker.posted = [];
    void ai.getHintMove(kingsAndPawns(), "white").catch(() => {});
    expect(worker.posted).toContain("setoption name Skill Level value 20");
    expect(worker.posted).toContain(
      "position fen 4k3/4p3/8/8/8/8/4P3/4K3 w KQkq - 0 1",
    );
    expect(worker.posted).toContain("go movetime 1500");
  });

  it("uses black side-to-move in the FEN when hinting for black", () => {
    const { ai, worker } = readyAI();
    void ai.getHintMove(kingsAndPawns(), "black").catch(() => {});
    const positionMsg = worker.posted.find((m) => m.startsWith("position fen"));
    expect(positionMsg).toContain(" b KQkq - 0 1");
  });

  it("resolves with the move and restores the configured skill level", async () => {
    const { ai, worker } = readyAI();
    ai.setDifficulty(1); // skill 0
    const promise = ai.getHintMove(kingsAndPawns(), "white");
    worker.posted = [];
    emit(worker, "bestmove e2e4");
    await expect(promise).resolves.toEqual({
      from: { x: 4, y: 6 },
      to: { x: 4, y: 4 },
      promotionType: undefined,
    });
    expect(worker.posted).toContain("setoption name Skill Level value 0");
  });

  it("restores the configured skill level on timeout and rejects", async () => {
    vi.useFakeTimers();
    const { ai, worker } = readyAI();
    ai.setDifficulty(1); // skill 0
    const promise = ai.getHintMove(kingsAndPawns(), "white");
    const rejection = expect(promise).rejects.toThrow("Hint timeout");
    worker.posted = [];
    await vi.advanceTimersByTimeAsync(5001);
    await rejection;
    expect(worker.posted).toContain("setoption name Skill Level value 0");
  });
});

describe("destroy and restart", () => {
  it("destroy() terminates the worker", () => {
    const { ai, worker } = readyAI();
    ai.destroy();
    expect(worker.terminated).toBe(true);
  });

  it("restart() terminates the old worker and creates a fresh one", () => {
    const { ai, worker } = readyAI();
    ai.restart();
    expect(worker.terminated).toBe(true);
    expect(MockWorker.instances).toHaveLength(2);
    const fresh = lastWorker();
    expect(fresh).not.toBe(worker);
    expect(fresh.posted[0]).toBe("uci");
  });

  it("restart() resets readiness until the new handshake completes", () => {
    const { ai } = readyAI();
    expect(ai.ready).toBe(true);
    ai.restart();
    expect(ai.ready).toBe(false);
    handshake(lastWorker());
    expect(ai.ready).toBe(true);
  });

  it("restart() cancels a pending search", async () => {
    const { ai } = readyAI();
    const promise = ai.getNextMove(kingsOnly());
    const rejection = expect(promise).rejects.toThrow("search cancelled");
    ai.restart();
    await rejection;
  });

  it("a restarted AI can complete a full search cycle", async () => {
    const { ai } = readyAI();
    ai.restart();
    const fresh = lastWorker();
    handshake(fresh);
    const promise = ai.getNextMove(kingsAndPawns());
    emit(fresh, "bestmove e7e5");
    await expect(promise).resolves.toMatchObject({
      from: { x: 4, y: 1 },
      to: { x: 4, y: 3 },
    });
  });
});
