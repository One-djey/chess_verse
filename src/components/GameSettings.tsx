import { useEffect, useState } from "react";
import { X, Download, Check, MessageSquare, ChevronDown, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDifficultyKey } from "../utils/chess";
import { SUPPORTED_LANGUAGES, SupportedLanguage } from "../i18n";
import { useInstall } from "../context/InstallContext";
import { useSkin } from "../context/SkinContext";
import { SKINS, getPieceImageSrc } from "../utils/pieceImage";

const FEEDBACK_EMAIL = "contact@jeremy-maisse.com";

type GameSettingsState = {
  aiEnabled: boolean;
  aiDifficulty: number;
  flipBoard: boolean;
};

interface GameSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pass null/undefined to show language-only (e.g. from non-game screens) */
  settings?: GameSettingsState | null;
  onSettingsChange?: (settings: GameSettingsState) => void;
}

export default function GameSettings({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: GameSettingsProps) {
  const { t, i18n } = useTranslation();
  const { canInstall, triggerInstall } = useInstall();
  const { skin, setSkin } = useSkin();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<"bug" | "feature" | "general">("general");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setFeedbackOpen(false);
      setFeedbackCategory("general");
      setFeedbackMessage("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFeedbackSubmit = () => {
    const categoryLabel = t(`feedback.categories.${feedbackCategory}`);
    const subject = encodeURIComponent(`ChessVerse - ${categoryLabel}`);
    const body = encodeURIComponent(feedbackMessage);
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
  };

  const hasGameSettings = settings != null && onSettingsChange != null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl w-96 transform transition-all">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {t("gameSettings.title")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Game type (only when in a local game) ── */}
          {hasGameSettings && (
            <div className="space-y-4">
              <label className="text-base font-medium text-gray-900">
                {t("gameSettings.gameType")}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`p-3 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                    !settings!.aiEnabled
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                  onClick={() =>
                    onSettingsChange!({ ...settings!, aiEnabled: false })
                  }
                >
                  {t("gameSettings.soloPlay")}
                </button>
                <button
                  className={`p-3 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                    settings!.aiEnabled
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                  onClick={() =>
                    onSettingsChange!({ ...settings!, aiEnabled: true })
                  }
                >
                  {t("gameSettings.vsAI")}
                </button>
              </div>
            </div>
          )}

          {/* ── Flip board (solo only) ── */}
          {hasGameSettings && (
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                !settings!.aiEnabled
                  ? "opacity-100 max-h-20"
                  : "opacity-0 max-h-0"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-medium text-gray-900">
                    {t("gameSettings.flipBoard")}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("gameSettings.flipBoardDesc")}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={settings!.flipBoard}
                  onClick={() =>
                    onSettingsChange!({
                      ...settings!,
                      flipBoard: !settings!.flipBoard,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                    settings!.flipBoard ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                      settings!.flipBoard ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* ── AI Difficulty ── */}
          {hasGameSettings && (
            <div
              className={`space-y-3 transition-all duration-300 ease-in-out overflow-hidden ${
                settings!.aiEnabled
                  ? "opacity-100 max-h-32"
                  : "opacity-0 max-h-0"
              }`}
            >
              <label className="text-base font-medium text-gray-900">
                {t("gameSettings.aiDifficulty")}
              </label>
              <div className="space-y-2">
                <span className="text-sm text-gray-500">
                  {t(getDifficultyKey(settings!.aiDifficulty))} (Elo ~
                  {1000 + settings!.aiDifficulty * 100})
                </span>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={settings!.aiDifficulty}
                  onChange={(e) =>
                    onSettingsChange!({
                      ...settings!,
                      aiDifficulty: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{t("gameSettings.beginner")}</span>
                  <span>{t("gameSettings.superhuman")}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Piece appearance (always visible) ── */}
          <div className="space-y-3">
            <label className="text-base font-medium text-gray-900">
              {t("gameSettings.pieceAppearance")}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SKINS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSkin(s.id)}
                  className={`relative p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                    skin === s.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex gap-1 mb-2">
                    {(["king", "queen", "knight"] as const).map((type) => (
                      <img
                        key={type}
                        src={getPieceImageSrc("white", type, s.id)}
                        alt={type}
                        className="w-8 h-8"
                      />
                    ))}
                  </div>
                  <span
                    className={`text-sm font-medium ${skin === s.id ? "text-blue-700" : "text-gray-600"}`}
                  >
                    {t(`skins.${s.id}`)}
                  </span>
                  {skin === s.id && (
                    <Check
                      size={14}
                      className="absolute top-2 right-2 text-blue-600"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Language selector (always visible) ── */}
          <div className="space-y-3">
            <label className="text-base font-medium text-gray-900">
              {t("gameSettings.language")}
            </label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((lng: SupportedLanguage) => (
                <button
                  key={lng}
                  onClick={() => i18n.changeLanguage(lng)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    i18n.resolvedLanguage === lng
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t(`languages.${lng}`)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Support ── */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => setFeedbackOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            >
              <MessageSquare size={16} />
              {t("feedback.button")}
              <ChevronDown
                size={14}
                className={`ml-auto transition-transform duration-300 ${feedbackOpen ? "rotate-180" : ""}`}
              />
            </button>

            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                feedbackOpen ? "opacity-100 max-h-96" : "opacity-0 max-h-0"
              }`}
            >
              <div className="pt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(["bug", "feature", "general"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFeedbackCategory(cat)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        feedbackCategory === cat
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {t(`feedback.categories.${cat}`)}
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder={t("feedback.messagePlaceholder")}
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleFeedbackSubmit}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition"
                >
                  <Send size={16} />
                  {t("feedback.submit")}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  {t("feedback.note")}
                </p>
              </div>
            </div>
          </div>

          {/* ── Install app (only when installable and not already PWA) ── */}
          {canInstall && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={triggerInstall}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition"
              >
                <Download size={16} />
                {t("install.cta")} ChessVerse
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
