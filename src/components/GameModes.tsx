import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GameMode } from '../types/chess';
import GameModeSelect from './GameModeSelect';

export const gameModes: GameMode[] = [
  {
    id: 'classic',
    title: 'Classic',
    description: 'The traditional chess game with all its classic rules.',
    image: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&q=80&w=800',
    rules: { borderless: false, randomPieces: false },
  },
  {
    id: 'borderless',
    title: 'Borderless',
    description: 'A borderless mode where pieces can cross the edges of the board.',
    image: 'https://images.unsplash.com/photo-1586165368502-1bad197a6461?auto=format&fit=crop&q=80&w=800',
    rules: { borderless: true, randomPieces: false },
  },
  {
    id: 'all-random',
    title: 'All Random',
    description: 'Pieces are randomly chosen and placed at the start of the game.',
    image: 'https://images.unsplash.com/photo-1580541832626-2a7131ee809f?auto=format&fit=crop&q=80&w=800',
    rules: { borderless: false, randomPieces: true },
  },
  {
    id: 'assimilation',
    title: 'Assimilation',
    description: 'When a piece captures another, it permanently acquires its movement abilities.',
    image: 'https://images.unsplash.com/photo-1560174038-da43ac74f01b?auto=format&fit=crop&q=80&w=800',
    rules: { borderless: false, randomPieces: false, assimilation: true },
  },
];

export default function GameModes() {
  const navigate = useNavigate();
  return (
    <GameModeSelect
      playType="local"
      onSelect={(mode) => navigate(`/game/${mode.id}`)}
    />
  );
}
