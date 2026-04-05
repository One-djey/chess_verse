import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import type { Room } from '@trystero-p2p/core';
import { P2PConnectionState, P2PRole } from '../types/p2p';
import { PieceColor, GameMode, Piece } from '../types/chess';
import { joinRoom, makeRoomActions } from '../services/TrysteroService';
import { getInitialPieces } from '../utils/chess';

interface P2PContextValue {
  isP2PMode: boolean;
  role: P2PRole | null;
  playerColor: PieceColor | null;
  connectionState: P2PConnectionState;
  gameMode: GameMode | null;
  initialPieces: Piece[] | null;
  room: Room | null;
  actions: ReturnType<typeof makeRoomActions> | null;
  // onConnected callback is called (synchronously from Trystero event) when ready to navigate
  startRoom: (roomId: string, mode: GameMode, onConnected: () => void) => void;
  joinExistingRoom: (roomId: string, onConnected: () => void) => void;
  leaveRoom: () => void;
}

const P2PContext = createContext<P2PContextValue | null>(null);

export function P2PProvider({ children }: { children: React.ReactNode }) {
  const [isP2PMode, setIsP2PMode]           = useState(false);
  const [role, setRole]                     = useState<P2PRole | null>(null);
  const [playerColor, setPlayerColor]       = useState<PieceColor | null>(null);
  const [connectionState, setConnectionState] = useState<P2PConnectionState>('idle');
  const [gameMode, setGameMode]             = useState<GameMode | null>(null);
  const [initialPieces, setInitialPieces]   = useState<Piece[] | null>(null);

  const roomRef    = useRef<Room | null>(null);
  const actionsRef = useRef<ReturnType<typeof makeRoomActions> | null>(null);
  const [, forceUpdate] = useState(0);

  /**
   * HOST: creates room, registers onPeerJoin SYNCHRONOUSLY (no useEffect delay),
   * generates + sends sync_state/color_assign, then calls onConnected to navigate.
   */
  const startRoom = useCallback((roomId: string, mode: GameMode, onConnected: () => void) => {
    const room    = joinRoom(roomId);
    const actions = makeRoomActions(room);
    roomRef.current    = room;
    actionsRef.current = actions;

    setRole('host');
    setPlayerColor('white');
    setGameMode(mode);
    setIsP2PMode(true);
    setConnectionState('waiting');
    forceUpdate(n => n + 1);

    // Register IMMEDIATELY — before any React re-render so no message can be missed
    room.onPeerJoin(() => {
      const pieces = getInitialPieces(mode);
      setInitialPieces(pieces);
      setConnectionState('connected');

      // Send sync_state FIRST so guest has pieces before navigating
      actions.sendSyncState({ type: 'sync_state', pieces, seq: 0 });
      actions.sendColorAssign({
        type: 'color_assign',
        hostColor: 'white',
        guestColor: 'black',
        gameMode: mode,
      });

      onConnected();
    });

    room.onPeerLeave(() => setConnectionState('disconnected'));
  }, []);

  /**
   * GUEST: joins room, registers onColorAssign + onSyncState SYNCHRONOUSLY,
   * waits for both before calling onConnected to navigate.
   */
  const joinExistingRoom = useCallback((roomId: string, onConnected: () => void) => {
    const room    = joinRoom(roomId);
    const actions = makeRoomActions(room);
    roomRef.current    = room;
    actionsRef.current = actions;

    setRole('guest');
    setPlayerColor(null);
    setIsP2PMode(true);
    setConnectionState('connecting');
    forceUpdate(n => n + 1);

    // Register IMMEDIATELY — critical to avoid dropping messages
    const received = { color: false, sync: false };
    const navigatedRef = { value: false };

    const tryNavigate = () => {
      if (received.color && received.sync && !navigatedRef.value) {
        navigatedRef.value = true;
        onConnected();
      }
    };

    actions.onColorAssign((msg) => {
      setPlayerColor(msg.guestColor);
      setGameMode(msg.gameMode);
      setConnectionState('connected');
      received.color = true;
      tryNavigate();
    });

    actions.onSyncState((msg) => {
      setInitialPieces(msg.pieces);
      received.sync = true;
      tryNavigate();
    });

    room.onPeerLeave(() => setConnectionState('disconnected'));
  }, []);

  const leaveRoom = useCallback(() => {
    roomRef.current?.leave();
    roomRef.current    = null;
    actionsRef.current = null;
    setIsP2PMode(false);
    setRole(null);
    setPlayerColor(null);
    setConnectionState('idle');
    setGameMode(null);
    setInitialPieces(null);
    forceUpdate(n => n + 1);
  }, []);

  return (
    <P2PContext.Provider value={{
      isP2PMode,
      role,
      playerColor,
      connectionState,
      gameMode,
      initialPieces,
      room: roomRef.current,
      actions: actionsRef.current,
      startRoom,
      joinExistingRoom,
      leaveRoom,
    }}>
      {children}
    </P2PContext.Provider>
  );
}

export function useP2P(): P2PContextValue {
  const ctx = useContext(P2PContext);
  if (!ctx) throw new Error('useP2P must be used inside P2PProvider');
  return ctx;
}
