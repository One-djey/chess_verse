import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Copy, Share2, Users, Loader2, CheckCircle, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useP2P } from '../context/P2PContext';
import { GameMode } from '../types/chess';
import { generateRoomId } from '../services/TrysteroService';
import GameModeSelect from './GameModeSelect';
import NavBar from './NavBar';

export default function P2PLobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const roomParam = searchParams.get('room');
  const isGuest = Boolean(roomParam);

  const { startRoom, joinExistingRoom, leaveRoom, connectionState } = useP2P();

  const [roomId, setRoomId] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const joinedRef = useRef(false);

  // ── GUEST: auto-join on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (isGuest && roomParam && !joinedRef.current) {
      joinedRef.current = true;
      joinExistingRoom(roomParam, () => navigate('/game/p2p'));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HOST: generate QR when roomId is set ──────────────────────────────────
  useEffect(() => {
    if (!roomId || isGuest) return;
    const url = `${window.location.origin}/p2p?room=${roomId}`;
    setShareUrl(url);
    QRCode.toDataURL(url, { width: 220, margin: 2 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateGame = (mode: GameMode) => {
    const id = generateRoomId();
    setRoomId(id);
    startRoom(id, mode, () => navigate('/game/p2p'));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'ChessVerse – Join my game!', url: shareUrl }); }
      catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  const handleBack = () => { leaveRoom(); navigate('/'); };

  // ── GUEST VIEW ─────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <NavBar breadcrumbs={[{ label: t('modeSelect.multiplayer') }]} />

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
            <Users size={48} className="mx-auto mb-4 text-indigo-500" />
            <h1 className="text-3xl font-bold mb-2">{t('p2p.joinGame')}</h1>
            <p className="text-gray-500 mb-8">{t('p2p.connectingViaP2P')}</p>

            {connectionState === 'connecting' && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={40} className="animate-spin text-indigo-500" />
                <p className="text-gray-600">{t('p2p.waitingForHost')}</p>
              </div>
            )}

            {connectionState === 'connected' && (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle size={40} className="text-green-500" />
                <p className="text-gray-600 font-semibold">{t('p2p.connectedStarting')}</p>
              </div>
            )}

            {connectionState === 'disconnected' && (
              <div className="flex flex-col items-center gap-4">
                <WifiOff size={40} className="text-red-500" />
                <p className="text-red-600 font-semibold">{t('p2p.connectionLost')}</p>
                <button onClick={handleBack} className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                  {t('p2p.backToMenu')}
                </button>
              </div>
            )}

            {connectionState !== 'disconnected' && (
              <button onClick={handleBack} className="mt-8 text-sm text-gray-400 hover:text-gray-600 underline">
                {t('p2p.cancel')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── HOST STEP 1 – Mode selection ──────────────────────────────────────────
  if (!roomId) {
    return (
      <GameModeSelect
        playType="multiplayer"
        onSelect={handleCreateGame}
      />
    );
  }

  // ── HOST STEP 2 – Share link ───────────────────────────────────────────────
  if (connectionState === 'waiting') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <NavBar
          breadcrumbs={[
            { label: t('modeSelect.multiplayer') },
            { label: t('nav.invite') },
          ]}
        />

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full">
            <h1 className="text-2xl font-bold text-center mb-1">{t('p2p.inviteOpponent')}</h1>
            <p className="text-gray-500 text-center text-sm mb-6">{t('p2p.shareQrOrLink')}</p>

            <div className="text-center mb-6">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={t('p2p.inviteQrAlt')} className="mx-auto rounded-xl border border-gray-200" />
              ) : (
                <div className="w-[220px] h-[220px] mx-auto flex items-center justify-center bg-gray-50 rounded-xl">
                  <Loader2 size={32} className="animate-spin text-gray-400" />
                </div>
              )}
            </div>

            <div className="flex gap-2 mb-5">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
              >
                <Share2 size={16} /> {t('p2p.shareLink')}
              </button>
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
              >
                {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                {copied ? t('p2p.copied') : t('p2p.copyLink')}
              </button>
            </div>

            <div className="flex items-center gap-3 py-3 bg-gray-50 rounded-lg px-4 mb-4">
              <Loader2 size={18} className="animate-spin text-indigo-500 shrink-0" />
              <p className="text-gray-600 text-sm">{t('p2p.waitingForOpponent')}</p>
            </div>

            <button onClick={handleBack} className="w-full text-sm text-gray-400 hover:text-gray-600 underline">
              {t('p2p.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── HOST STEP 3 – Opponent connected ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <NavBar
        breadcrumbs={[
          { label: t('modeSelect.multiplayer') },
          { label: t('nav.invite') },
        ]}
      />

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
          <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
          <p className="text-lg font-semibold">{t('p2p.opponentConnected')}</p>
          <p className="text-gray-500 text-sm mt-1">{t('p2p.startingGame')}</p>
        </div>
      </div>
    </div>
  );
}
