import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Flag, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GameSettings from './GameSettings';

export interface Crumb {
  label: string;
  /** If provided, the crumb is clickable and navigates to this path */
  path?: string;
}

interface NavBarProps {
  breadcrumbs?: Crumb[];
  /** Shows a Surrender button — pass the handler when in an active game */
  onSurrender?: () => void;
  /** Full game settings (AI, flip board). When absent, settings modal shows language only */
  gameSettings?: { aiEnabled: boolean; aiDifficulty: number; flipBoard: boolean } | null;
  onGameSettingsChange?: (s: { aiEnabled: boolean; aiDifficulty: number; flipBoard: boolean }) => void;
}

export default function NavBar({ breadcrumbs = [], onSurrender, gameSettings, onGameSettingsChange }: NavBarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <>
      <nav className="bg-white border-b border-gray-200 shadow-sm px-4 py-2.5 flex items-center justify-between gap-4">
        {/* ── Left: ChessVerse brand + breadcrumb ── */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={() => navigate('/')}
            className="font-bold text-gray-900 hover:text-blue-600 transition-colors shrink-0 text-base leading-none"
          >
            ChessVerse
          </button>

          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              <ChevronRight size={13} className="text-gray-300 shrink-0" />
              {crumb.path ? (
                <button
                  onClick={() => navigate(crumb.path!)}
                  className="text-sm text-gray-400 hover:text-gray-800 transition-colors truncate"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-sm text-gray-700 font-medium truncate">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Right: actions ── */}
        <div className="flex items-center gap-2 shrink-0">
          {onSurrender && (
            <button
              onClick={onSurrender}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 active:bg-red-700 transition text-sm font-medium"
            >
              <Flag size={14} />
              {t('nav.surrender')}
            </button>
          )}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            aria-label={t('nav.settings')}
          >
            <Settings size={19} />
          </button>
        </div>
      </nav>

      <GameSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={gameSettings ?? null}
        onSettingsChange={onGameSettingsChange}
      />
    </>
  );
}
