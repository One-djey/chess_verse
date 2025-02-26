import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';

interface GameOverProps {
  winner: 'white' | 'black';
  duration: number;
  moveCount: number;
  onReplay: () => void;
}

export default function GameOver({ winner, duration, moveCount, onReplay }: GameOverProps) {
  const navigate = useNavigate();
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h2 className="text-3xl font-bold mb-4">
            {winner === 'white' ? 'White' : 'Black'} wins!
          </h2>
          <p className="text-gray-600 mb-2">
            Match duration: {minutes}m {seconds}s
          </p>
          <p className="text-gray-600 mb-6">
            Number of moves: {moveCount}
          </p>
          <div className="space-x-4">
            <button
              onClick={onReplay}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
            >
              Play again
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}