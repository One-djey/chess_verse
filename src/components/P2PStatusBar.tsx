import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { P2PConnectionState } from '../types/p2p';
import { PieceColor } from '../types/chess';

interface P2PStatusBarProps {
  connectionState: P2PConnectionState;
  playerColor: PieceColor | null;
  currentTurn: PieceColor;
  onLeave: () => void;
}

export default function P2PStatusBar({ connectionState, playerColor, currentTurn, onLeave }: P2PStatusBarProps) {
  const { t } = useTranslation();

  if (connectionState === 'disconnected') {
    return (
      <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff size={18} />
          <span className="font-semibold">{t('p2pStatus.opponentDisconnected')}</span>
        </div>
        <button
          onClick={onLeave}
          className="px-4 py-1 bg-white text-red-600 rounded font-semibold text-sm hover:bg-red-50"
        >
          {t('p2p.backToMenu')}
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
          {t('p2pStatus.youPlayAs')} <strong>{playerColor === 'white' ? t('p2pStatus.white') : t('p2pStatus.black')}</strong>
        </span>
        <span className="mx-2 text-indigo-300">·</span>
        <span className={isMyTurn ? 'font-semibold text-yellow-300' : 'text-indigo-200'}>
          {isMyTurn ? t('p2pStatus.yourTurn') : t('p2pStatus.opponentTurn')}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 text-white px-4 py-2 flex items-center gap-2 text-sm">
      <Loader2 size={16} className="animate-spin shrink-0" />
      <span>{t('p2pStatus.establishing')}</span>
    </div>
  );
}
