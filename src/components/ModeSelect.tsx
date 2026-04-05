import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Globe } from 'lucide-react';

export default function ModeSelect() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-center mb-4">ChessVerse</h1>
      <p className="text-gray-500 text-center mb-12">How do you want to play?</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl w-full">
        {/* Local */}
        <button
          onClick={() => navigate('/local')}
          className="bg-white rounded-xl shadow-lg p-10 flex flex-col items-center gap-4 cursor-pointer transform transition hover:scale-105 hover:shadow-xl text-left"
        >
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
            <Monitor size={40} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-1 text-center">Local</h2>
            <p className="text-gray-500 text-sm text-center">
              Play vs AI or pass-and-play with a friend on the same device.
            </p>
          </div>
        </button>

        {/* Multiplayer */}
        <button
          onClick={() => navigate('/p2p')}
          className="bg-white rounded-xl shadow-lg p-10 flex flex-col items-center gap-4 cursor-pointer transform transition hover:scale-105 hover:shadow-xl text-left"
        >
          <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
            <Globe size={40} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-1 text-center">Multiplayer</h2>
            <p className="text-gray-500 text-sm text-center">
              Challenge a friend remotely via a shared link — no server needed.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
