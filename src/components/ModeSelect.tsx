import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Globe, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import NavBar from './NavBar';
import Footer from './Footer';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function ModeSelect() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

  const OPTIONS = [
    {
      id: 'local',
      label: t('modeSelect.local'),
      description: t('modeSelect.localDesc'),
      Icon: Monitor,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      ring: 'hover:ring-blue-400',
      path: '/local',
    },
    {
      id: 'multiplayer',
      label: t('modeSelect.multiplayer'),
      description: t('modeSelect.multiplayerDesc'),
      Icon: Globe,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      ring: 'hover:ring-indigo-400',
      path: '/p2p',
    },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <NavBar />

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <p className="text-gray-500 text-center mb-12 text-lg">{t('modeSelect.subtitle')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
          {OPTIONS.map(({ id, label, description, Icon, iconBg, iconColor, ring, path }) => {
            const disabled = id === 'multiplayer' && !isOnline;
            return (
              <button
                key={id}
                onClick={() => !disabled && navigate(path)}
                disabled={disabled}
                title={disabled ? t('modeSelect.offline') : undefined}
                className={`bg-white rounded-xl shadow-md p-8 flex flex-col items-center gap-4
                  ring-2 ring-transparent transition-all duration-200
                  ${disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : `hover:shadow-xl ${ring} hover:-translate-y-1 cursor-pointer`}`}
              >
                <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center relative`}>
                  <Icon size={32} className={iconColor} />
                  {disabled && (
                    <span className="absolute -bottom-1 -right-1 bg-gray-400 rounded-full p-0.5">
                      <WifiOff size={12} className="text-white" />
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{label}</h2>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {disabled ? t('modeSelect.offline') : description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Footer />
    </div>
  );
}
