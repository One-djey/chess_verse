import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GameMode } from '../types/chess';

export const gameModes: GameMode[] = [
  {
    id: 'classic',
    title: 'Classic',
    description: 'The traditional chess game with all its classic rules.',
    image: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&q=80&w=800',
    rules: {
      borderless: false,
      randomPieces: false
    }
  },
  {
    id: 'borderless',
    title: 'Borderless',
    description: 'A borderless mode where pieces can cross the edges of the board, creating unique strategic possibilities.',
    image: 'https://images.unsplash.com/photo-1586165368502-1bad197a6461?auto=format&fit=crop&q=80&w=800',
    rules: {
      borderless: true,
      randomPieces: false
    }
  },
  {
    id: 'all-random',
    title: 'All Random',
    description: 'Pieces are randomly chosen and placed at the start of the game, creating a unique experience every time.',
    image: 'https://images.unsplash.com/photo-1580541832626-2a7131ee809f?auto=format&fit=crop&q=80&w=800',
    rules: {
      borderless: false,
      randomPieces: true
    }
  }
];

export default function GameModes() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-center mb-12">Choose your game mode</h1>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {gameModes.map((mode) => (
          <div
            key={mode.id}
            className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer transform transition hover:scale-105"
            onClick={() => navigate(`/game/${mode.id}`)}
          >
            <img
              src={mode.image}
              alt={mode.title}
              className="w-full h-48 object-cover"
            />
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{mode.title}</h2>
              <p className="text-gray-600">{mode.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}