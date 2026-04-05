import { PieceColor, Position, Piece, GameMode } from './chess';

export type P2PRole = 'host' | 'guest';

export type P2PConnectionState = 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected';

export interface P2PState {
  role: P2PRole | null;
  playerColor: PieceColor | null;
  connectionState: P2PConnectionState;
  peerId: string | null;
}

export type MoveMessage = {
  type: 'move';
  pieceId: string;
  from: Position;
  to: Position;
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
};

export type ResignMessage = {
  type: 'resign';
};

export type P2PMessage =
  | MoveMessage
  | ColorAssignMessage
  | SyncStateMessage
  | ResignMessage;
