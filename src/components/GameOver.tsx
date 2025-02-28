import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Clock, Hash, Brain } from 'lucide-react';
import { getDifficultyDescription } from '../utils/chess';

interface GameOverProps {
  winner: 'white' | 'black';
  duration: number;
  moveCount: number;
  onReplay: () => void;
  aiEnabled?: boolean;
  aiDifficulty?: number;
}

export default function GameOver({ winner, duration, moveCount, onReplay, aiEnabled, aiDifficulty }: GameOverProps) {
  const navigate = useNavigate();
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  const stats = [
    {
      icon: <Clock className="w-5 h-5" />,
      label: "Duration",
      value: `${minutes}m ${seconds}s`
    },
    {
      icon: <Hash className="w-5 h-5" />,
      label: "Moves played",
      value: moveCount.toString()
    },
    ...(aiEnabled && aiDifficulty ? [{
      icon: <Brain className="w-5 h-5" />,
      label: "AI Level",
      value: getDifficultyDescription(aiDifficulty)
    }] : [])
  ];

  const isDefeat = aiEnabled && winner === 'black';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl transform transition-all">
        <div className="text-center">
          <div className="mb-12 relative">
            <Trophy className={`w-16 h-16 mx-auto ${isDefeat ? 'text-gray-400' : 'text-yellow-400'}`} />
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-4 py-1 rounded-full border border-gray-200">
              <span className="text-sm font-medium text-gray-600">
                {winner === 'white' ? 'White' : 'Black'}
              </span>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-8">
            {isDefeat ? 'Defeat!' : 'Victory!'}
          </h2>

          <div className="grid grid-cols-1 gap-4 mb-8">
            {stats.map((stat, index) => (
              <div 
                key={stat.label}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-3 text-gray-600">
                  {stat.icon}
                  <span className="font-medium">{stat.label}</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">{stat.value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={onReplay}
              className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Play Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}