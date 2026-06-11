// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useContext } from "react";
import type { GameMode } from "../types/chess";
import { CLASSIC, makePiece } from "../test/helpers";

type Handler = (data: unknown, peerId: string) => void;

// ── TrysteroService mock ──────────────────────────────────────────────────────
// joinRoom rend une room factice qui capture les abonnements onPeerJoin /
// onPeerLeave ; makeRoomActions rend un objet d'actions dont les onX capturent
// les handlers (par nom de message) et dont les sendX sont des spies.
const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, Handler[]>,
  peerJoin: [] as Array<() => void>,
  peerLeave: [] as Array<() => void>,
  room: null as unknown,
  actions: null as unknown,
}));

vi.mock("../services/TrysteroService", () => ({
  joinRoom: vi.fn(() => mocks.room),
  makeRoomActions: vi.fn(() => mocks.actions),
}));

import { P2PContext, P2PProvider } from "./P2PContext";
import { joinRoom } from "../services/TrysteroService";

function createMockRoom() {
  return {
    onPeerJoin: vi.fn((cb: () => void) => {
      mocks.peerJoin.push(cb);
    }),
    onPeerLeave: vi.fn((cb: () => void) => {
      mocks.peerLeave.push(cb);
    }),
    leave: vi.fn(),
  };
}

function createMockActions() {
  const on = (name: string) =>
    vi.fn((cb: Handler) => {
      if (!mocks.handlers[name]) mocks.handlers[name] = [];
      mocks.handlers[name].push(cb);
    });
  return {
    sendMoveProposal: vi.fn(),
    onMoveProposal: on("move_proposal"),
    sendMoveConfirm: vi.fn(),
    onMoveConfirm: on("move_confirm"),
    sendMoveReject: vi.fn(),
    onMoveReject: on("move_reject"),
    sendColorAssign: vi.fn(),
    onColorAssign: on("color_assign"),
    sendSyncState: vi.fn(),
    onSyncState: on("sync_state"),
    sendResign: vi.fn(),
    onResign: on("resign"),
    sendRematchRequest: vi.fn(),
    onRematchRequest: on("rematch_request"),
    sendRematchAccept: vi.fn(),
    onRematchAccept: on("rematch_accept"),
    sendRematchDecline: vi.fn(),
    onRematchDecline: on("rematch_decline"),
    sendRematchStart: vi.fn(),
    onRematchStart: on("rematch_start"),
    sendGuestReady: vi.fn(),
    onGuestReady: on("guest_ready"),
    sendArenaInit: vi.fn(),
    onArenaInit: on("arena_init"),
  };
}

let room: ReturnType<typeof createMockRoom>;
let actions: ReturnType<typeof createMockActions>;

beforeEach(() => {
  mocks.handlers = {};
  mocks.peerJoin = [];
  mocks.peerLeave = [];
  room = createMockRoom();
  actions = createMockActions();
  mocks.room = room;
  mocks.actions = actions;
  vi.mocked(joinRoom).mockClear();
});

afterEach(() => {
  cleanup();
});

function renderP2P() {
  return renderHook(
    () => {
      const ctx = useContext(P2PContext);
      if (!ctx) throw new Error("P2PContext missing");
      return ctx;
    },
    { wrapper: P2PProvider },
  );
}

/** Simule l'arrivée d'un pair dans la room. */
function emitPeerJoin() {
  act(() => {
    mocks.peerJoin.forEach((cb) => cb());
  });
}

/** Simule le départ du pair. */
function emitPeerLeave() {
  act(() => {
    mocks.peerLeave.forEach((cb) => cb());
  });
}

/** Délivre un message P2P à tous les handlers enregistrés pour ce type. */
function deliver(name: string, msg: unknown) {
  act(() => {
    (mocks.handlers[name] ?? []).forEach((cb) => cb(msg, "peer-1"));
  });
}

const COLISEUM: GameMode = {
  id: "coliseum",
  title: "coliseum",
  description: "",
  image: "",
  rules: { coliseum: true },
};

const GUEST_PIECES = [
  makePiece("white", "king", 4, 7),
  makePiece("black", "king", 4, 0),
];

const FAKE_ARENA = { cells: [], pieces: [] } as unknown;

describe("initial state", () => {
  it("exposes idle defaults before any room is created", () => {
    const { result } = renderP2P();
    expect(result.current.isP2PMode).toBe(false);
    expect(result.current.connectionState).toBe("idle");
    expect(result.current.role).toBeNull();
    expect(result.current.playerColor).toBeNull();
    expect(result.current.gameMode).toBeNull();
    expect(result.current.initialPieces).toBeNull();
    expect(result.current.initialArena).toBeNull();
    expect(result.current.peerSkin).toBeNull();
    expect(result.current.room).toBeNull();
    expect(result.current.actions).toBeNull();
  });
});

describe("startRoom (host)", () => {
  it("joins the room and enters host/white/waiting state", () => {
    const { result } = renderP2P();
    act(() => {
      result.current.startRoom("room-1", CLASSIC, "classic", vi.fn());
    });

    expect(joinRoom).toHaveBeenCalledWith("room-1");
    expect(result.current.role).toBe("host");
    expect(result.current.playerColor).toBe("white");
    expect(result.current.connectionState).toBe("waiting");
    expect(result.current.isP2PMode).toBe(true);
    expect(result.current.gameMode).toBe(CLASSIC);
    expect(result.current.room).toBe(room);
    expect(result.current.actions).toBe(actions);
  });

  it("sends nothing and stays waiting until a peer joins", () => {
    const onConnected = vi.fn();
    const { result } = renderP2P();
    act(() => {
      result.current.startRoom("room-1", CLASSIC, "classic", onConnected);
    });

    expect(actions.sendSyncState).not.toHaveBeenCalled();
    expect(actions.sendColorAssign).not.toHaveBeenCalled();
    expect(onConnected).not.toHaveBeenCalled();
    expect(result.current.initialPieces).toBeNull();
    // Handlers enregistrés de façon synchrone dès startRoom.
    expect(mocks.peerJoin).toHaveLength(1);
    expect(mocks.handlers["guest_ready"]).toHaveLength(1);
  });

  it("on peer join: connects, sends sync_state + color_assign (with hostSkin) and fires onConnected", () => {
    const onConnected = vi.fn();
    const { result } = renderP2P();
    act(() => {
      result.current.startRoom("room-1", CLASSIC, "fantasy", onConnected);
    });
    emitPeerJoin();

    expect(result.current.connectionState).toBe("connected");
    expect(onConnected).toHaveBeenCalledTimes(1);

    expect(actions.sendSyncState).toHaveBeenCalledTimes(1);
    const syncPayload = actions.sendSyncState.mock.calls[0][0] as {
      type: string;
      pieces: unknown[];
      seq: number;
    };
    expect(syncPayload.type).toBe("sync_state");
    expect(syncPayload.seq).toBe(0);
    expect(syncPayload.pieces).toHaveLength(32); // plateau classique complet

    expect(actions.sendColorAssign).toHaveBeenCalledWith({
      type: "color_assign",
      hostColor: "white",
      guestColor: "black",
      hostSkin: "fantasy",
    });

    // Les pièces exposées au reste de l'app sont celles envoyées au guest.
    expect(result.current.initialPieces).toBe(syncPayload.pieces);
    expect(result.current.initialArena).toBeNull();
  });

  it("records the guest skin when guest_ready arrives", () => {
    const { result } = renderP2P();
    act(() => {
      result.current.startRoom("room-1", CLASSIC, "classic", vi.fn());
    });
    emitPeerJoin();
    expect(result.current.peerSkin).toBeNull();

    deliver("guest_ready", { type: "guest_ready", skin: "fantasy" });
    expect(result.current.peerSkin).toBe("fantasy");
  });

  it("coliseum mode: generates an arena, sends arena_init before sync_state", () => {
    const { result } = renderP2P();
    act(() => {
      result.current.startRoom("room-1", COLISEUM, "classic", vi.fn());
    });
    emitPeerJoin();

    expect(actions.sendArenaInit).toHaveBeenCalledTimes(1);
    const arenaPayload = actions.sendArenaInit.mock.calls[0][0] as {
      type: string;
      arena: unknown;
    };
    expect(arenaPayload.type).toBe("arena_init");
    expect(result.current.initialArena).toBe(arenaPayload.arena);

    // arena_init part avant sync_state (le guest l'attend en premier).
    const arenaOrder = actions.sendArenaInit.mock.invocationCallOrder[0];
    const syncOrder = actions.sendSyncState.mock.invocationCallOrder[0];
    expect(arenaOrder).toBeLessThan(syncOrder);

    // Les pièces synchronisées proviennent de la conversion de l'arène.
    const syncPayload = actions.sendSyncState.mock.calls[0][0] as {
      pieces: unknown[];
    };
    expect(syncPayload.pieces.length).toBeGreaterThan(0);
    expect(result.current.initialPieces).toBe(syncPayload.pieces);
  });

  it("peer leave after connection → disconnected", () => {
    const { result } = renderP2P();
    act(() => {
      result.current.startRoom("room-1", CLASSIC, "classic", vi.fn());
    });
    emitPeerJoin();
    expect(result.current.connectionState).toBe("connected");

    emitPeerLeave();
    expect(result.current.connectionState).toBe("disconnected");
  });
});

describe("joinExistingRoom (guest)", () => {
  it("joins the room and enters guest/connecting state without a color", () => {
    const { result } = renderP2P();
    act(() => {
      result.current.joinExistingRoom("room-2", CLASSIC, "classic", vi.fn());
    });

    expect(joinRoom).toHaveBeenCalledWith("room-2");
    expect(result.current.role).toBe("guest");
    expect(result.current.connectionState).toBe("connecting");
    expect(result.current.playerColor).toBeNull();
    expect(result.current.isP2PMode).toBe(true);
    expect(actions.sendGuestReady).not.toHaveBeenCalled();
  });

  it("classic, color_assign then sync_state: handshake completes after both messages", () => {
    const onConnected = vi.fn();
    const { result } = renderP2P();
    act(() => {
      result.current.joinExistingRoom("room-2", CLASSIC, "fantasy", onConnected);
    });

    deliver("color_assign", {
      type: "color_assign",
      hostColor: "white",
      guestColor: "black",
      hostSkin: "classic",
    });
    // NOTE: comportement actuel — le guest passe "connected" dès color_assign,
    // avant même que la triple poignée de main soit complète.
    expect(result.current.connectionState).toBe("connected");
    expect(result.current.playerColor).toBe("black");
    expect(result.current.peerSkin).toBe("classic");
    expect(onConnected).not.toHaveBeenCalled();
    expect(actions.sendGuestReady).not.toHaveBeenCalled();

    deliver("sync_state", { type: "sync_state", pieces: GUEST_PIECES, seq: 0 });
    expect(result.current.initialPieces).toBe(GUEST_PIECES);
    expect(actions.sendGuestReady).toHaveBeenCalledTimes(1);
    expect(actions.sendGuestReady).toHaveBeenCalledWith({
      type: "guest_ready",
      skin: "fantasy",
    });
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("classic, sync_state then color_assign (reversed order): only ready after the second message", () => {
    const onConnected = vi.fn();
    const { result } = renderP2P();
    act(() => {
      result.current.joinExistingRoom("room-2", CLASSIC, "classic", onConnected);
    });

    deliver("sync_state", { type: "sync_state", pieces: GUEST_PIECES, seq: 0 });
    expect(result.current.initialPieces).toBe(GUEST_PIECES);
    expect(result.current.connectionState).toBe("connecting");
    expect(onConnected).not.toHaveBeenCalled();
    expect(actions.sendGuestReady).not.toHaveBeenCalled();

    deliver("color_assign", {
      type: "color_assign",
      hostColor: "white",
      guestColor: "black",
      hostSkin: "classic",
    });
    expect(result.current.playerColor).toBe("black");
    expect(actions.sendGuestReady).toHaveBeenCalledTimes(1);
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("non-coliseum mode does not register an arena_init handler (arena pre-marked received)", () => {
    const { result } = renderP2P();
    act(() => {
      result.current.joinExistingRoom("room-2", CLASSIC, "classic", vi.fn());
    });
    expect(actions.onArenaInit).not.toHaveBeenCalled();
    expect(mocks.handlers["arena_init"]).toBeUndefined();
    expect(result.current.initialArena).toBeNull();
  });

  it("coliseum: color_assign + sync_state alone are NOT enough — arena_init completes the handshake", () => {
    const onConnected = vi.fn();
    const { result } = renderP2P();
    act(() => {
      result.current.joinExistingRoom("room-2", COLISEUM, "classic", onConnected);
    });

    deliver("color_assign", {
      type: "color_assign",
      hostColor: "white",
      guestColor: "black",
      hostSkin: "classic",
    });
    deliver("sync_state", { type: "sync_state", pieces: GUEST_PIECES, seq: 0 });
    expect(onConnected).not.toHaveBeenCalled();
    expect(actions.sendGuestReady).not.toHaveBeenCalled();

    deliver("arena_init", { type: "arena_init", arena: FAKE_ARENA });
    expect(result.current.initialArena).toBe(FAKE_ARENA);
    expect(actions.sendGuestReady).toHaveBeenCalledTimes(1);
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("coliseum, arena_init → sync_state → color_assign: handshake fires only on the last message", () => {
    const onConnected = vi.fn();
    const { result } = renderP2P();
    act(() => {
      result.current.joinExistingRoom("room-2", COLISEUM, "fantasy", onConnected);
    });

    deliver("arena_init", { type: "arena_init", arena: FAKE_ARENA });
    expect(onConnected).not.toHaveBeenCalled();

    deliver("sync_state", { type: "sync_state", pieces: GUEST_PIECES, seq: 0 });
    expect(onConnected).not.toHaveBeenCalled();
    expect(actions.sendGuestReady).not.toHaveBeenCalled();

    deliver("color_assign", {
      type: "color_assign",
      hostColor: "white",
      guestColor: "black",
      hostSkin: "fantasy",
    });
    expect(result.current.initialArena).toBe(FAKE_ARENA);
    expect(result.current.initialPieces).toBe(GUEST_PIECES);
    expect(result.current.playerColor).toBe("black");
    expect(result.current.peerSkin).toBe("fantasy");
    expect(actions.sendGuestReady).toHaveBeenCalledWith({
      type: "guest_ready",
      skin: "fantasy",
    });
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("duplicate messages: guest_ready and onConnected fire exactly once", () => {
    const onConnected = vi.fn();
    const { result } = renderP2P();
    act(() => {
      result.current.joinExistingRoom("room-2", CLASSIC, "classic", onConnected);
    });

    const colorMsg = {
      type: "color_assign",
      hostColor: "white",
      guestColor: "black",
      hostSkin: "classic",
    };
    const syncMsg = { type: "sync_state", pieces: GUEST_PIECES, seq: 0 };

    deliver("color_assign", colorMsg);
    deliver("sync_state", syncMsg);
    deliver("sync_state", syncMsg);
    deliver("color_assign", colorMsg);

    expect(actions.sendGuestReady).toHaveBeenCalledTimes(1);
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("peer leave on guest side → disconnected", () => {
    const { result } = renderP2P();
    act(() => {
      result.current.joinExistingRoom("room-2", CLASSIC, "classic", vi.fn());
    });
    emitPeerLeave();
    expect(result.current.connectionState).toBe("disconnected");
  });
});

describe("leaveRoom", () => {
  it("calls room.leave() and resets the whole context to idle", () => {
    const { result } = renderP2P();
    act(() => {
      result.current.startRoom("room-1", CLASSIC, "fantasy", vi.fn());
    });
    emitPeerJoin();
    deliver("guest_ready", { type: "guest_ready", skin: "classic" });
    expect(result.current.connectionState).toBe("connected");

    act(() => {
      result.current.leaveRoom();
    });

    expect(room.leave).toHaveBeenCalledTimes(1);
    expect(result.current.isP2PMode).toBe(false);
    expect(result.current.role).toBeNull();
    expect(result.current.playerColor).toBeNull();
    expect(result.current.connectionState).toBe("idle");
    expect(result.current.gameMode).toBeNull();
    expect(result.current.initialPieces).toBeNull();
    expect(result.current.initialArena).toBeNull();
    expect(result.current.peerSkin).toBeNull();
    expect(result.current.room).toBeNull();
    expect(result.current.actions).toBeNull();
  });

  it("is safe to call when no room was ever created", () => {
    const { result } = renderP2P();
    act(() => {
      result.current.leaveRoom();
    });
    expect(result.current.connectionState).toBe("idle");
    expect(room.leave).not.toHaveBeenCalled();
  });
});
