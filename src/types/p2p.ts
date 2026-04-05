import { PieceColor, Position, Piece, GameMode } from './chess';

export type P2PRole = 'host' | 'guest';

export type P2PConnectionState = 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected';

export interface P2PState {
  role: P2PRole | null;
  playerColor: PieceColor | null;
  connectionState: P2PConnectionState;
  peerId: string | null;
}

// Guest → Host: propose a move (not yet applied)
export type MoveProposalMessage = {
  type: 'move_proposal';
  pieceId: string;
  from: Position;
  to: Position;
};

// Host → Guest: authoritative confirmed move with sequence number
export type MoveConfirmMessage = {
  type: 'move_confirm';
  pieceId: string;
  from: Position;
  to: Position;
  seq: number;
};

// Host → Guest: proposed move was invalid
export type MoveRejectMessage = {
  type: 'move_reject';
};

export type ColorAssignMessage = {
  type: 'color_assign';
  hostColor: 'white';
  guestColor: 'black';
  gameMode: GameMode;
};

export type SyncStateMessage = {
  type: 'sync_state';
  pieces: Piece[];
  seq: number; // initial sequence (always 0)
};

export type ResignMessage = {
  type: 'resign';
};

export type P2PMessage =
  | MoveProposalMessage
  | MoveConfirmMessage
  | MoveRejectMessage
  | ColorAssignMessage
  | SyncStateMessage
  | ResignMessage;
