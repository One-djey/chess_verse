import { joinRoom as trysteroJoinRoom } from "trystero";
import type { Room } from "@trystero-p2p/core";
import type {
  MoveProposalMessage,
  MoveConfirmMessage,
  MoveRejectMessage,
  ColorAssignMessage,
  GuestReadyMessage,
  SyncStateMessage,
  ResignMessage,
  RematchRequestMessage,
  RematchAcceptMessage,
  RematchDeclineMessage,
  RematchStartMessage,
} from "../types/p2p";

const APP_ID = "chess-verse-2024";

export type { Room };

export function joinRoom(roomId: string): Room {
  return trysteroJoinRoom({ appId: APP_ID }, roomId);
}

export function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeRoomActions(room: Room) {
  const [sendMoveProposal, onMoveProposal] =
    room.makeAction<MoveProposalMessage>("move_proposal");
  const [sendMoveConfirm, onMoveConfirm] =
    room.makeAction<MoveConfirmMessage>("move_confirm");
  const [sendMoveReject, onMoveReject] =
    room.makeAction<MoveRejectMessage>("move_reject");
  const [sendColorAssign, onColorAssign] =
    room.makeAction<ColorAssignMessage>("color_assign");
  const [sendSyncState, onSyncState] =
    room.makeAction<SyncStateMessage>("sync_state");
  const [sendResign, onResign] = room.makeAction<ResignMessage>("resign");
  const [sendRematchRequest, onRematchRequest] =
    room.makeAction<RematchRequestMessage>("rematch_request");
  const [sendRematchAccept, onRematchAccept] =
    room.makeAction<RematchAcceptMessage>("rematch_accept");
  const [sendRematchDecline, onRematchDecline] =
    room.makeAction<RematchDeclineMessage>("rematch_decline");
  const [sendRematchStart, onRematchStart] =
    room.makeAction<RematchStartMessage>("rematch_start");
  const [sendGuestReady, onGuestReady] =
    room.makeAction<GuestReadyMessage>("guest_ready");

  return {
    sendMoveProposal,
    onMoveProposal,
    sendMoveConfirm,
    onMoveConfirm,
    sendMoveReject,
    onMoveReject,
    sendColorAssign,
    onColorAssign,
    sendSyncState,
    onSyncState,
    sendResign,
    onResign,
    sendRematchRequest,
    onRematchRequest,
    sendRematchAccept,
    onRematchAccept,
    sendRematchDecline,
    onRematchDecline,
    sendRematchStart,
    onRematchStart,
    sendGuestReady,
    onGuestReady,
  };
}
