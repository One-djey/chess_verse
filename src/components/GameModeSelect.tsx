import React from 'react';
import { ArrowLeft, Monitor, Globe } from 'lucide-react';
import { GameMode } from '../types/chess';
import { gameModes } from './GameModes';

interface GameModeSelectProps {
  playType: 'local' | 'multiplayer';
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}

const PLAY_TYPE_CONFIG = {
  local: {
    label: 'Local',
    Icon: Monitor,
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    ring: 'hover:ring-blue-400',
  },
  multiplayer: {
    label: 'Multiplayer',
    Icon: Globe,
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
    ring: 'hover:ring-indigo-400',
  },
} as const;

export default function GameModeSelect({ playType, onSelect, onBack }: GameModeSelectProps) {
  const { label, Icon, badgeBg, badgeText, badgeBorder, ring } = PLAY_TYPE_CONFIG[playType];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-8 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-10">
          {/* Play-type badge */}
          <span className={`inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full border text-xs font-semibold ${badgeBg} ${badgeText} ${badgeBorder}`}>
            <Icon size={12} />
            {label}
          </span>

          <h1 className="text-3xl font-bold text-gray-900">Choose your game mode</h1>
        </div>
      </div>

      {/* Mode cards */}
      <div className="max-w-5xl mx-auto px-6 pb-12">
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
              <div className="overflow-hidden">
                <img
                  src={mode.image}
                  alt={mode.title}
                  className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <h2 className="text-xl font-bold text-gray-900 mb-1">{mode.title}</h2>
                <p className="text-sm text-gray-500 leading-relaxed">{mode.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
