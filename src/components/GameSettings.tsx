import { useState } from "react";
import {
  X,
  Download,
  Check,
  MessageSquare,
  Coffee,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDifficultyKey } from "../utils/chess";
import { SUPPORTED_LANGUAGES, SupportedLanguage } from "../i18n";
import { useInstall } from "../context/InstallContext";
import { useSkin } from "../context/SkinContext";
import { SKINS, getPieceImageSrc } from "../utils/pieceImage";
import FeedbackModal from "./FeedbackModal";
import type { LocalSettings } from "../hooks/useChessGame";

// Mirrors the key and defaults from useChessGame — kept in sync manually
const SETTINGS_STORAGE_KEY = "chess_settings";
const FALLBACK_SETTINGS: LocalSettings = {
  aiEnabled: true,
  aiDifficulty: 5,
  flipBoard: false,
  showDangerIndicator: false,
  showHint: false,
  showMoveAnnotations: false,
};

interface GameSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pass null/undefined to show language-only (e.g. from non-game screens) */
  settings?: LocalSettings | null;
  onSettingsChange?: (settings: LocalSettings) => void;
}

// Flag emoji per language code
const LANGUAGE_FLAGS: Partial<Record<SupportedLanguage, string>> = {
  en: "🇬🇧",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
  ar: "🇸🇦",
  ja: "🇯🇵",
  zh: "🇨🇳",
  ko: "🇰🇷",
};

// ── Selectable card toggle (replaces the old on/off switch row) ─────────────
function CardToggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
        checked
          ? "border-blue-600 bg-blue-50"
          : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-sm font-medium leading-snug ${
            checked ? "text-blue-700" : "text-gray-700"
          }`}
        >
          {label}
        </span>
        <span
          className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-semibold tracking-wide ${
            checked ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
          }`}
        >
          {checked ? "ON" : "OFF"}
        </span>
      </div>
      {desc && (
        <p className="text-xs text-gray-500 mt-1 leading-snug">{desc}</p>
      )}
    </button>
  );
}

// ── Segmented difficulty gauge (replaces the plain range slider) ────────────
function DifficultyGauge({
  value,
  onChange,
  labelMin,
  labelMax,
  levelLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  labelMin: string;
  labelMax: string;
  levelLabel: string;
}) {
  const total = 20;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-700">
          {levelLabel}
        </span>
        <span className="text-xs text-gray-400 tabular-nums">
          Elo ~{1000 + value * 100}
        </span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((seg) => {
          const filled = seg <= value;
          let filledColor = "bg-green-400";
          if (seg > 13) filledColor = "bg-purple-500";
          else if (seg > 7) filledColor = "bg-blue-500";
          return (
            <button
              key={seg}
              onClick={() => onChange(seg)}
              title={String(seg)}
              className={`flex-1 h-4 rounded-sm transition-colors duration-100 ${
                filled ? filledColor : "bg-gray-200 hover:bg-gray-300"
              }`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{labelMin}</span>
        <span>{labelMax}</span>
      </div>
    </div>
  );
}

// ── Section label style ─────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
      {children}
    </p>
  );
}

type Tab = "partie" | "assistance" | "apparence";

export default function GameSettings({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: GameSettingsProps) {
  const { t, i18n } = useTranslation();
  const { canInstall, triggerInstall } = useInstall();
  const { skin, setSkin } = useSkin();
  // feedbackOpen lives outside the isOpen guard so it survives Settings closing
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("partie");

  const hasGameSettings = settings != null && onSettingsChange != null;

  // Fallback settings read/written to localStorage when outside a game
  const [localSettings, setLocalSettings] = useState<LocalSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      return { ...FALLBACK_SETTINGS, ...parsed };
    } catch {
      return FALLBACK_SETTINGS;
    }
  });

  const effectiveSettings = hasGameSettings ? settings! : localSettings;
  const handleChange = hasGameSettings
    ? onSettingsChange!
    : (next: LocalSettings) => {
        setLocalSettings(next);
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      };

  const TABS: { id: Tab; label: string }[] = [
    { id: "partie", label: t("gameSettings.tab.partie") },
    { id: "assistance", label: t("gameSettings.tab.assistance") },
    { id: "apparence", label: t("gameSettings.tab.apparence") },
  ];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-2xl w-96 max-h-[90vh] flex flex-col transform transition-all">
            {/* ── Header ── */}
            <div className="flex justify-between items-center px-6 pt-5 pb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("gameSettings.title")}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1 -mr-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* ── Tab bar (always visible) ── */}
            <div className="flex px-6 border-b border-gray-100 gap-1">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 pb-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                    activeTab === id
                      ? "text-blue-600 border-blue-600"
                      : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Scrollable content ── */}
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6">
              {/* ════ PARTIE tab ════ */}
              {activeTab === "partie" && (
                <div className="space-y-5">
                  {/* Game type */}
                  <div>
                    <SectionLabel>{t("gameSettings.gameType")}</SectionLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className={`py-2.5 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                          !effectiveSettings.aiEnabled
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                        onClick={() =>
                          handleChange({
                            ...effectiveSettings,
                            aiEnabled: false,
                          })
                        }
                      >
                        {t("gameSettings.soloPlay")}
                      </button>
                      <button
                        className={`py-2.5 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                          effectiveSettings.aiEnabled
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                        onClick={() =>
                          handleChange({
                            ...effectiveSettings,
                            aiEnabled: true,
                          })
                        }
                      >
                        {t("gameSettings.vsAI")}
                      </button>
                    </div>
                  </div>

                  {/* Flip board — solo only */}
                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      !effectiveSettings.aiEnabled
                        ? "opacity-100 max-h-28"
                        : "opacity-0 max-h-0"
                    }`}
                  >
                    <CardToggle
                      label={t("gameSettings.flipBoard")}
                      desc={t("gameSettings.flipBoardDesc")}
                      checked={effectiveSettings.flipBoard}
                      onChange={(v) =>
                        handleChange({ ...effectiveSettings, flipBoard: v })
                      }
                    />
                  </div>

                  {/* AI Difficulty gauge — AI only */}
                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      effectiveSettings.aiEnabled
                        ? "opacity-100 max-h-40"
                        : "opacity-0 max-h-0"
                    }`}
                  >
                    <SectionLabel>
                      {t("gameSettings.aiDifficulty")}
                    </SectionLabel>
                    <DifficultyGauge
                      value={effectiveSettings.aiDifficulty}
                      onChange={(v) =>
                        handleChange({ ...effectiveSettings, aiDifficulty: v })
                      }
                      labelMin={t("gameSettings.beginner")}
                      labelMax={t("gameSettings.superhuman")}
                      levelLabel={t(
                        getDifficultyKey(effectiveSettings.aiDifficulty),
                      )}
                    />
                  </div>
                </div>
              )}

              {/* ════ ASSISTANCE tab ════ */}
              {activeTab === "assistance" && (
                <div className="space-y-2">
                  <CardToggle
                    label={t("learning.dangerIndicator")}
                    desc={t("learning.dangerIndicatorDesc")}
                    checked={effectiveSettings.showDangerIndicator}
                    onChange={(v) =>
                      handleChange({
                        ...effectiveSettings,
                        showDangerIndicator: v,
                      })
                    }
                  />
                  <CardToggle
                    label={t("learning.showHint")}
                    desc={t("learning.showHintDesc")}
                    checked={effectiveSettings.showHint}
                    onChange={(v) =>
                      handleChange({ ...effectiveSettings, showHint: v })
                    }
                  />
                  <CardToggle
                    label={t("learning.moveAnnotations")}
                    desc={t("learning.moveAnnotationsDesc")}
                    checked={effectiveSettings.showMoveAnnotations}
                    onChange={(v) =>
                      handleChange({
                        ...effectiveSettings,
                        showMoveAnnotations: v,
                      })
                    }
                  />
                </div>
              )}

              {/* ════ APPARENCE tab ════ */}
              {activeTab === "apparence" && (
                <div className="space-y-5">
                  {/* Skin picker */}
                  <div>
                    <SectionLabel>
                      {t("gameSettings.pieceAppearance")}
                    </SectionLabel>
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
                            {(["king", "queen", "knight"] as const).map(
                              (type) => (
                                <img
                                  key={type}
                                  src={getPieceImageSrc("white", type, s.id)}
                                  alt={type}
                                  className="w-8 h-8"
                                />
                              ),
                            )}
                          </div>
                          <span
                            className={`text-sm font-medium ${
                              skin === s.id ? "text-blue-700" : "text-gray-600"
                            }`}
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

                  {/* Language dropdown */}
                  <div>
                    <SectionLabel>{t("gameSettings.language")}</SectionLabel>
                    <div className="relative">
                      <select
                        value={i18n.resolvedLanguage}
                        onChange={(e) => i18n.changeLanguage(e.target.value)}
                        className="w-full appearance-none pl-3 pr-9 py-2.5 rounded-lg border-2 border-gray-200 bg-white text-sm text-gray-700 focus:border-blue-500 focus:outline-none cursor-pointer hover:border-gray-300 transition-colors"
                      >
                        {SUPPORTED_LANGUAGES.map((lng: SupportedLanguage) => (
                          <option key={lng} value={lng}>
                            {`${LANGUAGE_FLAGS[lng] ?? ""} ${t(`languages.${lng}`)}`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Support + Install (always visible, outside tabs) ── */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      setFeedbackOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                  >
                    <MessageSquare size={15} />
                    {t("feedback.button")}
                  </button>
                  <a
                    href={`https://donate.stripe.com/eVq3cueo0dkNfVlfovbEA00?locale=${i18n.resolvedLanguage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-amber-700 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 transition"
                  >
                    <Coffee size={15} />
                    {t("feedback.donate")}
                  </a>
                </div>
                {canInstall && (
                  <button
                    onClick={triggerInstall}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition"
                  >
                    <Download size={16} />
                    {t("install.cta")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rendered outside the isOpen guard so feedbackOpen state survives Settings closing */}
      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </>
  );
}
