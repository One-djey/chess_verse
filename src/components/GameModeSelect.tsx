import React from 'react';
import { Monitor, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GameMode } from '../types/chess';
import { gameModes } from './GameModes';
import NavBar, { Crumb } from './NavBar';

interface GameModeSelectProps {
  playType: 'local' | 'multiplayer';
  onSelect: (mode: GameMode) => void;
  /** Optional extra breadcrumb items appended after the play-type crumb */
  extraCrumbs?: Crumb[];
}

const PLAY_TYPE_CONFIG = {
  local: { Icon: Monitor, ring: 'hover:ring-blue-400' },
  multiplayer: { Icon: Globe, ring: 'hover:ring-indigo-400' },
} as const;

export default function GameModeSelect({ playType, onSelect, extraCrumbs }: GameModeSelectProps) {
  const { t } = useTranslation();
  const { ring } = PLAY_TYPE_CONFIG[playType];

  const playTypeLabel = playType === 'local'
    ? t('modeSelect.local')
    : t('modeSelect.multiplayer');

  const breadcrumbs: Crumb[] = [
    { label: playTypeLabel },
    ...(extraCrumbs ?? []),
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar breadcrumbs={breadcrumbs} />

      <div className="max-w-5xl mx-auto px-6 pt-10 pb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-10">{t('gameModeSelect.title')}</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {gameModes.map((mode) => (
            <div
              key={mode.id}
              onClick={() => onSelect(mode)}
              className={`group bg-white rounded-xl overflow-hidden cursor-pointer
                shadow-md hover:shadow-xl
                ring-2 ring-transparent ${ring}
                transition-all duration-200 hover:-translate-y-1`}
            >
              <div className="relative overflow-hidden bg-gray-300 h-44">
                <img
                  src={mode.image}
                  alt={t(`modes.${mode.id}.title`)}
                  className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                  }}
                />
              </div>
              <div className="p-5">
                <h2 className="text-xl font-bold text-gray-900 mb-1">{t(`modes.${mode.id}.title`)}</h2>
                <p className="text-sm text-gray-500 leading-relaxed">{t(`modes.${mode.id}.description`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
