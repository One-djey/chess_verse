import { useState, useEffect, useRef } from 'react';
import { GameState, Piece, GameMode } from '../types/chess';
import { getInitialPieces } from '../utils/chess';
import { ChessAI } from '../services/ChessAI';

export type LocalSettings = {
  aiEnabled: boolean;
  aiDifficulty: number;
  flipBoard: boolean;
  showDangerIndicator: boolean;
  showHint: boolean;
  showMoveAnnotations: boolean;
};

const STORAGE_KEY = 'chess_settings';
const DEFAULT_SETTINGS: LocalSettings = {
  aiEnabled: true,
  aiDifficulty: 5,
  flipBoard: false,
  showDangerIndicator: false,
  showHint: false,
  showMoveAnnotations: false,
};

export function makeInitialState(pieces: Piece[], gameMode: GameMode): GameState {
  return {
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
  };
}

interface Params {
  modeId: string | undefined;
  navigate: (path: string) => void;
  gameMode: GameMode;
  isP2PMode: boolean;
  p2pInitialPieces: Piece[] | null;
}

export function useChessGame({ modeId, navigate, gameMode, isP2PMode, p2pInitialPieces }: Params) {
  const aiRef = useRef<ChessAI | null>(null);
  const gameStateRef = useRef<GameState | null>(null);

  const [settings, setSettings] = useState<LocalSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch { return DEFAULT_SETTINGS; }
  });

  const [gameState, setGameState] = useState<GameState>(() => makeInitialState([], gameMode));
  gameStateRef.current = gameState;

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Initialise board when route/mode is ready
  useEffect(() => {
    if (!modeId) { navigate('/'); return; }
    if (modeId === 'p2p' && isP2PMode && !p2pInitialPieces) return;

    const pieces = modeId === 'p2p' && p2pInitialPieces
      ? p2pInitialPieces
      : getInitialPieces(gameMode);

    setGameState(makeInitialState(pieces, gameMode));

    if (!isP2PMode && !aiRef.current) {
      try { aiRef.current = new ChessAI(); } catch (e) { console.error(e); }
    }

    return () => {
      if (aiRef.current) { aiRef.current.destroy(); aiRef.current = null; }
    };
  }, [modeId, isP2PMode, p2pInitialPieces]); // eslint-disable-line react-hooks/exhaustive-deps

  const aiEnabled = settings.aiEnabled && !isP2PMode;

  const handleSettingsChange = (next: LocalSettings) => {
    setSettings(next);
    aiRef.current?.setDifficulty(next.aiDifficulty);
  };

  const resetGame = (pieces: Piece[]) => setGameState(makeInitialState(pieces, gameMode));

  const handleReplay = () => resetGame(getInitialPieces(gameMode));

  return { gameState, setGameState, gameStateRef, settings, aiEnabled, aiRef, handleSettingsChange, resetGame, handleReplay };
}
