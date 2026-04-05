import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import type { Room } from '@trystero-p2p/core';
import { P2PConnectionState, P2PRole, MoveMessage, ColorAssignMessage, SyncStateMessage } from '../types/p2p';
import { PieceColor, GameMode, Piece } from '../types/chess';
import { joinRoom, makeRoomActions } from '../services/TrysteroService';

interface P2PContextValue {
  // State
  isP2PMode: boolean;
  role: P2PRole | null;
  playerColor: PieceColor | null;
  connectionState: P2PConnectionState;
  gameMode: GameMode | null;
  initialPieces: Piece[] | null;

  // Room management
  room: Room | null;
  actions: ReturnType<typeof makeRoomActions> | null;

  // Actions
  startRoom: (roomId: string) => void;
  joinExistingRoom: (roomId: string) => void;
  setColorAssign: (msg: ColorAssignMessage) => void;
  setConnectionState: (state: P2PConnectionState) => void;
  setInitialPieces: (pieces: Piece[]) => void;
  leaveRoom: () => void;
}

const P2PContext = createContext<P2PContextValue | null>(null);

export function P2PProvider({ children }: { children: React.ReactNode }) {
  const [isP2PMode, setIsP2PMode] = useState(false);
  const [role, setRole] = useState<P2PRole | null>(null);
  const [playerColor, setPlayerColor] = useState<PieceColor | null>(null);
  const [connectionState, setConnectionState] = useState<P2PConnectionState>('idle');
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [initialPieces, setInitialPieces] = useState<Piece[] | null>(null);
  const roomRef = useRef<Room | null>(null);
  const actionsRef = useRef<ReturnType<typeof makeRoomActions> | null>(null);
  const [, forceUpdate] = useState(0);

  const startRoom = useCallback((roomId: string) => {
    const room = joinRoom(roomId);
    roomRef.current = room;
    actionsRef.current = makeRoomActions(room);
    setRole('host');
    setPlayerColor('white');
    setIsP2PMode(true);
    setConnectionState('waiting');
    forceUpdate(n => n + 1);
  }, []);

  const joinExistingRoom = useCallback((roomId: string) => {
    const room = joinRoom(roomId);
    roomRef.current = room;
    actionsRef.current = makeRoomActions(room);
    setRole('guest');
    setPlayerColor(null); // set when color_assign received
    setIsP2PMode(true);
    setConnectionState('connecting');
    forceUpdate(n => n + 1);
  }, []);

  const setColorAssign = useCallback((msg: ColorAssignMessage) => {
    setPlayerColor('black');
    setGameMode(msg.gameMode);
  }, []);

  const leaveRoom = useCallback(() => {
    roomRef.current?.leave();
    roomRef.current = null;
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
      setColorAssign,
      setConnectionState,
      setInitialPieces,
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
