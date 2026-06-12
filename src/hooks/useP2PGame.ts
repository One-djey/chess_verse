import { useEffect, useRef, useState } from "react";
import { GameState, Piece, GameMode, PieceColor } from "../types/chess";
import { P2PConnectionState, RematchState } from "../types/p2p";
import {
  getInitialPieces,
  applyMoveToState,
  getValidMoves,
} from "../utils/chess";
import { makeRoomActions } from "../services/TrysteroService";

interface Params {
  isP2PMode: boolean;
  role: "host" | "guest" | null;
  playerColor: PieceColor | null;
  actions: ReturnType<typeof makeRoomActions> | null;
  connectionState: P2PConnectionState;
  gameMode: GameMode;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  gameStateRef: React.MutableRefObject<GameState | null>;
  chessResetGame: (pieces: Piece[]) => void;
}

export function useP2PGame({
  isP2PMode,
  role,
  playerColor,
  actions,
  connectionState,
  gameMode,
  setGameState,
  gameStateRef,
  chessResetGame,
}: Params) {
  const seqRef = useRef(0);
  const [rematchState, setRematchState] = useState<RematchState>("idle");
  // BUG-013: derived from connectionState rather than a local onPeerLeave
  // registration — Trystero's room.onPeerLeave is a single-slot setter, so
  // registering here would clobber P2PContext's handler (the sole owner).
  const peerLeft = connectionState === "disconnected";

  const resetGame = (pieces: Piece[]) => {
    seqRef.current = 0;
    setRematchState("idle");
    chessResetGame(pieces);
  };

  // ── Register P2P message handlers ────────────────────────────────────────
  useEffect(() => {
    if (!isP2PMode || !actions) return;

    if (role === "host") {
      actions.onMoveProposal((msg) => {
        const state = gameStateRef.current;
        if (!state) return;
        const piece = state.pieces.find(
          (p) => p.id === msg.pieceId && p.color === "black",
        );
        const fromMismatch =
          piece &&
          (msg.from.x !== piece.position.x || msg.from.y !== piece.position.y);
        if (!piece || fromMismatch || state.currentTurn !== "black" || state.gameOver) {
          actions.sendMoveReject({ type: "move_reject" });
          return;
        }
        const valid = getValidMoves(
          piece,
          state.pieces,
          state.gameMode,
          state.enPassantTarget,
        ).some((v) => v.x === msg.to.x && v.y === msg.to.y);
        if (!valid) {
          actions.sendMoveReject({ type: "move_reject" });
          return;
        }

        seqRef.current++;
        actions.sendMoveConfirm({
          type: "move_confirm",
          pieceId: msg.pieceId,
          from: msg.from,
          to: msg.to,
          seq: seqRef.current,
          promotionType: msg.promotionType,
        });
        setGameState((prev) =>
          applyMoveToState(prev, piece, msg.to, msg.promotionType),
        );
      });

      // P2P resilience: when the guest detects divergence it sends sync_request.
      // The host responds with the current authoritative state so the guest can
      // re-align. Trade-off: adds a round-trip on divergence, but never leaves
      // the game permanently stuck in a desync.
      actions.onSyncRequest(() => {
        const currentState = gameStateRef.current;
        if (!currentState) return;
        actions.sendSyncState({
          type: "sync_state",
          pieces: currentState.pieces,
          seq: seqRef.current,
          currentTurn: currentState.currentTurn,
          enPassantTarget: currentState.enPassantTarget,
          halfMoveClock: currentState.halfMoveClock,
          positionHistory: currentState.positionHistory,
          isCheck: currentState.isCheck,
        });
      });

      actions.onRematchRequest(() => setRematchState("offered"));
      actions.onRematchDecline(() => setRematchState("idle"));
      actions.onRematchAccept(() => {
        const pieces = getInitialPieces(gameMode);
        actions.sendRematchStart({ type: "rematch_start", pieces });
        resetGame(pieces);
      });
    }

    if (role === "guest") {
      actions.onMoveConfirm((msg) => {
        if (msg.seq !== seqRef.current + 1) {
          console.warn(
            `P2P seq gap: expected ${seqRef.current + 1}, got ${msg.seq}`,
          );
        }
        setGameState((prev) => {
          const piece = prev.pieces.find((p) => p.id === msg.pieceId);
          if (!piece) {
            // P2P resilience: instead of silently rejecting (which would leave
            // the game in a stuck state if host/guest have diverged), we request
            // a full resync. The host responds with sync_state, which the guest
            // applies to re-align. seqRef is NOT advanced so the next seq gap
            // warning still fires, making the divergence visible in logs.
            console.error(
              `[P2P] Guest: move_confirm references unknown pieceId "${msg.pieceId}" — requesting resync`,
            );
            actions.sendSyncRequest({ type: "sync_request" });
            return prev;
          }
          // LIM-002: re-validate the host's move locally before applying it.
          // P2P resilience: instead of silently ignoring an invalid move (which
          // would leave the game stuck if states have diverged), we request a
          // full resync so the host can re-align the guest.
          const validMoves = getValidMoves(piece, prev.pieces, prev.gameMode, prev.enPassantTarget);
          const isValid = validMoves.some(
            (v) => v.x === msg.to.x && v.y === msg.to.y,
          );
          if (!isValid) {
            console.error(
              `[P2P] Guest: move from host not in valid moves — requesting resync`,
            );
            actions.sendSyncRequest({ type: "sync_request" });
            return prev;
          }
          seqRef.current = msg.seq;
          return applyMoveToState(prev, piece, msg.to, msg.promotionType);
        });
      });
      actions.onMoveReject(() =>
        setGameState((prev) => ({
          ...prev,
          selectedPiece: null,
          validMoves: [],
        })),
      );
      // P2P resilience: apply the authoritative state broadcast by the host
      // after a resync has been requested. The guest replaces its pieces with
      // the host's snapshot and aligns its seq counter so subsequent confirms
      // are processed correctly.
      actions.onSyncState((msg) => {
        seqRef.current = msg.seq;
        setGameState((prev) => ({
          ...prev,
          pieces: msg.pieces,
          currentTurn: msg.currentTurn,
          enPassantTarget: msg.enPassantTarget,
          halfMoveClock: msg.halfMoveClock,
          positionHistory: msg.positionHistory,
          isCheck: msg.isCheck,
          selectedPiece: null,
          validMoves: [],
        }));
      });
      actions.onRematchRequest(() => setRematchState("offered"));
      actions.onRematchDecline(() => setRematchState("idle"));
      actions.onRematchStart((msg) => resetGame(msg.pieces));
    }

    actions.onResign(() => {
      if (playerColor === null) return;
      const opp: PieceColor = playerColor === "white" ? "black" : "white";
      setGameState((prev) => ({
        ...prev,
        gameOver: true,
        winner: playerColor,
        surrenderedBy: opp,
      }));
    });

    // setGameState is a stable React setState dispatch and gameMode is fixed
    // for the lifetime of a room session, so neither needs to re-trigger
    // handler registration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isP2PMode, actions, role, playerColor]);

  // ── Rematch handlers (called from GameOver modal) ─────────────────────────
  const handleRematch = () => {
    actions?.sendRematchRequest({ type: "rematch_request" });
    setRematchState("requested");
  };

  const handleAcceptRematch = () => {
    if (role === "host") {
      const pieces = getInitialPieces(gameMode);
      actions?.sendRematchStart({ type: "rematch_start", pieces });
      resetGame(pieces);
    } else {
      actions?.sendRematchAccept({ type: "rematch_accept" });
      setRematchState("starting");
    }
  };

  const handleDeclineRematch = () => {
    actions?.sendRematchDecline({ type: "rematch_decline" });
    setRematchState("idle");
  };

  return {
    seqRef,
    rematchState,
    peerLeft,
    handleRematch,
    handleAcceptRematch,
    handleDeclineRematch,
  };
}
