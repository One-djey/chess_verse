import React, { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Extend Window to include the deferred install event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';

/** Returns true when the app is already running as an installed PWA */
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari on iOS
    !!(navigator as { standalone?: boolean }).standalone
  );
}

export default function InstallBanner() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Never show if already running standalone or user previously dismissed
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') dismiss();
    setPrompt(null);
  };

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  if (!visible) return null;

  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Mini chess-board icon */}
        <svg viewBox="0 0 20 20" className="w-7 h-7 shrink-0 rounded" aria-hidden="true">
          <rect width="20" height="20" fill="#1D4ED8"/>
          {[0,1,2,3].map(row => [0,1,2,3].map(col => (
            <rect
              key={`${row}-${col}`}
              x={1 + col * 4.5} y={1 + row * 4.5}
              width="4" height="4"
              fill={(row + col) % 2 === 0 ? '#F2F4F8' : '#3B82F6'}
            />
          )))}
        </svg>
        <p className="text-sm text-blue-900 truncate">{t('install.message')}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition"
        >
          <Download size={14} />
          {t('install.cta')}
        </button>
        <button
          onClick={dismiss}
          className="p-1.5 text-blue-400 hover:text-blue-700 hover:bg-blue-100 rounded-md transition"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
