import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Copy, Share2, Users, Loader2, CheckCircle, WifiOff, ArrowLeft } from 'lucide-react';
import { useP2P } from '../context/P2PContext';
import { gameModes } from './GameModes';
import { GameMode } from '../types/chess';
import { generateRoomId } from '../services/TrysteroService';

export default function P2PLobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
          <Users size={48} className="mx-auto mb-4 text-blue-500" />
          <h1 className="text-3xl font-bold mb-2">Join game</h1>
          <p className="text-gray-500 mb-8">Connecting via P2P…</p>

          {connectionState === 'connecting' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={40} className="animate-spin text-blue-500" />
              <p className="text-gray-600">Waiting for host…</p>
            </div>
          )}

          {connectionState === 'connected' && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle size={40} className="text-green-500" />
              <p className="text-gray-600 font-semibold">Connected! Starting…</p>
            </div>
          )}

          {connectionState === 'disconnected' && (
            <div className="flex flex-col items-center gap-4">
              <WifiOff size={40} className="text-red-500" />
              <p className="text-red-600 font-semibold">Connection lost</p>
              <button onClick={handleBack} className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                Back to menu
              </button>
            </div>
          )}

          {connectionState !== 'disconnected' && (
            <button onClick={handleBack} className="mt-8 text-sm text-gray-400 hover:text-gray-600 underline">
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── HOST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-lg p-10 max-w-lg w-full">

        {/* Step 1 – Mode selection */}
        {!roomId && (
          <>
            <button onClick={handleBack} className="flex items-center gap-2 text-gray-400 hover:text-gray-700 mb-6 transition text-sm">
              <ArrowLeft size={16} /> Back
            </button>
            <h1 className="text-3xl font-bold text-center mb-2">P2P Game</h1>
            <p className="text-gray-500 text-center mb-6">Challenge a friend directly, no server needed</p>

            <h2 className="font-semibold text-lg mb-3">Choose a game mode</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {gameModes.map(mode => (
                <div
                  key={mode.id}
                  onClick={() => handleCreateGame(mode)}
                  className="rounded-lg overflow-hidden cursor-pointer border-2 border-transparent transition shadow-sm hover:shadow-md hover:border-blue-400 hover:scale-105"
                >
                  <img src={mode.image} alt={mode.title} className="w-full h-28 object-cover" />
                  <div className="p-3 bg-white">
                    <div className="font-semibold text-sm">{mode.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{mode.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 2 – Share the link */}
        {roomId && connectionState === 'waiting' && (
          <>
            <h1 className="text-3xl font-bold text-center mb-2">Invite your opponent</h1>
            <p className="text-gray-500 text-center mb-6">Share this QR code or link</p>

            <div className="text-center mb-6">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Invite QR code" className="mx-auto rounded-lg border border-gray-200" />
              ) : (
                <div className="w-[220px] h-[220px] mx-auto flex items-center justify-center bg-gray-100 rounded-lg">
                  <Loader2 size={32} className="animate-spin text-gray-400" />
                </div>
              )}
            </div>

            <div className="flex gap-2 mb-6">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
              >
                <Share2 size={16} /> Share link
              </button>
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
              >
                {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>

            <div className="flex items-center gap-3 py-4 bg-gray-50 rounded-lg px-4 mb-4">
              <Loader2 size={20} className="animate-spin text-blue-500 shrink-0" />
              <p className="text-gray-600 text-sm">Waiting for opponent…</p>
            </div>

            <button onClick={handleBack} className="w-full text-sm text-gray-400 hover:text-gray-600 underline">
              Cancel
            </button>
          </>
        )}

        {/* Step 3 – Connected, navigating */}
        {connectionState === 'connected' && (
          <div className="text-center py-8">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
            <p className="text-lg font-semibold">Opponent connected!</p>
            <p className="text-gray-500 text-sm mt-1">Starting game…</p>
          </div>
        )}
      </div>
    </div>
  );
}
