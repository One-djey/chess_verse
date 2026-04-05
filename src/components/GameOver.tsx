import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Clock, Hash, Brain, RefreshCw, Loader2, Flag } from 'lucide-react';
import { getDifficultyDescription } from '../utils/chess';
import { PieceColor } from '../types/chess';
import { RematchState } from '../types/p2p';

interface GameOverProps {
  winner: PieceColor | null;
  drawReason?: 'stalemate' | 'only-kings';
  surrenderedBy?: PieceColor;
  duration: number;
  moveCount: number;
  onReplay: () => void;
  aiEnabled?: boolean;
  aiDifficulty?: number;
  // P2P-specific
  isP2PMode?: boolean;
  playerColor?: PieceColor | null;
  rematchState?: RematchState;
  onRematch?: () => void;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
}

export default function GameOver({
  winner, drawReason, surrenderedBy, duration, moveCount,
  onReplay, aiEnabled, aiDifficulty,
  isP2PMode, playerColor, rematchState, onRematch, onAcceptRematch, onDeclineRematch,
}: GameOverProps) {
  const navigate = useNavigate();
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  const isDraw = winner === null;

  // ── Title logic ────────────────────────────────────────────────────────────
  const getTitle = () => {
    if (isDraw) return 'Draw!';
    if (surrenderedBy) {
      if (isP2PMode) {
        return surrenderedBy === playerColor ? 'You surrendered' : 'Opponent surrendered';
      }
      // Local 2-player
      return `${surrenderedBy === 'white' ? 'White' : 'Black'} surrendered`;
    }
    if (isP2PMode) {
      return winner === playerColor ? 'You win!' : 'You lose!';
    }
    // vs AI
    return aiEnabled && winner === 'black' ? 'Defeat!' : 'Victory!';
  };

  const isDefeat = (isP2PMode && winner !== playerColor && !isDraw) ||
    (!isP2PMode && aiEnabled && winner === 'black');

  const stats = [
    { icon: <Clock className="w-5 h-5" />, label: 'Duration', value: `${minutes}m ${seconds}s` },
    { icon: <Hash className="w-5 h-5" />, label: 'Moves played', value: moveCount.toString() },
    ...(aiEnabled && aiDifficulty ? [{
      icon: <Brain className="w-5 h-5" />, label: 'AI Level', value: getDifficultyDescription(aiDifficulty)
    }] : []),
  ];

  // ── Rematch section (P2P only) ─────────────────────────────────────────────
  const renderRematch = () => {
    if (!isP2PMode) return null;

    if (rematchState === 'offered') {
      return (
        <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-center">
          <p className="font-semibold text-indigo-800 mb-3">Opponent wants a rematch!</p>
          <div className="flex gap-3">
            <button
              onClick={onAcceptRematch}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-medium transition"
            >
              Accept
            </button>
            <button
              onClick={onDeclineRematch}
              className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 font-medium transition"
            >
              Decline
            </button>
          </div>
        </div>
      );
    }

    if (rematchState === 'requested' || rematchState === 'starting') {
      return (
        <div className="mb-4 flex items-center justify-center gap-2 p-3 bg-gray-50 rounded-lg text-gray-500 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Waiting for opponent…
        </div>
      );
    }

    // idle — show rematch button
    return (
      <button
        onClick={onRematch}
        className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-medium"
      >
        <RefreshCw size={18} />
        Rematch
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          <div className="mb-12 relative">
            {surrenderedBy ? (
              <Flag className={`w-16 h-16 mx-auto ${isDefeat ? 'text-gray-400' : 'text-yellow-400'}`} />
            ) : (
              <Trophy className={`w-16 h-16 mx-auto ${isDraw ? 'text-blue-400' : isDefeat ? 'text-gray-400' : 'text-yellow-400'}`} />
            )}
            {!isDraw && (
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-4 py-1 rounded-full border border-gray-200">
                <span className="text-sm font-medium text-gray-600">
                  {isP2PMode
                    ? (winner === playerColor ? 'You' : 'Opponent')
                    : (winner === 'white' ? 'White' : 'Black')}
                </span>
              </div>
            )}
          </div>

          <h2 className="text-3xl font-bold mb-2">{getTitle()}</h2>
          {isDraw && drawReason && (
            <p className="text-sm text-gray-500 mb-6">
              {drawReason === 'stalemate' ? 'Stalemate — no legal moves' : 'Only kings remain'}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 mb-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-3 text-gray-600">
                  {stat.icon}
                  <span className="font-medium">{stat.label}</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Rematch (P2P) */}
          {renderRematch()}

          {/* Bottom buttons */}
          <div className="flex gap-4 justify-center mt-2">
            {!isP2PMode && (
              <button
                onClick={onReplay}
                className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition font-medium"
              >
                Play Again
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
