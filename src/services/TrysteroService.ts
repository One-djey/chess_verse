import { joinRoom as trysteroJoinRoom } from 'trystero';
import type { Room } from '@trystero-p2p/core';
import type { MoveMessage, ColorAssignMessage, SyncStateMessage, ResignMessage } from '../types/p2p';

const APP_ID = 'chess-verse-2024';

export type { Room };

export function joinRoom(roomId: string): Room {
  return trysteroJoinRoom({ appId: APP_ID }, roomId);
}

export function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeRoomActions(room: Room) {
  const [sendMove, onMove] = room.makeAction<MoveMessage>('move');
  const [sendColorAssign, onColorAssign] = room.makeAction<ColorAssignMessage>('color_assign');
  const [sendSyncState, onSyncState] = room.makeAction<SyncStateMessage>('sync_state');
  const [sendResign, onResign] = room.makeAction<ResignMessage>('resign');

  return {
    sendMove,
    onMove,
    sendColorAssign,
    onColorAssign,
    sendSyncState,
    onSyncState,
    sendResign,
    onResign,
  };
}
