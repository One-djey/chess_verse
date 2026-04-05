import { joinRoom as trysteroJoinRoom } from 'trystero';
import type { Room } from '@trystero-p2p/core';
import type {
  MoveProposalMessage,
  MoveConfirmMessage,
  MoveRejectMessage,
  ColorAssignMessage,
  SyncStateMessage,
  ResignMessage,
} from '../types/p2p';

const APP_ID = 'chess-verse-2024';

export type { Room };

export function joinRoom(roomId: string): Room {
  return trysteroJoinRoom({ appId: APP_ID }, roomId);
}

export function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeRoomActions(room: Room) {
  const [sendMoveProposal, onMoveProposal] = room.makeAction<MoveProposalMessage>('move_proposal');
  const [sendMoveConfirm, onMoveConfirm]   = room.makeAction<MoveConfirmMessage>('move_confirm');
  const [sendMoveReject, onMoveReject]     = room.makeAction<MoveRejectMessage>('move_reject');
  const [sendColorAssign, onColorAssign]   = room.makeAction<ColorAssignMessage>('color_assign');
  const [sendSyncState, onSyncState]       = room.makeAction<SyncStateMessage>('sync_state');
  const [sendResign, onResign]             = room.makeAction<ResignMessage>('resign');

  return {
    sendMoveProposal, onMoveProposal,
    sendMoveConfirm,  onMoveConfirm,
    sendMoveReject,   onMoveReject,
    sendColorAssign,  onColorAssign,
    sendSyncState,    onSyncState,
    sendResign,       onResign,
  };
}
