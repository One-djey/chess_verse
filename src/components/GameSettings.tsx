import { X } from 'lucide-react';
import { getDifficultyDescription } from '../utils/chess';

interface GameSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    aiEnabled: boolean;
    aiDifficulty: number;
  };
  onSettingsChange: (settings: { aiEnabled: boolean; aiDifficulty: number }) => void;
}


export default function GameSettings({ isOpen, onClose, settings, onSettingsChange }: GameSettingsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl w-96 transform transition-all">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Game Settings</h2>
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
            <label className="text-base font-medium text-gray-900">Game Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                className={`p-3 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                  !settings.aiEnabled
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
                onClick={() => onSettingsChange({ ...settings, aiEnabled: false })}
              >
                Solo Play
              </button>
              <button
                className={`p-3 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
                  settings.aiEnabled
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
                onClick={() => onSettingsChange({ ...settings, aiEnabled: true })}
              >
                vs AI
              </button>
            </div>
          </div>

          {/* AI Difficulty Slider - with animation */}
          <div 
            className={`space-y-3 transition-all duration-300 ease-in-out overflow-hidden ${
              settings.aiEnabled ? 'opacity-100 max-h-32' : 'opacity-0 max-h-0'
            }`}
          >
            <label className="text-base font-medium text-gray-900">AI Difficulty</label>
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
                <span>Beginner</span>
                <span>Superhuman</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 