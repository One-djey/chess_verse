// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useRef, useState } from "react";
import type {
  GameMode,
  GameState,
  Piece,
  PieceColor,
} from "../types/chess";
import type {
  P2PMessage,
  MoveProposalMessage,
  MoveConfirmMessage,
  MoveRejectMessage,
  RematchRequestMessage,
  RematchAcceptMessage,
  RematchDeclineMessage,
  RematchStartMessage,
  ResignMessage,
  SyncRequestMessage,
  SyncStateMessage,
} from "../types/p2p";
import { CLASSIC, makePiece, makeState, pos } from "../test/helpers";

// ── TrysteroService mock ──────────────────────────────────────────────────────
// The hook imports makeRoomActions (used only as a type, but the import pulls
// in trystero's WebRTC/relay code) — stub the whole service module.
vi.mock("../services/TrysteroService", () => ({
  joinRoom: vi.fn(),
  generateRoomId: vi.fn(() => "room1234"),
  makeRoomActions: vi.fn(),
}));

import { useP2PGame } from "./useP2PGame";

type HookParams = Parameters<typeof useP2PGame>[0];
type Actions = NonNullable<HookParams["actions"]>;
type RoomT = NonNullable<HookParams["room"]>;

// ── Mock room actions ─────────────────────────────────────────────────────────
// Each onX registration captures the handler into `handlers` keyed by message
// type; each sender is a vi.fn() we can assert on.

type Handler = (msg: P2PMessage) => void;

function makeMockActions() {
  const handlers: Record<string, Handler> = {};
  const on = (key: string) =>
    vi.fn((cb: Handler) => {
      handlers[key] = cb;
    });

  const raw = {
    sendMoveProposal: vi.fn<(msg: MoveProposalMessage) => void>(),
    onMoveProposal: on("move_proposal"),
    sendMoveConfirm: vi.fn<(msg: MoveConfirmMessage) => void>(),
    onMoveConfirm: on("move_confirm"),
    sendMoveReject: vi.fn<(msg: MoveRejectMessage) => void>(),
    onMoveReject: on("move_reject"),
    sendColorAssign: vi.fn(),
    onColorAssign: on("color_assign"),
    sendSyncState: vi.fn(),
    onSyncState: on("sync_state"),
    sendResign: vi.fn<(msg: ResignMessage) => void>(),
    onResign: on("resign"),
    sendRematchRequest: vi.fn<(msg: RematchRequestMessage) => void>(),
    onRematchRequest: on("rematch_request"),
    sendRematchAccept: vi.fn<(msg: RematchAcceptMessage) => void>(),
    onRematchAccept: on("rematch_accept"),
    sendRematchDecline: vi.fn<(msg: RematchDeclineMessage) => void>(),
    onRematchDecline: on("rematch_decline"),
    sendRematchStart: vi.fn<(msg: RematchStartMessage) => void>(),
    onRematchStart: on("rematch_start"),
    sendGuestReady: vi.fn(),
    onGuestReady: on("guest_ready"),
    sendArenaInit: vi.fn(),
    onArenaInit: on("arena_init"),
    sendSyncRequest: vi.fn<(msg: SyncRequestMessage) => void>(),
    onSyncRequest: on("sync_request"),
  };

  return { raw, actions: raw as unknown as Actions, handlers };
}

// ── Harness ───────────────────────────────────────────────────────────────────
// The hook's handlers call setGameState with updater functions, so the harness
// owns a real useState<GameState> and keeps gameStateRef in sync, mirroring how
// Game.tsx wires useChessGame's state into useP2PGame.

interface HarnessProps {
  isP2PMode: boolean;
  role: HookParams["role"];
  playerColor: PieceColor | null;
  actions: HookParams["actions"];
  room: HookParams["room"];
  gameMode: GameMode;
  initialState: GameState;
  chessResetSpy: (pieces: Piece[]) => void;
}

function useHarness(props: HarnessProps) {
  const [gameState, setGameState] = useState<GameState>(props.initialState);
  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;

  const p2p = useP2PGame({
    isP2PMode: props.isP2PMode,
    role: props.role,
    playerColor: props.playerColor,
    actions: props.actions,
    room: props.room,
    gameMode: props.gameMode,
    setGameState,
    gameStateRef,
    chessResetGame: (pieces: Piece[]) => {
      props.chessResetSpy(pieces);
      setGameState(makeState(pieces, props.gameMode));
    },
  });

  return { gameState, setGameState, ...p2p };
}

interface SetupOpts {
  role: HookParams["role"];
  playerColor?: PieceColor | null;
  pieces?: Piece[];
  stateOverrides?: Partial<GameState>;
  gameMode?: GameMode;
  isP2PMode?: boolean;
  nullActions?: boolean;
}

function twoKings(): Piece[] {
  return [
    makePiece("white", "king", 4, 7, { id: "wk" }),
    makePiece("black", "king", 4, 0, { id: "bk" }),
  ];
}

function setup(opts: SetupOpts) {
  const { raw, actions, handlers } = makeMockActions();
  const chessResetSpy = vi.fn();
  let peerLeaveCb: (() => void) | undefined;
  const room = {
    onPeerLeave: vi.fn((cb: () => void) => {
      peerLeaveCb = cb;
    }),
    leave: vi.fn(),
  } as unknown as RoomT;

  const gameMode = opts.gameMode ?? CLASSIC;
  const playerColor =
    opts.playerColor !== undefined
      ? opts.playerColor
      : opts.role === "host"
        ? "white"
        : opts.role === "guest"
          ? "black"
          : null;
  const initialState = makeState(
    opts.pieces ?? twoKings(),
    gameMode,
    opts.stateOverrides,
  );

  const utils = renderHook(() =>
    useHarness({
      isP2PMode: opts.isP2PMode ?? true,
      role: opts.role,
      playerColor,
      actions: opts.nullActions ? null : actions,
      room,
      gameMode,
      initialState,
      chessResetSpy,
    }),
  );

  return {
    ...utils,
    raw,
    handlers,
    chessResetSpy,
    room,
    initialState,
    getPeerLeaveCb: () => peerLeaveCb,
  };
}

/** Host fixture: both kings + a black rook, black to move. */
function hostRookSetup(stateOverrides: Partial<GameState> = {}) {
  return setup({
    role: "host",
    pieces: [...twoKings(), makePiece("black", "rook", 0, 3, { id: "br" })],
    stateOverrides: { currentTurn: "black", ...stateOverrides },
  });
}

/** Guest fixture: both kings + a white rook, white to move (default). */
function guestRookSetup() {
  return setup({
    role: "guest",
    pieces: [...twoKings(), makePiece("white", "rook", 0, 5, { id: "wr" })],
  });
}

const ROOK_PROPOSAL: MoveProposalMessage = {
  type: "move_proposal",
  pieceId: "br",
  from: pos(0, 3),
  to: pos(0, 5),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Initial values & handler registration ────────────────────────────────────

describe("useP2PGame — initial state & registration", () => {
  it("starts with rematchState idle, peerLeft false and seq 0", () => {
    const { result } = setup({ role: "host" });
    expect(result.current.rematchState).toBe("idle");
    expect(result.current.peerLeft).toBe(false);
    expect(result.current.seqRef.current).toBe(0);
  });

  it("registers exactly the host-side handlers for role host", () => {
    const { handlers, room } = setup({ role: "host" });
    expect(Object.keys(handlers).sort()).toEqual([
      "move_proposal",
      "rematch_accept",
      "rematch_decline",
      "rematch_request",
      "resign",
      "sync_request",
    ]);
    expect(room.onPeerLeave).toHaveBeenCalledTimes(1);
  });

  it("registers exactly the guest-side handlers for role guest", () => {
    const { handlers, room } = setup({ role: "guest" });
    expect(Object.keys(handlers).sort()).toEqual([
      "move_confirm",
      "move_reject",
      "rematch_decline",
      "rematch_request",
      "rematch_start",
      "resign",
      "sync_state",
    ]);
    expect(room.onPeerLeave).toHaveBeenCalledTimes(1);
  });

  it("registers nothing when isP2PMode is false", () => {
    const { handlers, room } = setup({ role: "host", isP2PMode: false });
    expect(Object.keys(handlers)).toHaveLength(0);
    expect(room.onPeerLeave).not.toHaveBeenCalled();
  });

  it("registers nothing when actions is null, but rematch handlers still work", () => {
    const { handlers, result, room } = setup({
      role: "guest",
      nullActions: true,
    });
    expect(Object.keys(handlers)).toHaveLength(0);
    expect(room.onPeerLeave).not.toHaveBeenCalled();
    // NOTE: with a null actions object the hook still flips local rematch
    // state even though nothing was actually sent over the wire.
    act(() => result.current.handleRematch());
    expect(result.current.rematchState).toBe("requested");
  });
});

// ── HOST: move proposals ──────────────────────────────────────────────────────

describe("useP2PGame — host move proposals", () => {
  it("confirms a legal black move with seq 1 and the proposal coordinates", () => {
    const { handlers, raw } = hostRookSetup();
    act(() => handlers["move_proposal"]!(ROOK_PROPOSAL));

    expect(raw.sendMoveConfirm).toHaveBeenCalledTimes(1);
    expect(raw.sendMoveConfirm).toHaveBeenCalledWith({
      type: "move_confirm",
      pieceId: "br",
      from: pos(0, 3),
      to: pos(0, 5),
      seq: 1,
      promotionType: undefined,
    });
    expect(raw.sendMoveReject).not.toHaveBeenCalled();
  });

  it("applies the confirmed move to the host state", () => {
    const { handlers, result } = hostRookSetup();
    act(() => handlers["move_proposal"]!(ROOK_PROPOSAL));

    const state = result.current.gameState;
    const rook = state.pieces.find((p) => p.id === "br")!;
    expect(rook.position).toEqual(pos(0, 5));
    expect(rook.hasMoved).toBe(true);
    expect(state.currentTurn).toBe("white");
    expect(state.moveCount).toEqual({ white: 0, black: 1 });
    expect(state.moves).toHaveLength(1);
    expect(result.current.seqRef.current).toBe(1);
  });

  it("rejects a proposal for a nonexistent pieceId and leaves state untouched", () => {
    const { handlers, raw, result } = hostRookSetup();
    const before = result.current.gameState;
    act(() =>
      handlers["move_proposal"]!({ ...ROOK_PROPOSAL, pieceId: "ghost" }),
    );

    expect(raw.sendMoveReject).toHaveBeenCalledTimes(1);
    expect(raw.sendMoveReject).toHaveBeenCalledWith({ type: "move_reject" });
    expect(raw.sendMoveConfirm).not.toHaveBeenCalled();
    expect(result.current.gameState).toBe(before);
    expect(result.current.seqRef.current).toBe(0);
  });

  it("rejects a proposal that targets a white piece (guest can only move black)", () => {
    const { handlers, raw, result } = hostRookSetup();
    act(() =>
      handlers["move_proposal"]!({
        type: "move_proposal",
        pieceId: "wk",
        from: pos(4, 7),
        to: pos(4, 6),
      }),
    );
    expect(raw.sendMoveReject).toHaveBeenCalledTimes(1);
    expect(raw.sendMoveConfirm).not.toHaveBeenCalled();
    expect(result.current.gameState.moves).toHaveLength(0);
  });

  it("rejects a proposal when it is not black's turn", () => {
    const { handlers, raw, result } = setup({
      role: "host",
      pieces: [...twoKings(), makePiece("black", "rook", 0, 3, { id: "br" })],
      // makeState default: currentTurn "white"
    });
    const before = result.current.gameState;
    act(() => handlers["move_proposal"]!(ROOK_PROPOSAL));

    expect(raw.sendMoveReject).toHaveBeenCalledTimes(1);
    expect(raw.sendMoveConfirm).not.toHaveBeenCalled();
    expect(result.current.gameState).toBe(before);
  });

  it("rejects a proposal to a square the piece cannot reach", () => {
    const { handlers, raw, result } = hostRookSetup();
    const before = result.current.gameState;
    act(() =>
      handlers["move_proposal"]!({ ...ROOK_PROPOSAL, to: pos(1, 4) }), // diagonal rook move
    );

    expect(raw.sendMoveReject).toHaveBeenCalledTimes(1);
    expect(raw.sendMoveConfirm).not.toHaveBeenCalled();
    expect(result.current.gameState).toBe(before);
    expect(result.current.seqRef.current).toBe(0);
  });

  it("rejects any proposal once the game is over", () => {
    const { handlers, raw } = hostRookSetup({ gameOver: true });
    act(() => handlers["move_proposal"]!(ROOK_PROPOSAL));
    expect(raw.sendMoveReject).toHaveBeenCalledTimes(1);
    expect(raw.sendMoveConfirm).not.toHaveBeenCalled();
  });


  it("increments seq on each confirmed move (1, then 2)", () => {
    const { handlers, raw, result } = hostRookSetup();
    act(() => handlers["move_proposal"]!(ROOK_PROPOSAL));
    expect(result.current.seqRef.current).toBe(1);

    // Hand the turn back to black so a second proposal is legal.
    act(() =>
      result.current.setGameState((prev) => ({
        ...prev,
        currentTurn: "black",
      })),
    );
    act(() =>
      handlers["move_proposal"]!({
        type: "move_proposal",
        pieceId: "br",
        from: pos(0, 5),
        to: pos(0, 6),
      }),
    );

    expect(raw.sendMoveConfirm).toHaveBeenCalledTimes(2);
    expect(raw.sendMoveConfirm.mock.calls[1]![0].seq).toBe(2);
    expect(result.current.seqRef.current).toBe(2);
  });

  it("forwards promotionType in the confirm and applies the promotion", () => {
    const { handlers, raw, result } = setup({
      role: "host",
      pieces: [...twoKings(), makePiece("black", "pawn", 0, 6, { id: "bp" })],
      stateOverrides: { currentTurn: "black" },
    });
    act(() =>
      handlers["move_proposal"]!({
        type: "move_proposal",
        pieceId: "bp",
        from: pos(0, 6),
        to: pos(0, 7),
        promotionType: "knight",
      }),
    );

    expect(raw.sendMoveConfirm).toHaveBeenCalledWith({
      type: "move_confirm",
      pieceId: "bp",
      from: pos(0, 6),
      to: pos(0, 7),
      seq: 1,
      promotionType: "knight",
    });
    const promoted = result.current.gameState.pieces.find(
      (p) => p.id === "bp",
    )!;
    expect(promoted.type).toBe("knight");
    expect(promoted.position).toEqual(pos(0, 7));
    expect(result.current.gameState.moves[0]!.wasPromotion).toBe(true);
  });
});

// ── HOST: sync_request handler ────────────────────────────────────────────────

describe("useP2PGame — host sync_request handler", () => {
  it("sends sync_state with current pieces and seq when guest requests resync", () => {
    const { handlers, raw, result } = hostRookSetup();

    // Play one confirmed move first so seq is non-zero and state has changed.
    act(() => handlers["move_proposal"]!(ROOK_PROPOSAL));
    expect(result.current.seqRef.current).toBe(1);

    act(() => handlers["sync_request"]!({ type: "sync_request" }));

    expect(raw.sendSyncState).toHaveBeenCalledTimes(1);
    const sent = raw.sendSyncState.mock.calls[0]![0];
    expect(sent.type).toBe("sync_state");
    expect(sent.seq).toBe(1);
    // The pieces array should match the current authoritative state.
    expect(sent.pieces).toHaveLength(result.current.gameState.pieces.length);
    const rook = sent.pieces.find((p: Piece) => p.id === "br")!;
    expect(rook.position).toEqual(pos(0, 5)); // rook moved
    expect(sent.currentTurn).toBe(result.current.gameState.currentTurn);
    expect(sent.isCheck).toBe(result.current.gameState.isCheck);
  });

  it("responds to sync_request even at seq 0 (before any moves)", () => {
    const { handlers, raw, result } = hostRookSetup();

    act(() => handlers["sync_request"]!({ type: "sync_request" }));

    expect(raw.sendSyncState).toHaveBeenCalledTimes(1);
    const sent = raw.sendSyncState.mock.calls[0]![0];
    expect(sent.type).toBe("sync_state");
    expect(sent.seq).toBe(0);
    expect(sent.pieces).toHaveLength(result.current.gameState.pieces.length);
    expect(sent.currentTurn).toBe(result.current.gameState.currentTurn);
    expect(sent.isCheck).toBe(result.current.gameState.isCheck);
  });
});

// ── GUEST: move confirm / reject ──────────────────────────────────────────────

describe("useP2PGame — guest move confirm & reject", () => {
  it("applies a confirmed move and syncs the sequence number", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { handlers, result } = guestRookSetup();
    act(() =>
      handlers["move_confirm"]!({
        type: "move_confirm",
        pieceId: "wr",
        from: pos(0, 5),
        to: pos(0, 3),
        seq: 1,
      }),
    );

    const rook = result.current.gameState.pieces.find((p) => p.id === "wr")!;
    expect(rook.position).toEqual(pos(0, 3));
    expect(result.current.gameState.currentTurn).toBe("black");
    expect(result.current.seqRef.current).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns on a sequence gap but still applies the move", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { handlers, result } = guestRookSetup();
    act(() =>
      handlers["move_confirm"]!({
        type: "move_confirm",
        pieceId: "wr",
        from: pos(0, 5),
        to: pos(0, 3),
        seq: 7,
      }),
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("expected 1, got 7"),
    );
    const rook = result.current.gameState.pieces.find((p) => p.id === "wr")!;
    expect(rook.position).toEqual(pos(0, 3));
    expect(result.current.seqRef.current).toBe(7);
  });

  it("does not warn for consecutive in-order confirms", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { handlers, result } = guestRookSetup();
    act(() =>
      handlers["move_confirm"]!({
        type: "move_confirm",
        pieceId: "wr",
        from: pos(0, 5),
        to: pos(0, 3),
        seq: 1,
      }),
    );
    act(() =>
      handlers["move_confirm"]!({
        type: "move_confirm",
        pieceId: "wr",
        from: pos(0, 3),
        to: pos(0, 4),
        seq: 2,
      }),
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(result.current.seqRef.current).toBe(2);
  });

  it("requests resync for unknown pieceId, does NOT advance seqRef (BUG-010 fixed)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { handlers, result, raw } = guestRookSetup();
    const before = result.current.gameState;
    act(() =>
      handlers["move_confirm"]!({
        type: "move_confirm",
        pieceId: "ghost",
        from: pos(0, 5),
        to: pos(0, 3),
        seq: 1,
      }),
    );
    expect(result.current.gameState).toBe(before);
    expect(result.current.seqRef.current).toBe(0); // seqRef NOT advanced
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("ghost"),
    );
    // Resync request must be sent to host.
    expect(raw.sendSyncRequest).toHaveBeenCalledTimes(1);
    expect(raw.sendSyncRequest).toHaveBeenCalledWith({ type: "sync_request" });
    errorSpy.mockRestore();
  });

  // LIM-002: guest re-validates the host's move against local valid moves
  it("requests resync when destination is not in valid moves, seqRef stays (LIM-002 fixed)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { handlers, result, raw } = guestRookSetup();
    const before = result.current.gameState;
    // The rook is at (0,5); moving diagonally to (1,4) is illegal for a rook.
    act(() =>
      handlers["move_confirm"]!({
        type: "move_confirm",
        pieceId: "wr",
        from: pos(0, 5),
        to: pos(1, 4),
        seq: 1,
      }),
    );
    expect(result.current.gameState).toBe(before);
    expect(result.current.seqRef.current).toBe(0); // seqRef NOT advanced
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[P2P] Guest: move from host not in valid moves"),
    );
    // Resync request must be sent to host.
    expect(raw.sendSyncRequest).toHaveBeenCalledTimes(1);
    expect(raw.sendSyncRequest).toHaveBeenCalledWith({ type: "sync_request" });
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("move_reject clears selectedPiece and validMoves only", () => {
    const { handlers, result, initialState } = guestRookSetup();
    const rook = initialState.pieces.find((p) => p.id === "wr")!;
    act(() =>
      result.current.setGameState((prev) => ({
        ...prev,
        selectedPiece: rook,
        validMoves: [pos(0, 4), pos(0, 6)],
      })),
    );
    const piecesBefore = result.current.gameState.pieces;

    act(() => handlers["move_reject"]!({ type: "move_reject" }));

    expect(result.current.gameState.selectedPiece).toBeNull();
    expect(result.current.gameState.validMoves).toEqual([]);
    expect(result.current.gameState.pieces).toBe(piecesBefore);
    expect(result.current.gameState.currentTurn).toBe("white");
    expect(result.current.gameState.moves).toHaveLength(0);
  });

  it("applies a promotion carried by move_confirm", () => {
    const { handlers, result } = setup({
      role: "guest",
      pieces: [...twoKings(), makePiece("white", "pawn", 0, 1, { id: "wp" })],
    });
    act(() =>
      handlers["move_confirm"]!({
        type: "move_confirm",
        pieceId: "wp",
        from: pos(0, 1),
        to: pos(0, 0),
        seq: 1,
        promotionType: "rook",
      }),
    );

    const promoted = result.current.gameState.pieces.find(
      (p) => p.id === "wp",
    )!;
    expect(promoted.type).toBe("rook");
    expect(promoted.position).toEqual(pos(0, 0));
    expect(result.current.gameState.moves[0]!.wasPromotion).toBe(true);
  });
});

// ── Rematch state machine ─────────────────────────────────────────────────────

describe("useP2PGame — rematch state machine", () => {
  it("handleRematch sends a request and moves to 'requested'", () => {
    const { result, raw } = setup({ role: "guest" });
    act(() => result.current.handleRematch());
    expect(raw.sendRematchRequest).toHaveBeenCalledTimes(1);
    expect(raw.sendRematchRequest).toHaveBeenCalledWith({
      type: "rematch_request",
    });
    expect(result.current.rematchState).toBe("requested");
  });

  it("incoming rematch_request moves the host to 'offered'", () => {
    const { handlers, result } = setup({ role: "host" });
    act(() => handlers["rematch_request"]!({ type: "rematch_request" }));
    expect(result.current.rematchState).toBe("offered");
  });

  it("incoming rematch_request moves the guest to 'offered'", () => {
    const { handlers, result } = setup({ role: "guest" });
    act(() => handlers["rematch_request"]!({ type: "rematch_request" }));
    expect(result.current.rematchState).toBe("offered");
  });

  it("handleAcceptRematch as host broadcasts fresh pieces and resets the game", () => {
    // handleAcceptRematch does not require the "offered" state internally —
    // the GameOver modal is responsible for only showing the button then.
    const { result, raw, chessResetSpy } = setup({ role: "host" });
    act(() => result.current.handleAcceptRematch());

    expect(raw.sendRematchStart).toHaveBeenCalledTimes(1);
    const sent = raw.sendRematchStart.mock.calls[0]![0];
    expect(sent.type).toBe("rematch_start");
    expect(sent.pieces).toHaveLength(32); // standard classic board
    expect(chessResetSpy).toHaveBeenCalledTimes(1);
    expect(chessResetSpy).toHaveBeenCalledWith(sent.pieces);
    expect(result.current.gameState.pieces).toBe(sent.pieces);
    expect(result.current.gameState.currentTurn).toBe("white");
    expect(result.current.rematchState).toBe("idle");
    expect(result.current.seqRef.current).toBe(0);
    expect(raw.sendRematchAccept).not.toHaveBeenCalled();
  });

  it("incoming rematch_accept (host) broadcasts a reset and zeroes the seq", () => {
    const { handlers, result, raw, chessResetSpy } = hostRookSetup();
    // Play one confirmed move first so seq is non-zero.
    act(() => handlers["move_proposal"]!(ROOK_PROPOSAL));
    expect(result.current.seqRef.current).toBe(1);

    act(() => handlers["rematch_accept"]!({ type: "rematch_accept" }));

    expect(raw.sendRematchStart).toHaveBeenCalledTimes(1);
    const sent = raw.sendRematchStart.mock.calls[0]![0];
    expect(sent.pieces).toHaveLength(32);
    expect(chessResetSpy).toHaveBeenCalledWith(sent.pieces);
    expect(result.current.gameState.pieces).toBe(sent.pieces);
    expect(result.current.seqRef.current).toBe(0);
    expect(result.current.rematchState).toBe("idle");
  });

  it("handleAcceptRematch as guest sends rematch_accept and moves to 'starting'", () => {
    const { handlers, result, raw, chessResetSpy } = setup({ role: "guest" });
    act(() => handlers["rematch_request"]!({ type: "rematch_request" }));
    act(() => result.current.handleAcceptRematch());

    expect(raw.sendRematchAccept).toHaveBeenCalledTimes(1);
    expect(raw.sendRematchAccept).toHaveBeenCalledWith({
      type: "rematch_accept",
    });
    expect(raw.sendRematchStart).not.toHaveBeenCalled();
    expect(chessResetSpy).not.toHaveBeenCalled();
    expect(result.current.rematchState).toBe("starting");
  });

  it("incoming rematch_start (guest) resets with the host's pieces, seq and peerLeft", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { handlers, result, chessResetSpy, getPeerLeaveCb } =
      guestRookSetup();
    // Dirty everything first: a confirmed move and a peer-left flag.
    act(() =>
      handlers["move_confirm"]!({
        type: "move_confirm",
        pieceId: "wr",
        from: pos(0, 5),
        to: pos(0, 3),
        seq: 1,
      }),
    );
    act(() => getPeerLeaveCb()!());
    expect(result.current.seqRef.current).toBe(1);
    expect(result.current.peerLeft).toBe(true);

    const fresh = twoKings();
    act(() =>
      handlers["rematch_start"]!({ type: "rematch_start", pieces: fresh }),
    );

    expect(chessResetSpy).toHaveBeenCalledWith(fresh);
    expect(result.current.gameState.pieces).toBe(fresh);
    expect(result.current.gameState.currentTurn).toBe("white");
    expect(result.current.seqRef.current).toBe(0);
    expect(result.current.peerLeft).toBe(false);
    expect(result.current.rematchState).toBe("idle");
  });

  it("handleDeclineRematch sends a decline and returns to 'idle'", () => {
    const { handlers, result, raw } = setup({ role: "guest" });
    act(() => handlers["rematch_request"]!({ type: "rematch_request" }));
    expect(result.current.rematchState).toBe("offered");

    act(() => result.current.handleDeclineRematch());
    expect(raw.sendRematchDecline).toHaveBeenCalledTimes(1);
    expect(raw.sendRematchDecline).toHaveBeenCalledWith({
      type: "rematch_decline",
    });
    expect(result.current.rematchState).toBe("idle");
  });

  it("incoming rematch_decline cancels a pending request", () => {
    const { handlers, result } = setup({ role: "host" });
    act(() => result.current.handleRematch());
    expect(result.current.rematchState).toBe("requested");

    act(() => handlers["rematch_decline"]!({ type: "rematch_decline" }));
    expect(result.current.rematchState).toBe("idle");
  });

  it("allows re-requesting a rematch after a decline", () => {
    const { handlers, result, raw } = setup({ role: "host" });
    act(() => result.current.handleRematch());
    act(() => handlers["rematch_decline"]!({ type: "rematch_decline" }));
    expect(result.current.rematchState).toBe("idle");

    act(() => result.current.handleRematch());
    expect(result.current.rematchState).toBe("requested");
    expect(raw.sendRematchRequest).toHaveBeenCalledTimes(2);
  });
});

// ── Resign ────────────────────────────────────────────────────────────────────

describe("useP2PGame — resign", () => {
  it("host receiving resign wins as white, surrenderedBy black", () => {
    const { handlers, result } = setup({ role: "host" }); // playerColor white
    act(() => handlers["resign"]!({ type: "resign" }));

    const state = result.current.gameState;
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe("white");
    expect(state.surrenderedBy).toBe("black");
  });

  it("guest receiving resign wins as black, surrenderedBy white", () => {
    const { handlers, result } = setup({ role: "guest" }); // playerColor black
    act(() => handlers["resign"]!({ type: "resign" }));

    const state = result.current.gameState;
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe("black");
    expect(state.surrenderedBy).toBe("white");
  });

  it("ignores a resign when playerColor is null (INFO-003 fixed)", () => {
    const { handlers, result } = setup({ role: "host", playerColor: null });
    const before = result.current.gameState;
    act(() => handlers["resign"]!({ type: "resign" }));

    const state = result.current.gameState;
    expect(state.gameOver).toBe(before.gameOver); // unchanged
    expect(state.winner).toBe(before.winner); // unchanged
  });
});

// ── Peer leave ────────────────────────────────────────────────────────────────

describe("useP2PGame — peer leave", () => {
  it("sets peerLeft when the room reports a peer leaving", () => {
    const { result, getPeerLeaveCb } = setup({ role: "guest" });
    expect(result.current.peerLeft).toBe(false);

    act(() => getPeerLeaveCb()!());
    expect(result.current.peerLeft).toBe(true);
  });
});

// ── INTEGRATION: full resync loop ────────────────────────────────────────────

describe("useP2PGame — integration: full resync loop", () => {
  it("re-aligns guest state after unknown pieceId triggers a resync round-trip", () => {
    // ── 1. Mount host ──────────────────────────────────────────────────────
    // Host has both kings + a black rook.  Black's turn so the host confirms
    // the rook's move and advances seq to 1.
    const hostSetup = setup({
      role: "host",
      pieces: [
        ...twoKings(),
        makePiece("black", "rook", 0, 3, { id: "br" }),
      ],
      stateOverrides: { currentTurn: "black" },
    });
    // Have the host confirm one legal move so seq and pieces are non-trivial.
    act(() =>
      hostSetup.handlers["move_proposal"]!(ROOK_PROPOSAL),
    );
    expect(hostSetup.result.current.seqRef.current).toBe(1);
    // Host state: rook has moved to (0,5).
    const hostRookAfterMove = hostSetup.result.current.gameState.pieces.find(
      (p) => p.id === "br",
    )!;
    expect(hostRookAfterMove.position).toEqual(pos(0, 5));

    // ── 2. Mount guest with a diverged state ───────────────────────────────
    // Guest is missing the rook entirely, so any move_confirm referencing
    // "br" will be an unknown pieceId and trigger a resync request.
    const guestSetup = setup({
      role: "guest",
      pieces: twoKings(), // diverged: rook absent from guest state
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // ── 3. Send a move_confirm with an unknown pieceId to the guest ────────
    act(() =>
      guestSetup.handlers["move_confirm"]!({
        type: "move_confirm",
        pieceId: "br", // unknown on the guest side
        from: pos(0, 3),
        to: pos(0, 5),
        seq: 1,
      }),
    );

    // ── 4. Verify guest called sendSyncRequest and seqRef stayed at 0 ─────
    expect(guestSetup.raw.sendSyncRequest).toHaveBeenCalledTimes(1);
    expect(guestSetup.raw.sendSyncRequest).toHaveBeenCalledWith({
      type: "sync_request",
    });
    expect(guestSetup.result.current.seqRef.current).toBe(0);
    expect(guestSetup.result.current.gameState.pieces).toHaveLength(
      twoKings().length,
    );

    // ── 5. Host receives the sync_request ─────────────────────────────────
    act(() =>
      hostSetup.handlers["sync_request"]!({ type: "sync_request" }),
    );

    // ── 6. Capture what the host sent via sendSyncState ───────────────────
    expect(hostSetup.raw.sendSyncState).toHaveBeenCalledTimes(1);
    const syncMsg = hostSetup.raw.sendSyncState.mock
      .calls[0]![0] as SyncStateMessage;
    expect(syncMsg.type).toBe("sync_state");
    expect(syncMsg.seq).toBe(1);
    expect(syncMsg.pieces).toHaveLength(
      hostSetup.result.current.gameState.pieces.length,
    );

    // ── 7. Inject the sync_state into the guest ────────────────────────────
    act(() => guestSetup.handlers["sync_state"]!(syncMsg));

    // ── 8. Guest state now matches the host ───────────────────────────────
    const guestState = guestSetup.result.current.gameState;
    const hostState = hostSetup.result.current.gameState;
    expect(guestState.pieces).toHaveLength(hostState.pieces.length);
    // seq aligned
    expect(guestSetup.result.current.seqRef.current).toBe(1);
    // Turn and check status aligned with host
    expect(guestState.currentTurn).toBe(hostState.currentTurn);
    expect(guestState.isCheck).toBe(hostState.isCheck);
    // The rook that was unknown to the guest is now present at (0,5)
    const guestRook = guestState.pieces.find((p) => p.id === "br");
    expect(guestRook).toBeDefined();
    expect(guestRook!.position).toEqual(pos(0, 5));
    // Positions for every shared piece match between host and guest
    for (const hp of hostState.pieces) {
      const gp = guestState.pieces.find((p) => p.id === hp.id);
      expect(gp).toBeDefined();
      expect(gp!.position).toEqual(hp.position);
    }

    errorSpy.mockRestore();
  });

  it("re-aligns guest state after an illegal move triggers a resync round-trip", () => {
    // ── 1. Mount host ──────────────────────────────────────────────────────
    // Host has both kings + a white rook.  White's turn; after setup the host
    // confirms a legal rook move along the file (seq → 1, rook at (0,3)).
    const hostSetup = setup({
      role: "host",
      pieces: [
        ...twoKings(),
        makePiece("black", "rook", 0, 3, { id: "br2" }),
      ],
      stateOverrides: { currentTurn: "black" },
    });
    // Confirm one legal proposal so the host's seq advances.
    act(() =>
      hostSetup.handlers["move_proposal"]!({
        type: "move_proposal",
        pieceId: "br2",
        from: pos(0, 3),
        to: pos(0, 6),
      }),
    );
    expect(hostSetup.result.current.seqRef.current).toBe(1);
    const hostRookPos = hostSetup.result.current.gameState.pieces.find(
      (p) => p.id === "br2",
    )!.position;
    expect(hostRookPos).toEqual(pos(0, 6));

    // ── 2. Mount guest with a white rook that can validate moves ───────────
    // Guest has both kings + a white rook at (0,5).  The host will send a
    // move_confirm asking the rook to move diagonally — illegal for a rook —
    // so the guest must request a resync.
    const guestSetup = setup({
      role: "guest",
      pieces: [
        ...twoKings(),
        makePiece("white", "rook", 0, 5, { id: "wr2" }),
      ],
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // ── 3. Send an illegal move_confirm to the guest ───────────────────────
    // Moving a rook diagonally (0,5) → (1,4) is not in valid moves.
    act(() =>
      guestSetup.handlers["move_confirm"]!({
        type: "move_confirm",
        pieceId: "wr2",
        from: pos(0, 5),
        to: pos(1, 4), // diagonal — illegal for a rook
        seq: 1,
      }),
    );

    // ── 4. Guest calls sendSyncRequest; state and seqRef unchanged ─────────
    expect(guestSetup.raw.sendSyncRequest).toHaveBeenCalledTimes(1);
    expect(guestSetup.raw.sendSyncRequest).toHaveBeenCalledWith({
      type: "sync_request",
    });
    expect(guestSetup.result.current.seqRef.current).toBe(0);
    const guestPiecesBefore = guestSetup.result.current.gameState.pieces;
    const rookBefore = guestPiecesBefore.find((p) => p.id === "wr2")!;
    expect(rookBefore.position).toEqual(pos(0, 5)); // position untouched

    // ── 5. Host receives sync_request and sends sync_state ────────────────
    act(() =>
      hostSetup.handlers["sync_request"]!({ type: "sync_request" }),
    );
    expect(hostSetup.raw.sendSyncState).toHaveBeenCalledTimes(1);
    const syncMsg = hostSetup.raw.sendSyncState.mock
      .calls[0]![0] as SyncStateMessage;
    expect(syncMsg.seq).toBe(1);
    expect(syncMsg.pieces).toHaveLength(
      hostSetup.result.current.gameState.pieces.length,
    );

    // ── 6. Inject sync_state into the guest ───────────────────────────────
    act(() => guestSetup.handlers["sync_state"]!(syncMsg));

    // ── 7. Guest state now reflects the host's authoritative snapshot ──────
    const guestState = guestSetup.result.current.gameState;
    const hostState = hostSetup.result.current.gameState;
    // Same number of pieces.
    expect(guestState.pieces).toHaveLength(hostState.pieces.length);
    // seq counter aligned with host.
    expect(guestSetup.result.current.seqRef.current).toBe(1);
    // Turn and check status aligned with host
    expect(guestState.currentTurn).toBe(hostState.currentTurn);
    expect(guestState.isCheck).toBe(hostState.isCheck);
    // Every host piece is present at the correct position on the guest side.
    for (const hp of hostState.pieces) {
      const gp = guestState.pieces.find((p) => p.id === hp.id);
      expect(gp).toBeDefined();
      expect(gp!.position).toEqual(hp.position);
    }
    // The divergent white rook that was never on the host is gone.
    expect(guestState.pieces.find((p) => p.id === "wr2")).toBeUndefined();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
