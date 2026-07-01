import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GameMode } from "../types/chess";
import NavBar from "./NavBar";
import Footer from "./Footer";
import { ModeGrid } from "./GameModeSelect";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

type PlayType = "local" | "multiplayer";

const RING = {
  local: "hover:ring-blue-400",
  multiplayer: "hover:ring-indigo-400",
} as const;

export default function ModeSelect() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const [playTypeState, setPlayTypeState] = useState<PlayType>("local");
  const playType: PlayType = isOnline ? playTypeState : "local";

  const handleSelect = (mode: GameMode) => {
    if (playType === "local") {
      navigate(`/game/${mode.id}`);
    } else {
      navigate("/p2p", { state: { presetModeId: mode.id } });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <NavBar />

      <div className="max-w-5xl mx-auto px-6 pt-10 pb-12 flex-1 w-full">
        <div className="mb-10 flex justify-center">
          {isOnline ? (
            <div
              role="group"
              aria-label={t("modeSelect.subtitle")}
              className="inline-flex rounded-full bg-white shadow-md p-1"
            >
              {(["local", "multiplayer"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setPlayTypeState(type)}
                  aria-pressed={playType === type}
                  className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                    playType === type
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {type === "local"
                    ? t("modeSelect.local")
                    : t("modeSelect.multiplayer")}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-lg font-medium">
              {t("modeSelect.offlineMode")}
            </p>
          )}
        </div>

        <ModeGrid
          onSelect={handleSelect}
          filterModes={
            playType === "multiplayer"
              ? (mode) => !mode.rules?.zombieHorde
              : undefined
          }
          ring={RING[playType]}
        />
      </div>

      <Footer />
    </div>
  );
}
