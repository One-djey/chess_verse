import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Globe } from 'lucide-react';

const OPTIONS = [
  {
    id: 'local',
    label: 'Local',
    description: 'Play vs AI or pass-and-play with a friend on the same device.',
    Icon: Monitor,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    ring: 'hover:ring-blue-400',
    path: '/local',
  },
  {
    id: 'multiplayer',
    label: 'Multiplayer',
    description: 'Challenge a friend remotely — no server needed.',
    Icon: Globe,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    ring: 'hover:ring-indigo-400',
    path: '/p2p',
  },
] as const;

export default function ModeSelect() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-center mb-2 text-gray-900">ChessVerse</h1>
      <p className="text-gray-500 text-center mb-12">How do you want to play?</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
        {OPTIONS.map(({ id, label, description, Icon, iconBg, iconColor, ring, path }) => (
          <button
            key={id}
            onClick={() => navigate(path)}
            className={`bg-white rounded-xl shadow-md hover:shadow-xl p-8 flex flex-col items-center gap-4
              ring-2 ring-transparent ${ring}
              transition-all duration-200 hover:-translate-y-1 cursor-pointer`}
          >
            <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center`}>
              <Icon size={32} className={iconColor} />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{label}</h2>
              <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
