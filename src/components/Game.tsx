import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flag, Settings } from 'lucide-react';
import ChessBoard from './ChessBoard';
import GameOver from './GameOver';
import GameSettings from './GameSettings';
import P2PStatusBar from './P2PStatusBar';
import { GameState, Piece, Position, GameMode, PieceColor } from '../types/chess';
import {
  getInitialPieces,
  isValidMove,
  isInCheck,
  hasLegalMoves,
  wouldBeInCheck,
  getValidMoves,
  findCastlingMove
} from '../utils/chess';
import { gameModes } from './GameModes';
import { ChessAI } from '../services/ChessAI';
import { useP2P } from '../context/P2PContext';

const STORAGE_KEY = 'chess_settings';

// Resolve game mode for the P2P route (modeId === 'p2p')
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
    playerColor,
    connectionState,
    gameMode: p2pGameMode,
    initialPieces: p2pInitialPieces,
    actions,
    room,
    leaveRoom,
  } = useP2P();

  const gameMode = resolveGameMode(modeId, p2pGameMode);

  // Charger les settings depuis le localStorage
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    return savedSettings ? JSON.parse(savedSettings) : {
      aiEnabled: true,
      aiDifficulty: 5
    };
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

  // Sauvegarder les settings dans le localStorage quand ils changent
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!modeId) {
      navigate('/');
      return;
    }

    // In P2P mode, wait for gameMode to arrive from host before initialising
    if (modeId === 'p2p' && !p2pGameMode) return;

    const pieces = (modeId === 'p2p' && p2pInitialPieces)
      ? p2pInitialPieces
      : getInitialPieces(gameMode);

    setGameState(prev => ({ ...prev, pieces, gameMode }));

    // Only initialise AI for non-P2P games
    if (!isP2PMode) {
      const initAI = () => {
        if (!aiRef.current) {
          try {
            aiRef.current = new ChessAI();
          } catch (error) {
            console.error('Erreur lors de l\'initialisation de l\'IA:', error);
          }
        }
      };
      initAI();
    }

    return () => {
      if (aiRef.current) {
        aiRef.current.destroy();
        aiRef.current = null;
      }
    };
  }, [modeId, navigate, p2pGameMode, p2pInitialPieces]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI trigger ─────────────────────────────────────────────────────────────
  const aiEnabled = settings.aiEnabled && !isP2PMode;

  useEffect(() => {
    if (aiEnabled && gameState.currentTurn === 'black' && !gameState.gameOver) {
      setTimeout(() => { handleAIMove(); }, 500);
    }
  }, [gameState.currentTurn, aiEnabled, gameState.gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── P2P: receive remote moves ──────────────────────────────────────────────
  useEffect(() => {
    if (!isP2PMode || !actions) return;

    actions.onMove((msg) => {
      setGameState(prev => {
        const piece = prev.pieces.find(p => p.id === msg.pieceId);
        if (!piece) return prev;
        return applyMoveToState(prev, piece, msg.to);
      });
    });

    actions.onResign(() => {
      setGameState(prev => ({
        ...prev,
        gameOver: true,
        winner: playerColor ?? 'white',
      }));
    });
  }, [isP2PMode, actions, playerColor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── P2P: handle disconnection mid-game ────────────────────────────────────
  useEffect(() => {
    if (isP2PMode && connectionState === 'disconnected' && !gameState.gameOver) {
      // keep game visible; P2PStatusBar shows the banner
    }
  }, [isP2PMode, connectionState, gameState.gameOver]);

  // ── Pure state-transition helper ───────────────────────────────────────────
  function applyMoveToState(prev: GameState, piece: Piece, target: Position): GameState {
    const normalizedTarget = {
      x: ((target.x % 8) + 8) % 8,
      y: ((target.y % 8) + 8) % 8,
    };

    const castlingMove = findCastlingMove(piece, normalizedTarget, prev.pieces, prev.gameMode);

    const capturedPiece = prev.pieces.find(p =>
      p.position.x === normalizedTarget.x &&
      p.position.y === normalizedTarget.y
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
      newPieces = newPieces.map(p => {
        if (p.id === castlingMove.rook.id) {
          return { ...p, position: castlingMove.rookTarget, hasMoved: true };
        }
        return p;
      });
    }

    if (capturedPiece?.type === 'king') {
      return {
        ...prev,
        pieces: newPieces,
        currentTurn: prev.currentTurn === 'white' ? 'black' : 'white',
        selectedPiece: null,
        validMoves: [],
        isCheck: false,
        moveCount: { ...prev.moveCount, [prev.currentTurn]: prev.moveCount[prev.currentTurn] + 1 },
        gameOver: true,
        winner: prev.currentTurn,
      };
    }

    const onlyKingsLeft = newPieces.every(p => p.type === 'king');
    if (onlyKingsLeft) {
      return {
        ...prev,
        pieces: newPieces,
        currentTurn: prev.currentTurn === 'white' ? 'black' : 'white',
        selectedPiece: null,
        validMoves: [],
        isCheck: false,
        moveCount: { ...prev.moveCount, [prev.currentTurn]: prev.moveCount[prev.currentTurn] + 1 },
        gameOver: true,
        winner: null,
        drawReason: 'only-kings',
      };
    }

    const nextTurn: PieceColor = prev.currentTurn === 'white' ? 'black' : 'white';
    const nextIsCheck = isInCheck(nextTurn, newPieces, prev.gameMode);
    const nextHasLegalMoves = hasLegalMoves(nextTurn, newPieces, prev.gameMode);
    const isCheckmate = nextIsCheck && !nextHasLegalMoves;
    const isStalemate = !nextIsCheck && !nextHasLegalMoves;

    return {
      ...prev,
      pieces: newPieces,
      currentTurn: nextTurn,
      selectedPiece: null,
      validMoves: [],
      isCheck: nextIsCheck,
      moveCount: { ...prev.moveCount, [prev.currentTurn]: prev.moveCount[prev.currentTurn] + 1 },
      gameOver: isCheckmate || isStalemate,
      winner: isCheckmate ? prev.currentTurn : null,
      drawReason: isStalemate ? 'stalemate' : undefined,
    };
  }

  const handleAIMove = async () => {
    if (!aiRef.current) {
      setTimeout(() => handleAIMove(), 1000);
      return;
    }

    try {
      const move = await aiRef.current.getNextMove(gameState.pieces);

      const piece = gameState.pieces.find(
        p => p.position.x === move.from.x && p.position.y === move.from.y && p.color === 'black'
      );

      if (!piece) return;

      const validMoves = getValidMoves(piece, gameState.pieces, gameState.gameMode);
      const isValid = validMoves.some(v => v.x === move.to.x && v.y === move.to.y);
      if (!isValid) return;

      setGameState(prev => applyMoveToState(prev, piece, move.to));
    } catch (error) {
      console.error("Erreur lors du mouvement de l'IA:", error);
    }
  };

  const handleSettingsChange = (newSettings: typeof settings) => {
    setSettings(newSettings);
    if (aiRef.current) {
      aiRef.current.setDifficulty(newSettings.aiDifficulty);
    }
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

    const normalizedTarget = {
      x: ((target.x % 8) + 8) % 8,
      y: ((target.y % 8) + 8) % 8,
    };

    const piece = gameState.selectedPiece;

    // Send move to peer before applying locally
    if (isP2PMode && actions) {
      actions.sendMove({
        type: 'move',
        pieceId: piece.id,
        from: piece.position,
        to: normalizedTarget,
      });
    }

    setGameState(prev => applyMoveToState(prev, piece, normalizedTarget));
  };

  const handleResign = () => {
    if (isP2PMode && actions) {
      actions.sendResign({ type: 'resign' });
    }
    setGameState(prev => ({
      ...prev,
      gameOver: true,
      winner: prev.currentTurn === 'white' ? 'black' : 'white',
    }));
  };

  const handleReplay = () => {
    setGameState({
      pieces: getInitialPieces(gameMode),
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

  const handleLeaveP2P = () => {
    leaveRoom();
    navigate('/');
  };

  // Locked color for ChessBoard: in P2P mode lock to the local player's color
  const lockedColor = isP2PMode ? playerColor : (aiEnabled ? 'white' : null);

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
          duration={Date.now() - gameState.startTime}
          moveCount={gameState.winner ? gameState.moveCount[gameState.winner] : gameState.moveCount.white + gameState.moveCount.black}
          onReplay={isP2PMode ? handleLeaveP2P : handleReplay}
          aiEnabled={aiEnabled}
          aiDifficulty={settings.aiDifficulty}
        />
      )}
    </div>
  );
}
