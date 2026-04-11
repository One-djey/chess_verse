import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { Copy, Share2, Loader2, CheckCircle, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useP2P } from "../context/P2PContext";
import { GameMode } from "../types/chess";
import { generateRoomId } from "../services/TrysteroService";
import { gameModes } from "./GameModes";
import { useSkin } from "../context/SkinContext";
import GameModeSelect from "./GameModeSelect";
import NavBar from "./NavBar";

// ── Shared card shell ─────────────────────────────────────────────────────────
function ModeInfoCard({
  mode,
  children,
}: {
  mode: GameMode | null;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-sm w-full">
      {mode ? (
        <img
          src={mode.image}
          alt={t(`modes.${mode.id}.title`)}
          className="w-full h-44 object-cover"
        />
      ) : (
        <div className="w-full h-44 bg-gray-200 animate-pulse" />
      )}

      <div className="p-6">
        {mode ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {t(`modes.${mode.id}.title`)}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              {t(`modes.${mode.id}.description`)}
            </p>
          </>
        ) : (
          <div className="mb-5">
            <div className="h-6 bg-gray-200 rounded animate-pulse mb-2 w-2/5" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-full mb-1.5" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function P2PLobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const roomParam = searchParams.get("room");
  const modeParam = searchParams.get("mode");
  const isGuest = Boolean(roomParam);
  const guestMode = gameModes.find((m) => m.id === modeParam) ?? null;

  const {
    startRoom,
    joinExistingRoom,
    leaveRoom,
    connectionState,
    isP2PMode,
    gameMode,
  } = useP2P();
  const { skin } = useSkin();

  const [roomId, setRoomId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const joinedRef = useRef(false);
  // Prevents leaveRoom() from being called when we intentionally navigate to the game
  const navigatingToGameRef = useRef(false);

  // ── Cleanup on unmount (NavBar click / browser back) ─────────────────────
  useEffect(() => {
    return () => {
      if (!navigatingToGameRef.current) leaveRoom();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GUEST: auto-join on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (isGuest && roomParam && !joinedRef.current) {
      joinedRef.current = true;
      joinExistingRoom(roomParam, guestMode, skin, () => {
        navigatingToGameRef.current = true;
        navigate("/game/p2p");
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HOST: generate QR when roomId is set ──────────────────────────────────
  useEffect(() => {
    if (!roomId || isGuest) return;
    const url = `${window.location.origin}/p2p?room=${roomId}&mode=${gameMode?.id}`;
    setShareUrl(url);
    QRCode.toDataURL(url, { width: 200, margin: 2 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateGame = (mode: GameMode) => {
    if (isP2PMode) leaveRoom();
    const id = generateRoomId();
    setRoomId(id);
    startRoom(id, mode, skin, () => {
      navigatingToGameRef.current = true;
      navigate("/game/p2p");
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ChessVerse",
          text: t("p2p.inviteText", {
            mode: gameMode ? t(`modes.${gameMode.id}.title`) : "ChessVerse",
          }),
          url: shareUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      handleCopy();
    }
  };

  const handleBack = () => {
    leaveRoom();
    navigate("/");
  };

  // ── GUEST VIEW ─────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <NavBar breadcrumbs={[{ label: t("modeSelect.multiplayer") }]} />

        <div className="flex-1 flex items-center justify-center p-8">
          <ModeInfoCard mode={gameMode}>
            {connectionState === "connecting" && (
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg">
                <Loader2
                  size={18}
                  className="animate-spin text-indigo-500 shrink-0"
                />
                <p className="text-gray-600 text-sm">
                  {t("p2p.waitingForHost")}
                </p>
              </div>
            )}
            {connectionState === "connected" && (
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-lg">
                <CheckCircle size={18} className="text-green-500 shrink-0" />
                <p className="text-green-700 text-sm font-medium">
                  {t("p2p.connectedStarting")}
                </p>
              </div>
            )}
            {connectionState === "disconnected" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 rounded-lg">
                  <WifiOff size={18} className="text-red-500 shrink-0" />
                  <p className="text-red-600 text-sm font-medium">
                    {t("p2p.connectionLost")}
                  </p>
                </div>
                <button
                  onClick={handleBack}
                  className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                >
                  {t("p2p.backToMenu")}
                </button>
              </div>
            )}
            {connectionState !== "disconnected" && (
              <button
                onClick={handleBack}
                className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600 underline"
              >
                {t("p2p.cancel")}
              </button>
            )}
          </ModeInfoCard>
        </div>
      </div>
    );
  }

  // ── HOST STEP 1 – Mode selection ──────────────────────────────────────────
  if (!roomId) {
    return (
      <GameModeSelect playType="multiplayer" onSelect={handleCreateGame} />
    );
  }

  // ── HOST STEP 2 – Share link ───────────────────────────────────────────────
  if (connectionState === "waiting") {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <NavBar
          breadcrumbs={[
            { label: t("modeSelect.multiplayer") },
            { label: t("nav.invite") },
          ]}
        />

        <div className="flex-1 flex items-center justify-center p-8">
          <ModeInfoCard mode={gameMode}>
            {/* QR code */}
            <div className="flex justify-center mb-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={t("p2p.inviteQrAlt")}
                  className="rounded-xl border border-gray-200"
                />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-50 rounded-xl">
                  <Loader2 size={28} className="animate-spin text-gray-400" />
                </div>
              )}
            </div>

            {/* Share / copy */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
              >
                <Share2 size={16} /> {t("p2p.shareLink")}
              </button>
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
              >
                {copied ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : (
                  <Copy size={16} />
                )}
                {copied ? t("p2p.copied") : t("p2p.copyLink")}
              </button>
            </div>

            {/* Waiting status */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg mb-4">
              <Loader2
                size={18}
                className="animate-spin text-indigo-500 shrink-0"
              />
              <p className="text-gray-600 text-sm">
                {t("p2p.waitingForOpponent")}
              </p>
            </div>

            <button
              onClick={handleBack}
              className="w-full text-sm text-gray-400 hover:text-gray-600 underline"
            >
              {t("p2p.cancel")}
            </button>
          </ModeInfoCard>
        </div>
      </div>
    );
  }

  // ── HOST STEP 3 – Opponent connected (brief transition state) ─────────────
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <NavBar
        breadcrumbs={[
          { label: t("modeSelect.multiplayer") },
          { label: t("nav.invite") },
        ]}
      />

      <div className="flex-1 flex items-center justify-center p-8">
        <ModeInfoCard mode={gameMode}>
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-lg">
            <CheckCircle size={18} className="text-green-500 shrink-0" />
            <p className="text-green-700 text-sm font-medium">
              {t("p2p.startingGame")}
            </p>
          </div>
        </ModeInfoCard>
      </div>
    </div>
  );
}
