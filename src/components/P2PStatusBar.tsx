import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { P2PConnectionState } from '../types/p2p';
import { PieceColor } from '../types/chess';

interface P2PStatusBarProps {
  connectionState: P2PConnectionState;
  playerColor: PieceColor | null;
  currentTurn: PieceColor;
  onLeave: () => void;
}

export default function P2PStatusBar({ connectionState, playerColor, currentTurn, onLeave }: P2PStatusBarProps) {
  if (connectionState === 'disconnected') {
    return (
      <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff size={18} />
          <span className="font-semibold">Opponent disconnected</span>
        </div>
        <button
          onClick={onLeave}
          className="px-4 py-1 bg-white text-red-600 rounded font-semibold text-sm hover:bg-red-50"
        >
          Back to menu
        </button>
      </div>
    );
  }

  if (connectionState === 'connected') {
    const isMyTurn = playerColor === currentTurn;
    return (
      <div className="bg-indigo-600 text-white px-4 py-2 flex items-center gap-3 text-sm">
        <Wifi size={16} className="shrink-0" />
        <span>
          You play as <strong>{playerColor === 'white' ? 'White' : 'Black'}</strong>
        </span>
        <span className="mx-2 text-indigo-300">·</span>
        <span className={isMyTurn ? 'font-semibold text-yellow-300' : 'text-indigo-200'}>
          {isMyTurn ? 'Your turn' : "Opponent's turn"}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 text-white px-4 py-2 flex items-center gap-2 text-sm">
      <Loader2 size={16} className="animate-spin shrink-0" />
      <span>Establishing P2P connection…</span>
    </div>
  );
}
