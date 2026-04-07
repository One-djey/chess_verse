import { useEffect, useRef, useState } from 'react';
import { GameState, Piece, GameMode, PieceColor } from '../types/chess';
import { RematchState } from '../types/p2p';
import { getInitialPieces, applyMoveToState, getValidMoves } from '../utils/chess';
import { makeRoomActions } from '../services/TrysteroService';
import type { Room } from '@trystero-p2p/core';

interface Params {
  isP2PMode: boolean;
  role: 'host' | 'guest' | null;
  playerColor: PieceColor | null;
  actions: ReturnType<typeof makeRoomActions> | null;
  room: Room | null;
  gameMode: GameMode;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  gameStateRef: React.MutableRefObject<GameState | null>;
  chessResetGame: (pieces: Piece[]) => void;
}

export function useP2PGame({
  isP2PMode, role, playerColor, actions, room,
  gameMode, setGameState, gameStateRef, chessResetGame,
}: Params) {
  const seqRef = useRef(0);
  const [rematchState, setRematchState] = useState<RematchState>('idle');
  const [peerLeft, setPeerLeft] = useState(false);

  const resetGame = (pieces: Piece[]) => {
    seqRef.current = 0;
    setRematchState('idle');
    setPeerLeft(false);
    chessResetGame(pieces);
  };

  // ── Register P2P message handlers ────────────────────────────────────────
  useEffect(() => {
    if (!isP2PMode || !actions) return;

    if (role === 'host') {
      actions.onMoveProposal((msg) => {
        const state = gameStateRef.current;
        if (!state) return;
        const piece = state.pieces.find(p => p.id === msg.pieceId && p.color === 'black');
        if (!piece || state.currentTurn !== 'black' || state.gameOver) {
          actions.sendMoveReject({ type: 'move_reject' });
          return;
        }
        const valid = getValidMoves(piece, state.pieces, state.gameMode)
          .some(v => v.x === msg.to.x && v.y === msg.to.y);
        if (!valid) { actions.sendMoveReject({ type: 'move_reject' }); return; }

        seqRef.current++;
        actions.sendMoveConfirm({ type: 'move_confirm', pieceId: msg.pieceId, from: msg.from, to: msg.to, seq: seqRef.current });
        setGameState(prev => applyMoveToState(prev, piece, msg.to));
      });

      actions.onRematchRequest(() => setRematchState('offered'));
      actions.onRematchDecline(() => setRematchState('idle'));
      actions.onRematchAccept(() => {
        const pieces = getInitialPieces(gameMode);
        actions.sendRematchStart({ type: 'rematch_start', pieces });
        resetGame(pieces);
      });
    }

    if (role === 'guest') {
      actions.onMoveConfirm((msg) => {
        if (msg.seq !== seqRef.current + 1) {
          console.warn(`P2P seq gap: expected ${seqRef.current + 1}, got ${msg.seq}`);
        }
        seqRef.current = msg.seq;
        setGameState(prev => {
          const piece = prev.pieces.find(p => p.id === msg.pieceId);
          return piece ? applyMoveToState(prev, piece, msg.to) : prev;
        });
      });
      actions.onMoveReject(() =>
        setGameState(prev => ({ ...prev, selectedPiece: null, validMoves: [] }))
      );
      actions.onRematchRequest(() => setRematchState('offered'));
      actions.onRematchDecline(() => setRematchState('idle'));
      actions.onRematchStart((msg) => resetGame(msg.pieces));
    }

    actions.onResign(() => {
      const opp: PieceColor = playerColor === 'white' ? 'black' : 'white';
      setGameState(prev => ({ ...prev, gameOver: true, winner: playerColor ?? 'white', surrenderedBy: opp }));
    });

    room?.onPeerLeave(() => setPeerLeft(true));
  }, [isP2PMode, actions, role, playerColor, room]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rematch handlers (called from GameOver modal) ─────────────────────────
  const handleRematch = () => {
    actions?.sendRematchRequest({ type: 'rematch_request' });
    setRematchState('requested');
  };

  const handleAcceptRematch = () => {
    if (role === 'host') {
      const pieces = getInitialPieces(gameMode);
      actions?.sendRematchStart({ type: 'rematch_start', pieces });
      resetGame(pieces);
    } else {
      actions?.sendRematchAccept({ type: 'rematch_accept' });
      setRematchState('starting');
    }
  };

  const handleDeclineRematch = () => {
    actions?.sendRematchDecline({ type: 'rematch_decline' });
    setRematchState('idle');
  };

  return { seqRef, rematchState, peerLeft, handleRematch, handleAcceptRematch, handleDeclineRematch };
}
