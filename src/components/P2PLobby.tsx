import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Copy, Share2, Users, Loader2, CheckCircle, WifiOff } from 'lucide-react';
import { useP2P } from '../context/P2PContext';
import { gameModes } from './GameModes';
import { GameMode } from '../types/chess';
import { generateRoomId } from '../services/TrysteroService';
import { getInitialPieces } from '../utils/chess';
import { ColorAssignMessage } from '../types/p2p';

export default function P2PLobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomParam = searchParams.get('room');
  const isGuest = Boolean(roomParam);

  const {
    startRoom,
    joinExistingRoom,
    setColorAssign,
    setConnectionState,
    setInitialPieces,
    leaveRoom,
    room,
    actions,
    connectionState,
    playerColor,
  } = useP2P();

  const [selectedMode, setSelectedMode] = useState<GameMode>(gameModes[0]);
  const [roomId, setRoomId] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);
  const navigatedRef = useRef(false);

  // ── GUEST: auto-join on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (isGuest && roomParam && !started) {
      setStarted(true);
      joinExistingRoom(roomParam);
    }
  }, [isGuest, roomParam, started, joinExistingRoom]);

  // ── HOST: generate QR after startRoom is called ────────────────────────────
  useEffect(() => {
    if (!roomId || isGuest) return;
    const url = `${window.location.origin}/p2p?room=${roomId}`;
    setShareUrl(url);
    QRCode.toDataURL(url, { width: 220, margin: 2 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [roomId, isGuest]);

  // ── Listen for peer events once room is set up ─────────────────────────────
  useEffect(() => {
    if (!room || !actions) return;

    if (!isGuest) {
      // HOST: wait for guest to join, send color_assign + sync_state for ALL modes
      room.onPeerJoin(() => {
        setConnectionState('connected');

        const pieces = getInitialPieces(selectedMode);
        setInitialPieces(pieces);

        const msg: ColorAssignMessage = {
          type: 'color_assign',
          hostColor: 'white',
          guestColor: 'black',
          gameMode: selectedMode,
        };
        // Send sync_state first so guest has pieces before color_assign triggers navigation
        actions.sendSyncState({ type: 'sync_state', pieces });
        actions.sendColorAssign(msg);

        if (!navigatedRef.current) {
          navigatedRef.current = true;
          navigate('/game/p2p');
        }
      });

      room.onPeerLeave(() => setConnectionState('disconnected'));
    } else {
      // GUEST: wait for BOTH sync_state AND color_assign before navigating
      const receivedRef = { color: false, sync: false };

      const tryNavigate = () => {
        if (receivedRef.color && receivedRef.sync && !navigatedRef.current) {
          navigatedRef.current = true;
          navigate('/game/p2p');
        }
      };

      actions.onColorAssign((msg) => {
        setColorAssign(msg);
        setConnectionState('connected');
        receivedRef.color = true;
        tryNavigate();
      });

      actions.onSyncState((msg) => {
        setInitialPieces(msg.pieces);
        receivedRef.sync = true;
        tryNavigate();
      });

      room.onPeerLeave(() => setConnectionState('disconnected'));
    }
  }, [room, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateGame = () => {
    const id = generateRoomId();
    setRoomId(id);
    startRoom(id);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ChessVerse – Join my game!', url: shareUrl });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  const handleBack = () => {
    leaveRoom();
    navigate('/');
  };

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
        <h1 className="text-3xl font-bold text-center mb-2">P2P Game</h1>
        <p className="text-gray-500 text-center mb-8">Challenge a friend directly, no server needed</p>

        {/* Step 1 – Mode selection */}
        {!roomId && (
          <>
            <h2 className="font-semibold text-lg mb-3">Choose a game mode</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {gameModes.map(mode => (
                <div
                  key={mode.id}
                  onClick={() => setSelectedMode(mode)}
                  className={`rounded-lg overflow-hidden cursor-pointer border-2 transition shadow-sm hover:shadow-md ${
                    selectedMode.id === mode.id
                      ? 'border-blue-500'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <img src={mode.image} alt={mode.title} className="w-full h-28 object-cover" />
                  <div className="p-3 bg-white">
                    <div className="font-semibold text-sm">{mode.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{mode.description}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleCreateGame}
              className="w-full py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
            >
              Create game
            </button>
            <button onClick={handleBack} className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-gray-600 underline">
              Back to menu
            </button>
          </>
        )}

        {/* Step 2 – Share the link */}
        {roomId && connectionState === 'waiting' && (
          <>
            <div className="text-center mb-6">
              <p className="text-gray-600 mb-4">Share this QR code or link with your opponent</p>
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
                <Share2 size={16} />
                Share link
              </button>
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
              >
                {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>

            <div className="flex items-center gap-3 py-4 bg-gray-50 rounded-lg px-4">
              <Loader2 size={20} className="animate-spin text-blue-500 shrink-0" />
              <p className="text-gray-600 text-sm">Waiting for opponent…</p>
            </div>

            <button onClick={handleBack} className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 underline">
              Cancel
            </button>
          </>
        )}

        {/* Step 3 – Peer joined, navigating */}
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
