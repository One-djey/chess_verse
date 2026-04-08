import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ChessBoard from './ChessBoard';
import GameOver from './GameOver';
import NavBar from './NavBar';
import P2PStatusBar from './P2PStatusBar';
import { Piece, Position, GameMode, PieceColor } from '../types/chess';
import { getValidMoves, applyMoveToState, normalizePos } from '../utils/chess';
import { gameModes } from './GameModes';
import { useP2P } from '../context/P2PContext';
import { useChessGame } from '../hooks/useChessGame';
import { useP2PGame } from '../hooks/useP2PGame';

function resolveGameMode(modeId: string | undefined, p2pMode: GameMode | null): GameMode {
  if (modeId === 'p2p' && p2pMode) return p2pMode;
  return gameModes.find(m => m.id === modeId) ?? gameModes[0];
}

export default function Game() {
  const { modeId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const p2p = useP2P();

  // If we enter a non-P2P game while P2P state is still active (e.g. user navigated
  // away via the NavBar without going through handleLeaveP2P), clean up the stale state.
  // Also clean up on unmount so the WebRTC room is closed immediately when leaving,
  // even via NavBar/browser-back, without waiting for the next game to mount.
  React.useEffect(() => {
    if (modeId !== 'p2p' && p2p.isP2PMode) {
      p2p.leaveRoom();
    }
    return () => { if (p2p.isP2PMode) p2p.leaveRoom(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gameMode = resolveGameMode(modeId, p2p.gameMode);

  const chess = useChessGame({
    modeId, navigate, gameMode,
    isP2PMode: p2p.isP2PMode,
    p2pInitialPieces: p2p.initialPieces,
  });

  const p2pGame = useP2PGame({
    isP2PMode: p2p.isP2PMode,
    role: p2p.role,
    playerColor: p2p.playerColor,
    actions: p2p.actions,
    room: p2p.room,
    gameMode,
    setGameState: chess.setGameState,
    gameStateRef: chess.gameStateRef,
    chessResetGame: chess.resetGame,
  });

  // ── AI move trigger ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!chess.aiEnabled || chess.gameState.currentTurn !== 'black' || chess.gameState.gameOver) return;
    const trigger = async () => {
      if (!chess.aiRef.current) { setTimeout(trigger, 1000); return; }
      try {
        const move = await chess.aiRef.current.getNextMove(chess.gameState.pieces);
        const piece = chess.gameState.pieces.find(
          p => p.position.x === move.from.x && p.position.y === move.from.y && p.color === 'black'
        );
        if (!piece) return;
        const valid = getValidMoves(piece, chess.gameState.pieces, chess.gameState.gameMode)
          .some(v => v.x === move.to.x && v.y === move.to.y);
        if (valid) chess.setGameState(prev => applyMoveToState(prev, piece, move.to));
      } catch (e) { console.error(e); }
    };
    const id = setTimeout(trigger, 500);
    return () => clearTimeout(id);
  }, [chess.gameState.currentTurn, chess.aiEnabled, chess.gameState.gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── User action handlers ───────────────────────────────────────────────────
  const handlePieceSelect = (piece: Piece) => {
    if (p2p.isP2PMode ? piece.color !== p2p.playerColor : chess.aiEnabled && piece.color === 'black') return;
    if (piece.color !== chess.gameState.currentTurn) return;
    chess.setGameState(prev => ({
      ...prev,
      selectedPiece: piece,
      validMoves: getValidMoves(piece, prev.pieces, prev.gameMode),
    }));
  };

  const handleMove = (target: Position) => {
    const { selectedPiece } = chess.gameState;
    if (!selectedPiece) return;
    const norm = normalizePos(target.x, target.y);

    if (p2p.isP2PMode && p2p.role === 'guest') {
      p2p.actions?.sendMoveProposal({ type: 'move_proposal', pieceId: selectedPiece.id, from: selectedPiece.position, to: norm });
      chess.setGameState(prev => ({ ...prev, selectedPiece: null, validMoves: [] }));
      return;
    }

    if (p2p.isP2PMode && p2p.role === 'host') {
      p2pGame.seqRef.current++;
      p2p.actions?.sendMoveConfirm({ type: 'move_confirm', pieceId: selectedPiece.id, from: selectedPiece.position, to: norm, seq: p2pGame.seqRef.current });
    }

    chess.setGameState(prev => applyMoveToState(prev, selectedPiece, norm));
  };

  const handleResign = () => {
    const myColor: PieceColor = p2p.isP2PMode ? (p2p.playerColor ?? 'white') : chess.gameState.currentTurn;
    if (p2p.isP2PMode) p2p.actions?.sendResign({ type: 'resign' });
    chess.setGameState(prev => ({
      ...prev, gameOver: true,
      winner: myColor === 'white' ? 'black' : 'white',
      surrenderedBy: myColor,
    }));
  };

  const returnPath = p2p.isP2PMode ? '/p2p' : '/local';
  const handleLeaveP2P = () => { p2p.leaveRoom(); navigate(returnPath); };

  // ── Board orientation ──────────────────────────────────────────────────────
  const lockedColor: PieceColor | null = p2p.isP2PMode ? p2p.playerColor : (chess.aiEnabled ? 'white' : null);
  const boardFlipped = p2p.isP2PMode
    ? p2p.playerColor === 'black'
    : !chess.aiEnabled && chess.settings.flipBoard
      ? chess.gameState.currentTurn === 'black'
      : false;
  const rotatePieces = !p2p.isP2PMode && !chess.aiEnabled && !chess.settings.flipBoard;

  const playTypeLabel = p2p.isP2PMode ? t('modeSelect.multiplayer') : t('modeSelect.local');

  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar
        breadcrumbs={[
          { label: playTypeLabel },
          { label: t(`modes.${chess.gameState.gameMode.id}.title`) },
        ]}
        onSurrender={handleResign}
        gameSettings={!p2p.isP2PMode ? chess.settings : null}
        onGameSettingsChange={!p2p.isP2PMode ? chess.handleSettingsChange : undefined}
      />

      {p2p.isP2PMode && (
        <P2PStatusBar
          connectionState={p2p.connectionState}
          playerColor={p2p.playerColor}
          currentTurn={chess.gameState.currentTurn}
          onLeave={handleLeaveP2P}
        />
      )}

      <div className="flex items-center justify-center p-8">
        <ChessBoard
          pieces={chess.gameState.pieces}
          currentTurn={chess.gameState.currentTurn}
          selectedPiece={chess.gameState.selectedPiece}
          validMoves={chess.gameState.validMoves}
          isCheck={chess.gameState.isCheck}
          onPieceSelect={handlePieceSelect}
          onMove={handleMove}
          gameMode={chess.gameState.gameMode}
          lockedColor={lockedColor}
          flipped={boardFlipped}
          rotateBlackPieces={rotatePieces}
        />
      </div>

      {chess.gameState.gameOver && (
        <GameOver
          winner={chess.gameState.winner}
          drawReason={chess.gameState.drawReason}
          surrenderedBy={chess.gameState.surrenderedBy}
          duration={Date.now() - chess.gameState.startTime}
          moveCount={chess.gameState.winner
            ? chess.gameState.moveCount[chess.gameState.winner]
            : chess.gameState.moveCount.white + chess.gameState.moveCount.black}
          onReplay={chess.handleReplay}
          aiEnabled={chess.aiEnabled}
          aiDifficulty={chess.settings.aiDifficulty}
          isP2PMode={p2p.isP2PMode}
          playerColor={p2p.playerColor}
          rematchState={p2pGame.rematchState}
          peerLeft={p2pGame.peerLeft}
          onRematch={p2pGame.handleRematch}
          onAcceptRematch={p2pGame.handleAcceptRematch}
          onDeclineRematch={p2pGame.handleDeclineRematch}
          onMainMenu={p2p.isP2PMode ? handleLeaveP2P : undefined}
          returnPath={returnPath}
        />
      )}
    </div>
  );
}
