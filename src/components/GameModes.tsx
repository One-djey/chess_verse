import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GameMode } from '../types/chess';
import GameModeSelect from './GameModeSelect';

export const gameModes: GameMode[] = [
  {
    id: 'classic',
    title: 'Classic',
    description: 'The traditional chess game with all its classic rules.',
    image: '/ressources/modes/classic.jpg',
    rules: { borderless: false, randomPieces: false },
  },
  {
    id: 'borderless',
    title: 'Borderless',
    description: 'A borderless mode where pieces can cross the edges of the board.',
    image: '/ressources/modes/borderless.jpg',
    rules: { borderless: true, randomPieces: false },
  },
  {
    id: 'all-random',
    title: 'All Random',
    description: 'Pieces are randomly chosen and placed at the start of the game.',
    image: '/ressources/modes/all-random.jpg',
    rules: { borderless: false, randomPieces: true },
  },
  {
    id: 'assimilation',
    title: 'Assimilation',
    description: 'When a piece captures another, it permanently acquires its movement abilities.',
    image: '/ressources/modes/assimilation.jpg',
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
