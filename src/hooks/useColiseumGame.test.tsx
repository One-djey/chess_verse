// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { Arena, ArenaPiece } from "../types/coliseum";

// The hook generates an arena on mount — substitute a small deterministic one
// (the generator has its own invariant tests in coliseumGenerator.test.ts).
vi.mock("../utils/chess/coliseumGenerator", () => ({
  generateColiseumArena: vi.fn(),
}));
vi.mock("../services/statsService", () => ({
  recordGame: vi.fn(),
}));

import { generateColiseumArena } from "../utils/chess/coliseumGenerator";
import { recordGame } from "../services/statsService";
import { useColiseumGame, arenaToChessPieces } from "./useColiseumGame";

/** 4×4 all-playable arena with the given pieces. */
function makeArena(pieces: ArenaPiece[]): Arena {
  return {
    grid: Array.from({ length: 4 }, () => [1, 1, 1, 1]),
    spawnZones: [
      [3, 0],
      [0, 3],
    ],
    pieces,
    totalCells: 16,
    freeCells: 16 - pieces.length,
    attempts: 1,
    elapsed: 0,
    fallback: false,
    seed: 1,
  };
}

/** Default arena: two kings + a white rook with open lines. */
function defaultArena(): Arena {
  return makeArena([
    { y: 3, x: 0, piece: "king", player: 0 },
    { y: 2, x: 2, piece: "rook", player: 0 },
    { y: 0, x: 3, piece: "king", player: 1 },
  ]);
}

function setup(arena: Arena = defaultArena()) {
  vi.mocked(generateColiseumArena).mockReturnValue(arena);
  return renderHook(() => useColiseumGame());
}

function findPiece(
  result: ReturnType<typeof setup>["result"],
  color: "white" | "black",
  type: string,
) {
  const piece = result.current.state.pieces.find(
    (p) => p.color === color && p.type === type,
  );
  if (!piece) throw new Error(`no ${color} ${type} on the board`);
  return piece;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useColiseumGame — initialization", () => {
  it("builds the initial state from the generated arena", () => {
    const { result } = setup();
    expect(result.current.state.currentTurn).toBe("white");
    expect(result.current.state.gameOver).toBe(false);
    expect(result.current.state.pieces).toHaveLength(3);
    expect(result.current.generating).toBe(false);
    expect(result.current.getTotalMoveCount()).toBe(0);
  });

  it("arenaToChessPieces maps player 0→white, 1→black with unique ids", () => {
    const pieces = arenaToChessPieces(defaultArena());
    expect(pieces.map((p) => p.color)).toEqual(["white", "white", "black"]);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length);
    expect(pieces[0].position).toEqual({ x: 0, y: 3 });
  });
});

describe("useColiseumGame — piece selection", () => {
  it("selects an own-color piece on its turn and exposes its legal moves", () => {
    const { result } = setup();
    const rook = findPiece(result, "white", "rook");
    act(() => result.current.handlePieceSelect(rook));
    expect(result.current.state.selectedPiece?.id).toBe(rook.id);
    expect(result.current.state.validMoves.length).toBeGreaterThan(0);
  });

  it("ignores selecting an opponent piece on white's turn", () => {
    const { result } = setup();
    const blackKing = findPiece(result, "black", "king");
    act(() => result.current.handlePieceSelect(blackKing));
    expect(result.current.state.selectedPiece).toBeNull();
  });

  it("re-selecting the same piece toggles the selection off", () => {
    const { result } = setup();
    const rook = findPiece(result, "white", "rook");
    act(() => result.current.handlePieceSelect(rook));
    act(() => result.current.handlePieceSelect(rook));
    expect(result.current.state.selectedPiece).toBeNull();
    expect(result.current.state.validMoves).toEqual([]);
  });
});

describe("useColiseumGame — moves", () => {
  it("applies a legal move: turn flips, moveCount and moves update", () => {
    const { result } = setup();
    const rook = findPiece(result, "white", "rook");
    act(() => result.current.handlePieceSelect(rook));
    const to = result.current.state.validMoves[0];
    act(() => result.current.handleMove(to));

    const moved = result.current.state.pieces.find((p) => p.id === rook.id)!;
    expect(moved.position).toEqual(to);
    expect(result.current.state.currentTurn).toBe("black");
    expect(result.current.state.moveCount).toEqual({ white: 1, black: 0 });
    expect(result.current.state.moves).toHaveLength(1);
    expect(result.current.getTotalMoveCount()).toBe(1);
  });

  it("ignores a move to a square outside validMoves", () => {
    const { result } = setup();
    const rook = findPiece(result, "white", "rook");
    act(() => result.current.handlePieceSelect(rook));
    act(() => result.current.handleMove(rook.position)); // own square: illegal
    expect(result.current.state.currentTurn).toBe("white");
    expect(result.current.state.moves).toHaveLength(0);
  });
});

describe("useColiseumGame — game over & stats", () => {
  // Black king cornered at (0,3); rook at (1,0) covers row 1; moving the
  // second rook from (2,1) to (0,1) covers row 0 → checkmate.
  function mateArena(): Arena {
    return makeArena([
      { y: 3, x: 3, piece: "king", player: 0 },
      { y: 1, x: 0, piece: "rook", player: 0 },
      { y: 2, x: 1, piece: "rook", player: 0 },
      { y: 0, x: 3, piece: "king", player: 1 },
    ]);
  }

  it("detects checkmate, sets the winner and records the game once", () => {
    const { result } = setup(mateArena());
    const rookB = result.current.state.pieces.find(
      (p) => p.type === "rook" && p.position.x === 1 && p.position.y === 2,
    )!;
    act(() => result.current.handlePieceSelect(rookB));
    act(() => result.current.handleMove({ x: 1, y: 0 }));

    expect(result.current.state.gameOver).toBe(true);
    expect(result.current.state.isCheck).toBe(true);
    expect(result.current.state.winner).toBe("white");
    expect(recordGame).toHaveBeenCalledTimes(1);
    expect(recordGame).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "coliseum",
        playType: "local",
        winner: "white",
        playerColor: "white",
      }),
    );
  });

  it("handleSurrender ends the game and records surrenderedBy", () => {
    const { result } = setup();
    act(() => result.current.handleSurrender("white"));

    expect(result.current.state.gameOver).toBe(true);
    expect(result.current.state.winner).toBe("black");
    expect(result.current.state.surrenderedBy).toBe("white");
    expect(recordGame).toHaveBeenCalledTimes(1);
    expect(recordGame).toHaveBeenCalledWith(
      expect.objectContaining({ winner: "black", surrenderedBy: "white" }),
    );
  });
});

describe("useColiseumGame — regenerate", () => {
  it("produces a fresh arena after the 50ms delay and toggles `generating`", () => {
    vi.useFakeTimers();
    const { result } = setup();
    // Dirty the state with a surrender so the reset is observable.
    act(() => result.current.handleSurrender("white"));
    expect(result.current.state.gameOver).toBe(true);

    act(() => result.current.regenerate());
    expect(result.current.generating).toBe(true);

    act(() => vi.advanceTimersByTime(50));
    expect(result.current.generating).toBe(false);
    expect(result.current.state.gameOver).toBe(false);
    expect(result.current.state.currentTurn).toBe("white");
    expect(result.current.state.moves).toHaveLength(0);
  });
});
