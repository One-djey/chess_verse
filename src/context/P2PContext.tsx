import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";
import type { Room } from "@trystero-p2p/core";
import { P2PConnectionState, P2PRole } from "../types/p2p";
import { PieceColor, GameMode, Piece } from "../types/chess";
import { joinRoom, makeRoomActions } from "../services/TrysteroService";
import { getInitialPieces } from "../utils/chess";
import { PieceSkin } from "../utils/pieceImage";

interface P2PContextValue {
  isP2PMode: boolean;
  role: P2PRole | null;
  playerColor: PieceColor | null;
  connectionState: P2PConnectionState;
  gameMode: GameMode | null;
  initialPieces: Piece[] | null;
  peerSkin: PieceSkin | null;
  room: Room | null;
  actions: ReturnType<typeof makeRoomActions> | null;
  startRoom: (
    roomId: string,
    mode: GameMode,
    skin: PieceSkin,
    onConnected: () => void,
  ) => void;
  joinExistingRoom: (
    roomId: string,
    skin: PieceSkin,
    onConnected: () => void,
  ) => void;
  leaveRoom: () => void;
}

const P2PContext = createContext<P2PContextValue | null>(null);

export function P2PProvider({ children }: { children: React.ReactNode }) {
  const [isP2PMode, setIsP2PMode] = useState(false);
  const [role, setRole] = useState<P2PRole | null>(null);
  const [playerColor, setPlayerColor] = useState<PieceColor | null>(null);
  const [connectionState, setConnectionState] =
    useState<P2PConnectionState>("idle");
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [initialPieces, setInitialPieces] = useState<Piece[] | null>(null);
  const [peerSkin, setPeerSkin] = useState<PieceSkin | null>(null);

  const roomRef = useRef<Room | null>(null);
  const actionsRef = useRef<ReturnType<typeof makeRoomActions> | null>(null);
  const [, forceUpdate] = useState(0);

  /**
   * HOST: creates room, registers onGuestReady + onPeerJoin SYNCHRONOUSLY.
   * Sends sync_state + color_assign (with hostSkin) on peer join.
   * Navigates only after receiving guest_ready (which carries guestSkin).
   */
  const startRoom = useCallback(
    (
      roomId: string,
      mode: GameMode,
      skin: PieceSkin,
      onConnected: () => void,
    ) => {
      const room = joinRoom(roomId);
      const actions = makeRoomActions(room);
      roomRef.current = room;
      actionsRef.current = actions;

      setRole("host");
      setPlayerColor("white");
      setGameMode(mode);
      setIsP2PMode(true);
      setConnectionState("waiting");
      forceUpdate((n) => n + 1);

      // Update peer skin whenever guest_ready arrives (non-blocking)
      actions.onGuestReady((msg) => {
        setPeerSkin(msg.skin);
      });

      room.onPeerJoin(() => {
        const pieces = getInitialPieces(mode);
        setInitialPieces(pieces);
        setConnectionState("connected");

        actions.sendSyncState({ type: "sync_state", pieces, seq: 0 });
        actions.sendColorAssign({
          type: "color_assign",
          hostColor: "white",
          guestColor: "black",
          gameMode: mode,
          hostSkin: skin,
        });

        onConnected();
      });

      room.onPeerLeave(() => setConnectionState("disconnected"));
    },
    [],
  );

  /**
   * GUEST: joins room, registers onColorAssign + onSyncState SYNCHRONOUSLY.
   * Reads hostSkin from color_assign → setPeerSkin.
   * Sends guest_ready (with own skin) just before navigating.
   */
  const joinExistingRoom = useCallback(
    (roomId: string, skin: PieceSkin, onConnected: () => void) => {
      const room = joinRoom(roomId);
      const actions = makeRoomActions(room);
      roomRef.current = room;
      actionsRef.current = actions;

      setRole("guest");
      setPlayerColor(null);
      setIsP2PMode(true);
      setConnectionState("connecting");
      forceUpdate((n) => n + 1);

      const received = { color: false, sync: false };
      const navigatedRef = { value: false };

      const tryNavigate = () => {
        if (received.color && received.sync && !navigatedRef.value) {
          navigatedRef.value = true;
          actions.sendGuestReady({ type: "guest_ready", skin });
          onConnected();
        }
      };

      actions.onColorAssign((msg) => {
        setPlayerColor(msg.guestColor);
        setGameMode(msg.gameMode);
        setPeerSkin(msg.hostSkin);
        setConnectionState("connected");
        received.color = true;
        tryNavigate();
      });

      actions.onSyncState((msg) => {
        setInitialPieces(msg.pieces);
        received.sync = true;
        tryNavigate();
      });

      room.onPeerLeave(() => setConnectionState("disconnected"));
    },
    [],
  );

  const leaveRoom = useCallback(() => {
    roomRef.current?.leave();
    roomRef.current = null;
    actionsRef.current = null;
    setIsP2PMode(false);
    setRole(null);
    setPlayerColor(null);
    setConnectionState("idle");
    setGameMode(null);
    setInitialPieces(null);
    setPeerSkin(null);
    forceUpdate((n) => n + 1);
  }, []);

  return (
    <P2PContext.Provider
      value={{
        isP2PMode,
        role,
        playerColor,
        connectionState,
        gameMode,
        initialPieces,
        peerSkin,
        room: roomRef.current,
        actions: actionsRef.current,
        startRoom,
        joinExistingRoom,
        leaveRoom,
      }}
    >
      {children}
    </P2PContext.Provider>
  );
}

export function useP2P(): P2PContextValue {
  const ctx = useContext(P2PContext);
  if (!ctx) throw new Error("useP2P must be used inside P2PProvider");
  return ctx;
}
