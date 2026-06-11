// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { GameMode, Piece } from "../types/chess";
import { CLASSIC, BORDERLESS, makePiece, pos } from "../test/helpers";

// ── ChessAI mock ──────────────────────────────────────────────────────────────
// The hook does `new ChessAI()` (Web Worker inside) — replace it with a spy
// class so we can assert construction / destroy() / setDifficulty() calls.
const spies = vi.hoisted(() => ({
  ctor: vi.fn(),
  destroy: vi.fn(),
  setDifficulty: vi.fn(),
}));

vi.mock("../services/ChessAI", () => ({
  ChessAI: class MockChessAI {
    constructor() {
      spies.ctor();
    }
    destroy = spies.destroy;
    setDifficulty = spies.setDifficulty;
  },
}));

import { useChessGame, type LocalSettings } from "./useChessGame";

const STORAGE_KEY = "chess_settings";

const DEFAULT_SETTINGS: LocalSettings = {
  aiEnabled: true,
  aiDifficulty: 5,
  flipBoard: false,
  showDangerIndicator: false,
  showHint: false,
  showMoveAnnotations: false,
};

type Params = {
  modeId: string | undefined;
  navigate: (path: string) => void;
  gameMode: GameMode;
  isP2PMode: boolean;
  p2pInitialPieces: Piece[] | null;
};

function renderChessGame(overrides: Partial<Params> = {}) {
  const navigate = vi.fn();
  const initialProps: Params = {
    modeId: "classic",
    navigate,
    gameMode: CLASSIC,
    isP2PMode: false,
    p2pInitialPieces: null,
    ...overrides,
  };
  const utils = renderHook((p: Params) => useChessGame(p), { initialProps });
  return { ...utils, navigate, initialProps };
}

function twoKings(): Piece[] {
  return [
    makePiece("white", "king", 4, 7, { id: "wk" }),
    makePiece("black", "king", 4, 0, { id: "bk" }),
  ];
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ── Settings ──────────────────────────────────────────────────────────────────

describe("useChessGame — settings", () => {
  it("uses default settings when localStorage is empty", () => {
    const { result } = renderChessGame();
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("loads settings stored under chess_settings", () => {
    const stored: LocalSettings = {
      aiEnabled: false,
      aiDifficulty: 9,
      flipBoard: true,
      showDangerIndicator: true,
      showHint: true,
      showMoveAnnotations: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const { result } = renderChessGame();
    expect(result.current.settings).toEqual(stored);
  });

  it("merges partial stored settings over the defaults", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ aiDifficulty: 9 }));
    const { result } = renderChessGame();
    expect(result.current.settings).toEqual({
      ...DEFAULT_SETTINGS,
      aiDifficulty: 9,
    });
  });

  it("falls back to defaults on corrupt JSON without throwing", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json!");
    let result!: ReturnType<typeof renderChessGame>["result"];
    expect(() => {
      ({ result } = renderChessGame());
    }).not.toThrow();
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('tolerates a stored literal "null" payload', () => {
    // JSON.parse("null") succeeds and returns null; the spread of null is a
    // no-op so the defaults must survive.
    localStorage.setItem(STORAGE_KEY, "null");
    const { result } = renderChessGame();
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("persists the current settings to localStorage on mount", () => {
    renderChessGame();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it("handleSettingsChange updates state and persists to localStorage", () => {
    const { result } = renderChessGame();
    const next: LocalSettings = {
      aiEnabled: false,
      aiDifficulty: 9,
      flipBoard: true,
      showDangerIndicator: true,
      showHint: false,
      showMoveAnnotations: true,
    };
    act(() => result.current.handleSettingsChange(next));
    expect(result.current.settings).toEqual(next);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(next);
  });

  it("handleSettingsChange forwards the difficulty to the local AI", () => {
    const { result } = renderChessGame();
    act(() =>
      result.current.handleSettingsChange({
        ...DEFAULT_SETTINGS,
        aiDifficulty: 8,
      }),
    );
    expect(spies.setDifficulty).toHaveBeenCalledWith(8);
  });

  it("handleSettingsChange does not touch the AI in P2P mode", () => {
    const { result } = renderChessGame({
      modeId: "p2p",
      isP2PMode: true,
      p2pInitialPieces: twoKings(),
    });
    expect(() =>
      act(() =>
        result.current.handleSettingsChange({
          ...DEFAULT_SETTINGS,
          aiDifficulty: 8,
        }),
      ),
    ).not.toThrow();
    expect(spies.setDifficulty).not.toHaveBeenCalled();
  });
});

// ── AI lifecycle / aiEnabled ──────────────────────────────────────────────────

describe("useChessGame — AI lifecycle", () => {
  it("aiEnabled is true for a local game with default settings", () => {
    const { result } = renderChessGame();
    expect(result.current.aiEnabled).toBe(true);
  });

  it("aiEnabled is false in P2P mode even when settings.aiEnabled is true", () => {
    const { result } = renderChessGame({
      modeId: "p2p",
      isP2PMode: true,
      p2pInitialPieces: twoKings(),
    });
    expect(result.current.settings.aiEnabled).toBe(true);
    expect(result.current.aiEnabled).toBe(false);
  });

  it("aiEnabled is false when settings.aiEnabled is stored as false", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ aiEnabled: false }));
    const { result } = renderChessGame();
    expect(result.current.aiEnabled).toBe(false);
  });

  it("constructs a ChessAI for a local game", () => {
    const { result } = renderChessGame();
    expect(spies.ctor).toHaveBeenCalledTimes(1);
    expect(result.current.aiRef.current).not.toBeNull();
  });

  it("does NOT construct a ChessAI in P2P mode", () => {
    const { result } = renderChessGame({
      modeId: "p2p",
      isP2PMode: true,
      p2pInitialPieces: twoKings(),
    });
    expect(spies.ctor).not.toHaveBeenCalled();
    expect(result.current.aiRef.current).toBeNull();
  });

  it("destroys the AI on unmount", () => {
    const { unmount } = renderChessGame();
    expect(spies.destroy).not.toHaveBeenCalled();
    unmount();
    expect(spies.destroy).toHaveBeenCalledTimes(1);
  });
});

// ── Board initialisation ──────────────────────────────────────────────────────

describe("useChessGame — board initialisation", () => {
  it("navigates home and leaves the board empty when modeId is undefined", () => {
    const { result, navigate } = renderChessGame({ modeId: undefined });
    expect(navigate).toHaveBeenCalledWith("/");
    expect(result.current.gameState.pieces).toHaveLength(0);
    expect(spies.ctor).not.toHaveBeenCalled();
  });

  it("waits for p2pInitialPieces before initialising a P2P board", () => {
    const { result, navigate } = renderChessGame({
      modeId: "p2p",
      isP2PMode: true,
      p2pInitialPieces: null,
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.gameState.pieces).toHaveLength(0);
    expect(spies.ctor).not.toHaveBeenCalled();
  });

  it("uses the provided P2P pieces verbatim", () => {
    const pieces = twoKings();
    const { result } = renderChessGame({
      modeId: "p2p",
      isP2PMode: true,
      p2pInitialPieces: pieces,
    });
    expect(result.current.gameState.pieces).toBe(pieces);
    expect(result.current.gameState.currentTurn).toBe("white");
  });

  it("initialises the board once P2P pieces arrive via a rerender", () => {
    const navigate = vi.fn();
    const base: Params = {
      modeId: "p2p",
      navigate,
      gameMode: CLASSIC,
      isP2PMode: false,
      p2pInitialPieces: null,
    };
    const { result, rerender } = renderHook((p: Params) => useChessGame(p), {
      initialProps: { ...base, isP2PMode: true },
    });
    expect(result.current.gameState.pieces).toHaveLength(0);

    const pieces = twoKings();
    rerender({ ...base, isP2PMode: true, p2pInitialPieces: pieces });
    expect(result.current.gameState.pieces).toBe(pieces);
  });

  it("builds a standard 32-piece board for a local classic game", () => {
    const { result } = renderChessGame();
    expect(result.current.gameState.pieces).toHaveLength(32);
    expect(result.current.gameState.currentTurn).toBe("white");
    expect(result.current.gameState.gameOver).toBe(false);
  });

  it("keeps the gameMode it was given (special modes included)", () => {
    const { result } = renderChessGame({
      modeId: "borderless",
      gameMode: BORDERLESS,
    });
    expect(result.current.gameState.gameMode).toBe(BORDERLESS);
  });
});

// ── Reset / replay / promotion ────────────────────────────────────────────────

describe("useChessGame — reset, replay & promotion", () => {
  it("resetGame rebuilds a fresh state from the given pieces", () => {
    const { result } = renderChessGame();
    act(() =>
      result.current.setGameState((prev) => ({
        ...prev,
        gameOver: true,
        winner: "black",
        currentTurn: "black",
        isCheck: true,
      })),
    );
    expect(result.current.gameState.gameOver).toBe(true);

    const fresh = twoKings();
    act(() => result.current.resetGame(fresh));

    expect(result.current.gameState.pieces).toBe(fresh);
    expect(result.current.gameState.gameOver).toBe(false);
    expect(result.current.gameState.winner).toBeNull();
    expect(result.current.gameState.currentTurn).toBe("white");
    expect(result.current.gameState.isCheck).toBe(false);
    expect(result.current.gameState.moves).toHaveLength(0);
  });

  it("handleReplay rebuilds a full initial board for the current mode", () => {
    const { result } = renderChessGame();
    act(() =>
      result.current.setGameState((prev) => ({
        ...prev,
        gameOver: true,
        winner: "white",
        currentTurn: "black",
      })),
    );
    act(() => result.current.handleReplay());

    expect(result.current.gameState.gameOver).toBe(false);
    expect(result.current.gameState.pieces).toHaveLength(32);
    expect(result.current.gameState.currentTurn).toBe("white");
    expect(result.current.gameState.moveCount).toEqual({ white: 0, black: 0 });
  });

  it("pendingPromotion can be set and cleared", () => {
    const { result } = renderChessGame();
    expect(result.current.pendingPromotion).toBeNull();

    const pawn = makePiece("white", "pawn", 0, 1);
    act(() =>
      result.current.setPendingPromotion({ piece: pawn, target: pos(0, 0) }),
    );
    expect(result.current.pendingPromotion).toEqual({
      piece: pawn,
      target: { x: 0, y: 0 },
    });

    act(() => result.current.setPendingPromotion(null));
    expect(result.current.pendingPromotion).toBeNull();
  });
});
