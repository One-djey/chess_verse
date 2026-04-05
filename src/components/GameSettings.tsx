import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDifficultyDescription } from '../utils/chess';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';

interface GameSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    aiEnabled: boolean;
    aiDifficulty: number;
    flipBoard: boolean;
  };
  onSettingsChange: (settings: { aiEnabled: boolean; aiDifficulty: number; flipBoard: boolean }) => void;
}


export default function GameSettings({ isOpen, onClose, settings, onSettingsChange }: GameSettingsProps) {
  const { t, i18n } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl w-96 transform transition-all">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{t('gameSettings.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Game Mode Selection */}
          <div className="space-y-4">
            <label className="text-base font-medium text-gray-900">{t('gameSettings.gameType')}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                className={`p-3 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                  !settings.aiEnabled
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
                onClick={() => onSettingsChange({ ...settings, aiEnabled: false })}
              >
                {t('gameSettings.soloPlay')}
              </button>
              <button
                className={`p-3 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                  settings.aiEnabled
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
                onClick={() => onSettingsChange({ ...settings, aiEnabled: true })}
              >
                {t('gameSettings.vsAI')}
              </button>
            </div>
          </div>

          {/* Flip board on turn — solo only */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              !settings.aiEnabled ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-medium text-gray-900">{t('gameSettings.flipBoard')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('gameSettings.flipBoardDesc')}</p>
              </div>
              <button
                role="switch"
                aria-checked={settings.flipBoard}
                onClick={() => onSettingsChange({ ...settings, flipBoard: !settings.flipBoard })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  settings.flipBoard ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    settings.flipBoard ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* AI Difficulty Slider */}
          <div
            className={`space-y-3 transition-all duration-300 ease-in-out overflow-hidden ${
              settings.aiEnabled ? 'opacity-100 max-h-32' : 'opacity-0 max-h-0'
            }`}
          >
            <label className="text-base font-medium text-gray-900">{t('gameSettings.aiDifficulty')}</label>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{getDifficultyDescription(settings.aiDifficulty, true)}</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={settings.aiDifficulty}
                onChange={(e) => onSettingsChange({
                  ...settings,
                  aiDifficulty: parseInt(e.target.value)
                })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{t('gameSettings.beginner')}</span>
                <span>{t('gameSettings.superhuman')}</span>
              </div>
            </div>
          </div>

          {/* Language selector */}
          <div className="space-y-3">
            <label className="text-base font-medium text-gray-900">{t('gameSettings.language')}</label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((lng: SupportedLanguage) => (
                <button
                  key={lng}
                  onClick={() => i18n.changeLanguage(lng)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    i18n.resolvedLanguage === lng
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t(`languages.${lng}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
