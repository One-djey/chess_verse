import type { GameMode } from "../types/chess";

export const gameModes: GameMode[] = [
  {
    id: "classic",
    title: "Classic",
    description: "The traditional chess game with all its classic rules.",
    image: "/ressources/modes/classic.webp",
    rules: { borderless: false, randomPieces: false },
  },
  {
    id: "borderless",
    title: "Borderless",
    description:
      "A borderless mode where pieces can cross the edges of the board.",
    image: "/ressources/modes/borderless.webp",
    rules: { borderless: true, randomPieces: false },
    forcedSkins: { pieces: "robot", board: "spaceship" },
  },
  {
    id: "all-random",
    title: "All Random",
    description:
      "Pieces are randomly chosen and placed at the start of the game.",
    image: "/ressources/modes/all-random.webp",
    rules: { borderless: false, randomPieces: true },
    forcedSkins: { pieces: "legends", board: "nexus" },
  },
  {
    id: "assimilation",
    title: "Assimilation",
    description:
      "When a piece captures another, it permanently acquires its movement abilities.",
    image: "/ressources/modes/assimilation.webp",
    rules: { borderless: false, randomPieces: false, assimilation: true },
  },
  {
    id: "coliseum",
    title: "Coliseum",
    description: "Battle on a unique procedurally-generated arena.",
    image: "/ressources/modes/coliseum.webp",
    rules: { coliseum: true },
    forcedSkins: { pieces: "fantasy", board: "royal-arena" },
  },
  {
    id: "zombie-horde",
    title: "Zombie Horde",
    description:
      "Survive endless waves of zombie pieces. Kill as many as you can before checkmate!",
    image: "/ressources/modes/zombie-horde.webp",
    rules: { zombieHorde: true },
    forcedSkins: { pieces: "zombie", board: "apocalypse" },
  },
];
