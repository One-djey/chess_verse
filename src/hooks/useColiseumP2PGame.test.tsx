// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { Arena } from "../types/coliseum";
import type { P2PConnectionState } from "../types/p2p";

// Stub the Trystero service module — the hook imports makeRoomActions (type
// only), but the import pulls in trystero's WebRTC/relay code.
vi.mock("../services/TrysteroService", () => ({
  joinRoom: vi.fn(),
  generateRoomId: vi.fn(() => "room1234"),
  makeRoomActions: vi.fn(),
}));

import { useColiseumP2PGame } from "./useColiseumP2PGame";

type HookParams = Parameters<typeof useColiseumP2PGame>[0];

/** Minimal 4×4 all-playable arena with one king per player. */
function makeArena(): Arena {
  return {
    grid: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ],
    spawnZones: [
      [3, 0],
      [0, 3],
    ],
    pieces: [
      { y: 3, x: 0, piece: "king", player: 0 },
      { y: 0, x: 3, piece: "king", player: 1 },
    ],
    totalCells: 16,
    freeCells: 16,
    attempts: 1,
    elapsed: 0,
    fallback: false,
    seed: 42,
  };
}

function setup(overrides: Partial<HookParams> = {}) {
  const baseProps: HookParams = {
    arena: makeArena(),
    role: "host",
    playerColor: "white",
    actions: null,
    connectionState: "connected",
    ...overrides,
  };
  return {
    baseProps,
    ...renderHook((p: HookParams) => useColiseumP2PGame(p), {
      initialProps: baseProps,
    }),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useColiseumP2PGame — initial state", () => {
  it("builds the game state from the arena (white to move, not over)", () => {
    const { result } = setup();
    expect(result.current.state.currentTurn).toBe("white");
    expect(result.current.state.gameOver).toBe(false);
    expect(result.current.state.pieces).toHaveLength(2);
    const colors = result.current.state.pieces.map((p) => p.color).sort();
    expect(colors).toEqual(["black", "white"]);
    expect(result.current.rematchState).toBe("idle");
  });
});

// BUG-013: Trystero's room.onPeerLeave is a single-slot setter — the hook used
// to register its own handler there, clobbering P2PContext's
// setConnectionState("disconnected"). peerLeft is now DERIVED from
// connectionState and P2PContext stays the sole owner of onPeerLeave.
describe("useColiseumP2PGame — peer leave (BUG-013)", () => {
  it("derives peerLeft from connectionState", () => {
    const { result, rerender, baseProps } = setup();
    expect(result.current.peerLeft).toBe(false);

    rerender({ ...baseProps, connectionState: "disconnected" });
    expect(result.current.peerLeft).toBe(true);
  });

  it("peerLeft is false for every non-disconnected connection state", () => {
    const { result, rerender, baseProps } = setup({ role: "guest" });
    const states: P2PConnectionState[] = [
      "idle",
      "waiting",
      "connecting",
      "connected",
    ];
    for (const cs of states) {
      rerender({ ...baseProps, connectionState: cs });
      expect(result.current.peerLeft).toBe(false);
    }
  });
});

describe("useColiseumP2PGame — surrender", () => {
  it("handleSurrender marks the game over with the opponent as winner", () => {
    const { result } = setup();
    act(() => result.current.handleSurrender("white"));
    expect(result.current.state.gameOver).toBe(true);
    expect(result.current.state.winner).toBe("black");
    expect(result.current.state.surrenderedBy).toBe("white");
  });
});
