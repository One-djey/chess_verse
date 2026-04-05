import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flag, Settings } from 'lucide-react';
import ChessBoard from './ChessBoard';
import GameOver from './GameOver';
import GameSettings from './GameSettings';
import P2PStatusBar from './P2PStatusBar';
import { GameState, Piece, Position, GameMode, PieceColor } from '../types/chess';
import { RematchState } from '../types/p2p';
import {
  getInitialPieces,
  isInCheck,
  hasLegalMoves,
  getValidMoves,
  findCastlingMove
} from '../utils/chess';
import { gameModes } from './GameModes';
import { ChessAI } from '../services/ChessAI';
import { useP2P } from '../context/P2PContext';

const STORAGE_KEY = 'chess_settings';

function resolveGameMode(modeId: string | undefined, p2pGameMode: GameMode | null): GameMode {
  if (modeId === 'p2p' && p2pGameMode) return p2pGameMode;
  return gameModes.find(m => m.id === modeId) ?? gameModes[0];
}

export default function Game() {
  const { modeId } = useParams();
  const navigate = useNavigate();
  const aiRef = useRef<ChessAI | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const {
    isP2PMode,
    role,
    playerColor,
    connectionState,
    gameMode: p2pGameMode,
    initialPieces: p2pInitialPieces,
    actions,
    room,
    leaveRoom,
  } = useP2P();

  const gameMode = resolveGameMode(modeId, p2pGameMode);

  // Sequence tracking
  const seqRef = useRef(0);

  // Ref to always have fresh gameState inside Trystero callbacks (avoids stale closure)
  const gameStateRef = useRef<GameState | null>(null);

  const [rematchState, setRematchState] = useState<RematchState>('idle');

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { aiEnabled: true, aiDifficulty: 5, flipBoard: false };
  });

  const [gameState, setGameState] = useState<GameState>({
    pieces: [],
    currentTurn: 'white',
    selectedPiece: null,
    validMoves: [],
    isCheck: false,
    startTime: Date.now(),
    moveCount: { white: 0, black: 0 },
    gameOver: false,
    winner: null,
    gameMode,
  });

  // Keep ref in sync
  gameStateRef.current = gameState;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!modeId) { navigate('/'); return; }
    if (modeId === 'p2p' && !p2pGameMode) return;

    const pieces = (modeId === 'p2p' && p2pInitialPieces)
      ? p2pInitialPieces
      : getInitialPieces(gameMode);

    setGameState(prev => ({ ...prev, pieces, gameMode, startTime: Date.now() }));

    if (!isP2PMode) {
      if (!aiRef.current) {
        try { aiRef.current = new ChessAI(); } catch (e) { console.error(e); }
      }
    }

    return () => {
      if (aiRef.current) { aiRef.current.destroy(); aiRef.current = null; }
    };
  }, [modeId, navigate, p2pGameMode, p2pInitialPieces]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI trigger ─────────────────────────────────────────────────────────────
  const aiEnabled = settings.aiEnabled && !isP2PMode;

  useEffect(() => {
    if (aiEnabled && gameState.currentTurn === 'black' && !gameState.gameOver) {
      setTimeout(() => { handleAIMove(); }, 500);
    }
  }, [gameState.currentTurn, aiEnabled, gameState.gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rematch helper ─────────────────────────────────────────────────────────
  const resetGame = (pieces: Piece[]) => {
    seqRef.current = 0;
    setRematchState('idle');
    setGameState({
      pieces,
      currentTurn: 'white',
      selectedPiece: null,
      validMoves: [],
      isCheck: false,
      startTime: Date.now(),
      moveCount: { white: 0, black: 0 },
      gameOver: false,
      winner: null,
      gameMode,
    });
  };

  // ── P2P message handlers ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isP2PMode || !actions) return;

    if (role === 'host') {
      // HOST validates guest move proposals
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
        const seq = seqRef.current;
        actions.sendMoveConfirm({ type: 'move_confirm', pieceId: msg.pieceId, from: msg.from, to: msg.to, seq });
        setGameState(prev => applyMoveToState(prev, piece, msg.to));
      });

      // HOST receives rematch accept from guest → start rematch
      actions.onRematchAccept(() => {
        const pieces = getInitialPieces(gameMode);
        actions.sendRematchStart({ type: 'rematch_start', pieces });
        resetGame(pieces);
      });

      // HOST receives rematch request from guest → offer on screen
      actions.onRematchRequest(() => setRematchState('offered'));
      // HOST receives rematch decline from guest
      actions.onRematchDecline(() => setRematchState('idle'));
    }

    if (role === 'guest') {
      // GUEST applies host-confirmed moves
      actions.onMoveConfirm((msg) => {
        if (msg.seq !== seqRef.current + 1) {
          console.warn(`P2P seq gap: expected ${seqRef.current + 1}, got ${msg.seq}`);
        }
        seqRef.current = msg.seq;
        setGameState(prev => {
          const piece = prev.pieces.find(p => p.id === msg.pieceId);
          if (!piece) return prev;
          return applyMoveToState(prev, piece, msg.to);
        });
      });

      actions.onMoveReject(() => {
        setGameState(prev => ({ ...prev, selectedPiece: null, validMoves: [] }));
      });

      // GUEST receives rematch request from host → offer on screen
      actions.onRematchRequest(() => setRematchState('offered'));
      // GUEST receives rematch decline from host
      actions.onRematchDecline(() => setRematchState('idle'));

      // GUEST receives authoritative board reset from host
      actions.onRematchStart((msg) => resetGame(msg.pieces));
    }

    // Both sides: opponent resigned
    actions.onResign(() => {
      const opponentColor: PieceColor = playerColor === 'white' ? 'black' : 'white';
      setGameState(prev => ({
        ...prev,
        gameOver: true,
        winner: playerColor ?? 'white',
        surrenderedBy: opponentColor,
      }));
    });

    room?.onPeerLeave(() => { /* P2PStatusBar shows disconnect banner */ });
  }, [isP2PMode, actions, role, playerColor, room]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pure state-transition helper ───────────────────────────────────────────
  function applyMoveToState(prev: GameState, piece: Piece, target: Position): GameState {
    const normalizedTarget = {
      x: ((target.x % 8) + 8) % 8,
      y: ((target.y % 8) + 8) % 8,
    };

    const castlingMove = findCastlingMove(piece, normalizedTarget, prev.pieces, prev.gameMode);

    const capturedPiece = prev.pieces.find(p =>
      p.position.x === normalizedTarget.x && p.position.y === normalizedTarget.y
    );

    let newPieces = capturedPiece
      ? prev.pieces.filter(p => p.id !== capturedPiece.id)
      : [...prev.pieces];

    newPieces = newPieces.map(p => {
      if (p.id === piece.id) {
        const shouldPromote = p.type === 'pawn' && (
          (p.color === 'white' && normalizedTarget.y === 0) ||
          (p.color === 'black' && normalizedTarget.y === 7)
        );
        return { ...p, position: normalizedTarget, hasMoved: true, type: shouldPromote ? 'queen' : p.type };
      }
      return p;
    });

    if (castlingMove) {
      newPieces = newPieces.map(p =>
        p.id === castlingMove.rook.id
          ? { ...p, position: castlingMove.rookTarget, hasMoved: true }
          : p
      );
    }

    if (capturedPiece?.type === 'king') {
      return {
        ...prev, pieces: newPieces,
        currentTurn: prev.currentTurn === 'white' ? 'black' : 'white',
        selectedPiece: null, validMoves: [], isCheck: false,
        moveCount: { ...prev.moveCount, [prev.currentTurn]: prev.moveCount[prev.currentTurn] + 1 },
        gameOver: true, winner: prev.currentTurn,
      };
    }

    const onlyKingsLeft = newPieces.every(p => p.type === 'king');
    if (onlyKingsLeft) {
      return {
        ...prev, pieces: newPieces,
        currentTurn: prev.currentTurn === 'white' ? 'black' : 'white',
        selectedPiece: null, validMoves: [], isCheck: false,
        moveCount: { ...prev.moveCount, [prev.currentTurn]: prev.moveCount[prev.currentTurn] + 1 },
        gameOver: true, winner: null, drawReason: 'only-kings',
      };
    }

    const nextTurn: PieceColor = prev.currentTurn === 'white' ? 'black' : 'white';
    const nextIsCheck = isInCheck(nextTurn, newPieces, prev.gameMode);
    const nextHasLegal = hasLegalMoves(nextTurn, newPieces, prev.gameMode);

    return {
      ...prev, pieces: newPieces, currentTurn: nextTurn,
      selectedPiece: null, validMoves: [], isCheck: nextIsCheck,
      moveCount: { ...prev.moveCount, [prev.currentTurn]: prev.moveCount[prev.currentTurn] + 1 },
      gameOver: !nextHasLegal,
      winner: nextIsCheck && !nextHasLegal ? prev.currentTurn : null,
      drawReason: !nextIsCheck && !nextHasLegal ? 'stalemate' : undefined,
    };
  }

  const handleAIMove = async () => {
    if (!aiRef.current) { setTimeout(() => handleAIMove(), 1000); return; }
    try {
      const move = await aiRef.current.getNextMove(gameState.pieces);
      const piece = gameState.pieces.find(
        p => p.position.x === move.from.x && p.position.y === move.from.y && p.color === 'black'
      );
      if (!piece) return;
      const valid = getValidMoves(piece, gameState.pieces, gameState.gameMode)
        .some(v => v.x === move.to.x && v.y === move.to.y);
      if (!valid) return;
      setGameState(prev => applyMoveToState(prev, piece, move.to));
    } catch (e) { console.error(e); }
  };

  const handleSettingsChange = (newSettings: typeof settings) => {
    setSettings(newSettings);
    if (aiRef.current) aiRef.current.setDifficulty(newSettings.aiDifficulty);
  };

  const handlePieceSelect = (piece: Piece) => {
    if (isP2PMode) {
      if (!playerColor || piece.color !== playerColor) return;
    } else {
      if (aiEnabled && piece.color === 'black') return;
    }
    if (piece.color !== gameState.currentTurn) return;
    const validMoves = getValidMoves(piece, gameState.pieces, gameState.gameMode);
    setGameState(prev => ({ ...prev, selectedPiece: piece, validMoves }));
  };

  const handleMove = (target: Position) => {
    if (!gameState.selectedPiece) return;
    const piece = gameState.selectedPiece;
    const normalizedTarget = {
      x: ((target.x % 8) + 8) % 8,
      y: ((target.y % 8) + 8) % 8,
    };

    if (isP2PMode && role === 'guest') {
      // Guest: propose to host, clear selection but don't apply board change
      actions?.sendMoveProposal({
        type: 'move_proposal',
        pieceId: piece.id,
        from: piece.position,
        to: normalizedTarget,
      });
      setGameState(prev => ({ ...prev, selectedPiece: null, validMoves: [] }));
      return;
    }

    // Host or local: apply immediately
    if (isP2PMode && role === 'host') {
      seqRef.current++;
      actions?.sendMoveConfirm({
        type: 'move_confirm',
        pieceId: piece.id,
        from: piece.position,
        to: normalizedTarget,
        seq: seqRef.current,
      });
    }

    setGameState(prev => applyMoveToState(prev, piece, normalizedTarget));
  };

  const handleResign = () => {
    const myColor: PieceColor = isP2PMode ? (playerColor ?? 'white') : gameState.currentTurn;
    if (isP2PMode && actions) actions.sendResign({ type: 'resign' });
    setGameState(prev => ({
      ...prev,
      gameOver: true,
      winner: myColor === 'white' ? 'black' : 'white',
      surrenderedBy: myColor,
    }));
  };

  const handleReplay = () => {
    resetGame(getInitialPieces(gameMode));
  };

  // ── Rematch handlers (P2P) ─────────────────────────────────────────────────
  const handleRematch = () => {
    actions?.sendRematchRequest({ type: 'rematch_request' });
    setRematchState('requested');
  };

  const handleAcceptRematch = () => {
    if (role === 'host') {
      // Host accepts guest's request: start immediately
      const pieces = getInitialPieces(gameMode);
      actions?.sendRematchStart({ type: 'rematch_start', pieces });
      resetGame(pieces);
    } else {
      // Guest accepts host's request: ask host to start
      actions?.sendRematchAccept({ type: 'rematch_accept' });
      setRematchState('starting');
    }
  };

  const handleDeclineRematch = () => {
    actions?.sendRematchDecline({ type: 'rematch_decline' });
    setRematchState('idle');
  };

  const handleLeaveP2P = () => { leaveRoom(); navigate('/'); };

  const lockedColor = isP2PMode ? playerColor : (aiEnabled ? 'white' : null);

  // Board orientation:
  // P2P black player → always flipped
  // vs AI            → never flipped
  // Solo + flipBoard  → flips each turn (animated in ChessBoard)
  // Solo default      → statically flipped (black at bottom, phone passed across)
  const boardFlipped = isP2PMode
    ? playerColor === 'black'
    : aiEnabled
      ? false
      : settings.flipBoard
        ? gameState.currentTurn === 'black'
        : true;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md px-4 py-2 flex justify-between items-center">
        <h1 className="text-xl font-bold">{gameState.gameMode.title}</h1>
        <div className="flex items-center gap-4">
          {!isP2PMode && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Settings size={20} />
              Settings
            </button>
          )}
          <button
            onClick={handleResign}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            <Flag size={20} />
            Surrender
          </button>
        </div>
      </nav>

      {isP2PMode && (
        <P2PStatusBar
          connectionState={connectionState}
          playerColor={playerColor}
          currentTurn={gameState.currentTurn}
          onLeave={handleLeaveP2P}
        />
      )}

      <div className="flex items-center justify-center p-8">
        <ChessBoard
          pieces={gameState.pieces}
          currentTurn={gameState.currentTurn}
          selectedPiece={gameState.selectedPiece}
          validMoves={gameState.validMoves}
          isCheck={gameState.isCheck}
          onPieceSelect={handlePieceSelect}
          onMove={handleMove}
          gameMode={gameState.gameMode}
          lockedColor={lockedColor}
          flipped={boardFlipped}
        />
      </div>

      {!isP2PMode && (
        <GameSettings
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />
      )}

      {gameState.gameOver && (
        <GameOver
          winner={gameState.winner}
          drawReason={gameState.drawReason}
          surrenderedBy={gameState.surrenderedBy}
          duration={Date.now() - gameState.startTime}
          moveCount={gameState.winner ? gameState.moveCount[gameState.winner] : gameState.moveCount.white + gameState.moveCount.black}
          onReplay={handleReplay}
          aiEnabled={aiEnabled}
          aiDifficulty={settings.aiDifficulty}
          isP2PMode={isP2PMode}
          playerColor={playerColor}
          rematchState={rematchState}
          onRematch={handleRematch}
          onAcceptRematch={handleAcceptRematch}
          onDeclineRematch={handleDeclineRematch}
        />
      )}
    </div>
  );
}
