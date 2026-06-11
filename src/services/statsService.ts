import type { PieceType, PieceColor } from "../types/chess";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlayType = "local" | "ai" | "p2p";

export interface GameRecord {
  mode: string;
  playType: PlayType;
  winner: PieceColor | null;
  surrenderedBy?: PieceColor;
  drawReason?: string;
  duration: number; // ms
  moveCount: number;
  aiDifficulty?: number;
  pieceMoves: Partial<Record<PieceType, number>>;
  piecesLost: Partial<Record<PieceType, number>>;
  playerColor: PieceColor;
  hour: number; // 0-23
  // Badge extras
  isQuickWin?: boolean; // won in < 10 total moves
  wasPromoted?: boolean; // player promoted a pawn in this game
  wasScholarsMate?: boolean; // game ended with Scholar's Mate by player
  hintsFollowedInGame?: number; // hint suggestions followed during the game
  language?: string; // UI language when the game was played
  assistanceUsedDuringGame?: boolean; // any assistance option was active at any point
}

export interface ChessverseStats {
  // Game counts
  totalGames: number;
  localGames: number;
  p2pGames: number;
  aiGames: number;

  // Results
  wins: number;
  losses: number;
  draws: number;
  surrenders: number;

  // ELO — max AI level beaten (0 = none)
  maxAILevelBeaten: number;

  // Duration
  totalDurationMs: number;

  // Piece stats (both colors aggregated, hors pions)
  pieceMoveCount: Partial<Record<PieceType, number>>;
  pieceCapturedCount: Partial<Record<PieceType, number>>;

  // Mode distribution
  modeGameCount: Record<string, number>;

  // Activity heatmap — key: 'YYYY-MM-DD', value: game count
  dailyActivity: Record<string, number>;

  // Streaks
  currentWinStreak: number;
  maxWinStreak: number;
  lastGameResult: "win" | "loss" | "draw" | null;

  // Badge counters
  nightGames: number; // parties after 22h
  allRandomGames: number;
  modesPlayed: string[]; // unique mode ids played
  morningGames: number; // parties before 8h
  quickWins: number; // wins in < 10 total moves
  promotions: number; // pawn promoted to queen (by player)
  scholarsMates: number; // Scholar's Mate achieved
  hintsFollowed: number; // times player followed hint suggestion
  coffeeDonated: boolean; // clicked the donate link
  languagesUsed: string[]; // unique UI languages played in
  feedbackSent: number; // times the feedback mail link was opened
  currentDayStreak: number; // current consecutive days with at least one game
  maxDayStreak: number; // all-time best consecutive-day streak
  lastPlayedDate: string | null; // 'YYYY-MM-DD' of the last day a game was played

  // Coliseum mode counters
  coliseumGames: number; // total Coliseum games played
  coliseumWins: number; // total Coliseum wins

  // Magnus Carlsen badge
  beatMaxAINoAssist: number; // times the player beat AI level 20 without any assistance
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "chessverse_stats";

const DEFAULT_STATS: ChessverseStats = {
  totalGames: 0,
  localGames: 0,
  p2pGames: 0,
  aiGames: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  surrenders: 0,
  maxAILevelBeaten: 0,
  totalDurationMs: 0,
  pieceMoveCount: {},
  pieceCapturedCount: {},
  modeGameCount: {},
  dailyActivity: {},
  currentWinStreak: 0,
  maxWinStreak: 0,
  lastGameResult: null,
  nightGames: 0,
  allRandomGames: 0,
  modesPlayed: [],
  morningGames: 0,
  quickWins: 0,
  promotions: 0,
  scholarsMates: 0,
  hintsFollowed: 0,
  coffeeDonated: false,
  languagesUsed: [],
  feedbackSent: 0,
  currentDayStreak: 0,
  maxDayStreak: 0,
  lastPlayedDate: null,
  coliseumGames: 0,
  coliseumWins: 0,
  beatMaxAINoAssist: 0,
};

// ── ELO rank system ───────────────────────────────────────────────────────────

export interface ELORank {
  label: string;
  i18nKey: string;
  color: string; // Tailwind text color class
  bgColor: string; // Tailwind bg color class
  borderColor: string; // Tailwind border color class
  minLevel: number;
  maxLevel: number;
}

export const ELO_RANKS: ELORank[] = [
  {
    label: "Débutant",
    i18nKey: "profile.ranks.beginner",
    color: "text-gray-400",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
    minLevel: 0,
    maxLevel: 0,
  },
  {
    label: "Novice",
    i18nKey: "profile.ranks.novice",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
    minLevel: 1,
    maxLevel: 3,
  },
  {
    label: "Apprenti",
    i18nKey: "profile.ranks.apprentice",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
    minLevel: 4,
    maxLevel: 6,
  },
  {
    label: "Chevalier",
    i18nKey: "profile.ranks.knight",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-300",
    minLevel: 7,
    maxLevel: 10,
  },
  {
    label: "Stratège",
    i18nKey: "profile.ranks.strategist",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-300",
    minLevel: 11,
    maxLevel: 14,
  },
  {
    label: "Maître",
    i18nKey: "profile.ranks.master",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    minLevel: 15,
    maxLevel: 17,
  },
  {
    label: "Grand Maître",
    i18nKey: "profile.ranks.grandmaster",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-300",
    minLevel: 18,
    maxLevel: 19,
  },
  {
    label: "Légende",
    i18nKey: "profile.ranks.legend",
    color: "text-purple-600",
    bgColor: "bg-gradient-to-r from-purple-50 to-pink-50",
    borderColor: "border-purple-400",
    minLevel: 20,
    maxLevel: 20,
  },
];

export function getELORank(level: number): ELORank {
  return ELO_RANKS.findLast((r) => level >= r.minLevel) ?? ELO_RANKS[0];
}

// ── Badge definitions ─────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  i18nKey: string;
  icon: string;
  isUnlocked: (stats: ChessverseStats) => boolean;
  progress?: (stats: ChessverseStats) => { current: number; target: number };
}

export const BADGES: Badge[] = [
  // ── Trivial — 1 action simple ──────────────────────────────────────────────
  {
    id: "first_step",
    i18nKey: "profile.badges.firstStep",
    icon: "🎮",
    isUnlocked: (s) => s.totalGames >= 1,
    progress: (s) => ({ current: Math.min(s.totalGames, 1), target: 1 }),
  },
  {
    id: "contributor",
    i18nKey: "profile.badges.contributor",
    icon: "✉️",
    isUnlocked: (s) => s.feedbackSent >= 1,
    progress: (s) => ({ current: Math.min(s.feedbackSent, 1), target: 1 }),
  },
  {
    id: "what_else",
    i18nKey: "profile.badges.whatElse",
    icon: "☕",
    isUnlocked: (s) => s.coffeeDonated,
    progress: (s) => ({ current: s.coffeeDonated ? 1 : 0, target: 1 }),
  },
  {
    id: "p2p_pioneer",
    i18nKey: "profile.badges.p2pPioneer",
    icon: "🌐",
    isUnlocked: (s) => s.p2pGames >= 1,
    progress: (s) => ({ current: Math.min(s.p2pGames, 1), target: 1 }),
  },
  {
    id: "early_bird",
    i18nKey: "profile.badges.earlyBird",
    icon: "☀️",
    isUnlocked: (s) => s.morningGames >= 1,
    progress: (s) => ({ current: Math.min(s.morningGames, 1), target: 1 }),
  },
  {
    id: "diplomat",
    i18nKey: "profile.badges.diplomat",
    icon: "🤝",
    isUnlocked: (s) => s.draws >= 1,
    progress: (s) => ({ current: Math.min(s.draws, 1), target: 1 }),
  },
  // ── Facile — action spécifique ou petite technique ─────────────────────────
  {
    id: "bilingue",
    i18nKey: "profile.badges.bilingue",
    icon: "🗣️",
    isUnlocked: (s) => s.languagesUsed.length >= 2,
    progress: (s) => ({
      current: Math.min(s.languagesUsed.length, 2),
      target: 2,
    }),
  },
  {
    id: "coronation",
    i18nKey: "profile.badges.coronation",
    icon: "👸",
    isUnlocked: (s) => s.promotions >= 1,
    progress: (s) => ({ current: Math.min(s.promotions, 1), target: 1 }),
  },
  {
    id: "quick_win",
    i18nKey: "profile.badges.quickWin",
    icon: "💨",
    isUnlocked: (s) => s.quickWins >= 1,
    progress: (s) => ({ current: Math.min(s.quickWins, 1), target: 1 }),
  },
  {
    id: "scholars_mate",
    i18nKey: "profile.badges.scholarsMate",
    icon: "🎓",
    isUnlocked: (s) => s.scholarsMates >= 1,
    progress: (s) => ({ current: Math.min(s.scholarsMates, 1), target: 1 }),
  },
  // ── Moyen — quelques parties ou cumuls ~10 ─────────────────────────────────
  {
    id: "on_fire",
    i18nKey: "profile.badges.onFire",
    icon: "🔥",
    isUnlocked: (s) => s.maxWinStreak >= 3,
    progress: (s) => ({ current: Math.min(s.maxWinStreak, 3), target: 3 }),
  },
  {
    id: "explorer",
    i18nKey: "profile.badges.explorer",
    icon: "🌈",
    isUnlocked: (s) => s.modesPlayed.length >= 5,
    progress: (s) => ({
      current: Math.min(s.modesPlayed.length, 5),
      target: 5,
    }),
  },
  {
    id: "coward",
    i18nKey: "profile.badges.coward",
    icon: "🏳️",
    isUnlocked: (s) => s.surrenders >= 10,
    progress: (s) => ({ current: Math.min(s.surrenders, 10), target: 10 }),
  },
  {
    id: "night_owl",
    i18nKey: "profile.badges.nightOwl",
    icon: "🌙",
    isUnlocked: (s) => s.nightGames >= 10,
    progress: (s) => ({ current: Math.min(s.nightGames, 10), target: 10 }),
  },
  {
    id: "chaos_fan",
    i18nKey: "profile.badges.chaosFan",
    icon: "🎲",
    isUnlocked: (s) => s.allRandomGames >= 10,
    progress: (s) => ({ current: Math.min(s.allRandomGames, 10), target: 10 }),
  },
  {
    id: "assimilation_fan",
    i18nKey: "profile.badges.assimilationFan",
    icon: "🧬",
    isUnlocked: (s) => (s.modeGameCount["assimilation"] ?? 0) >= 10,
    progress: (s) => ({
      current: Math.min(s.modeGameCount["assimilation"] ?? 0, 10),
      target: 10,
    }),
  },
  {
    id: "borderless_traveler",
    i18nKey: "profile.badges.borderlessTraveler",
    icon: "🌍",
    isUnlocked: (s) => (s.modeGameCount["borderless"] ?? 0) >= 10,
    progress: (s) => ({
      current: Math.min(s.modeGameCount["borderless"] ?? 0, 10),
      target: 10,
    }),
  },
  {
    id: "gladiator",
    i18nKey: "profile.badges.gladiator",
    icon: "⚔️",
    isUnlocked: (s) => s.coliseumGames >= 10,
    progress: (s) => ({ current: Math.min(s.coliseumGames, 10), target: 10 }),
  },
  // ── Difficile — engagement long terme ─────────────────────────────────────
  {
    id: "assiduous",
    i18nKey: "profile.badges.assiduous",
    icon: "📅",
    isUnlocked: (s) => s.maxDayStreak >= 7,
    progress: (s) => ({ current: Math.min(s.maxDayStreak, 7), target: 7 }),
  },
  {
    id: "serial_winner",
    i18nKey: "profile.badges.serialWinner",
    icon: "🏆",
    isUnlocked: (s) => s.wins >= 20,
    progress: (s) => ({ current: Math.min(s.wins, 20), target: 20 }),
  },
  {
    id: "veteran",
    i18nKey: "profile.badges.veteran",
    icon: "🏅",
    isUnlocked: (s) => s.totalGames >= 100,
    progress: (s) => ({ current: Math.min(s.totalGames, 100), target: 100 }),
  },
  {
    id: "unstoppable",
    i18nKey: "profile.badges.unstoppable",
    icon: "⚡",
    isUnlocked: (s) => s.maxWinStreak >= 10,
    progress: (s) => ({ current: Math.min(s.maxWinStreak, 10), target: 10 }),
  },
  // ── Expert — hauts seuils ou compétence avancée ────────────────────────────
  {
    id: "assisted",
    i18nKey: "profile.badges.assisted",
    icon: "🤖",
    isUnlocked: (s) => s.hintsFollowed >= 100,
    progress: (s) => ({
      current: Math.min(s.hintsFollowed, 100),
      target: 100,
    }),
  },
  {
    id: "ai_hunter",
    i18nKey: "profile.badges.aiHunter",
    icon: "👑",
    isUnlocked: (s) => s.maxAILevelBeaten >= 15,
    progress: (s) => ({
      current: Math.min(s.maxAILevelBeaten, 15),
      target: 15,
    }),
  },
  {
    id: "magnus_carlsen",
    i18nKey: "profile.badges.magnusCarlsen",
    icon: "⭐",
    isUnlocked: (s) => s.beatMaxAINoAssist >= 1,
    progress: (s) => ({
      current: Math.min(s.beatMaxAINoAssist, 1),
      target: 1,
    }),
  },
  {
    id: "marathon",
    i18nKey: "profile.badges.marathon",
    icon: "⏱️",
    isUnlocked: (s) => s.totalDurationMs >= 42 * 3_600_000,
    progress: (s) => ({
      current: Math.min(Math.floor(s.totalDurationMs / 3_600_000), 42),
      target: 42,
    }),
  },
];

// ── Service ───────────────────────────────────────────────────────────────────

export function getStats(): ChessverseStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATS);
    const parsed = JSON.parse(raw) as Partial<ChessverseStats>;
    return { ...structuredClone(DEFAULT_STATS), ...parsed };
  } catch {
    return structuredClone(DEFAULT_STATS);
  }
}

export function saveStats(stats: ChessverseStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    console.warn(
      "[statsService] localStorage quota exceeded — stats not saved.",
    );
  }
}

export function resetStats(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Merge a piece count record into an existing one */
function mergePieceCounts(
  base: Partial<Record<PieceType, number>>,
  delta: Partial<Record<PieceType, number>>,
): Partial<Record<PieceType, number>> {
  const result = { ...base };
  for (const [key, val] of Object.entries(delta) as [PieceType, number][]) {
    result[key] = (result[key] ?? 0) + val;
  }
  return result;
}

/** Today's date as 'YYYY-MM-DD' */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Yesterday's date as 'YYYY-MM-DD' */
function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function recordGame(game: GameRecord): void {
  const stats = getStats();

  // ── Counters ──
  stats.totalGames += 1;
  if (game.playType === "local") stats.localGames += 1;
  else if (game.playType === "p2p") stats.p2pGames += 1;
  else stats.aiGames += 1;

  // ── Results ──
  const isWin = game.winner !== null && game.winner === game.playerColor;
  const isDraw = game.winner === null;
  const isLoss = game.winner !== null && game.winner !== game.playerColor;

  if (isWin) stats.wins += 1;
  else if (isDraw) stats.draws += 1;
  else stats.losses += 1;

  if (game.surrenderedBy && isLoss) stats.surrenders += 1;

  // ── ELO ──
  if (isWin && game.playType === "ai" && game.aiDifficulty) {
    stats.maxAILevelBeaten = Math.max(
      stats.maxAILevelBeaten,
      game.aiDifficulty,
    );
  }

  // ── Duration ──
  stats.totalDurationMs += game.duration;

  // ── Piece stats ──
  stats.pieceMoveCount = mergePieceCounts(
    stats.pieceMoveCount,
    game.pieceMoves,
  );
  stats.pieceCapturedCount = mergePieceCounts(
    stats.pieceCapturedCount,
    game.piecesLost,
  );

  // ── Mode distribution ──
  stats.modeGameCount[game.mode] = (stats.modeGameCount[game.mode] ?? 0) + 1;

  // ── Heatmap ──
  const today = todayKey();
  stats.dailyActivity[today] = (stats.dailyActivity[today] ?? 0) + 1;

  // ── Streaks ──
  const result: "win" | "loss" | "draw" = isWin
    ? "win"
    : isDraw
      ? "draw"
      : "loss";
  if (isWin) {
    stats.currentWinStreak += 1;
    stats.maxWinStreak = Math.max(stats.maxWinStreak, stats.currentWinStreak);
  } else if (isLoss) {
    stats.currentWinStreak = 0;
  }
  // Draw doesn't break streak
  stats.lastGameResult = result;

  // ── Badge counters ──
  if (game.hour >= 22) stats.nightGames += 1;
  if (game.hour < 8) stats.morningGames += 1;
  if (game.mode === "all-random") stats.allRandomGames += 1;
  if (game.mode === "coliseum") {
    stats.coliseumGames += 1;
    if (isWin) stats.coliseumWins += 1;
  }
  if (!stats.modesPlayed.includes(game.mode)) {
    stats.modesPlayed = [...stats.modesPlayed, game.mode];
  }
  if (isWin && game.isQuickWin) stats.quickWins += 1;
  if (game.wasPromoted) stats.promotions += 1;
  if (isWin && game.wasScholarsMate) stats.scholarsMates += 1;
  if (game.hintsFollowedInGame) stats.hintsFollowed += game.hintsFollowedInGame;
  if (game.language && !stats.languagesUsed.includes(game.language)) {
    stats.languagesUsed = [...stats.languagesUsed, game.language];
  }
  if (
    isWin &&
    game.playType === "ai" &&
    game.aiDifficulty === 20 &&
    !game.assistanceUsedDuringGame
  ) {
    stats.beatMaxAINoAssist += 1;
  }

  // ── Day streak ──
  if (stats.lastPlayedDate !== today) {
    if (stats.lastPlayedDate === yesterdayKey()) {
      stats.currentDayStreak += 1;
    } else {
      stats.currentDayStreak = 1;
    }
    stats.maxDayStreak = Math.max(stats.maxDayStreak, stats.currentDayStreak);
    stats.lastPlayedDate = today;
  }

  // Purge dailyActivity entries older than 365 days to bound localStorage growth.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  for (const key of Object.keys(stats.dailyActivity)) {
    if (key < cutoffKey) delete stats.dailyActivity[key];
  }

  saveStats(stats);
}

/** Record that the player opened the feedback mail client — unlocks contributor badge. */
export function recordFeedbackSent(): void {
  const stats = getStats();
  stats.feedbackSent += 1;
  saveStats(stats);
}

/** Mark the player as having donated — unlocks the what_else badge. */
export function recordCoffeeDonation(): void {
  const stats = getStats();
  if (stats.coffeeDonated) return; // already set, avoid unnecessary write
  stats.coffeeDonated = true;
  saveStats(stats);
}

// ── Computed helpers ──────────────────────────────────────────────────────────

/** Returns the PieceType with the highest count in a map, excluding 'pawn'. Returns null if empty. */
export function getTopPiece(
  counts: Partial<Record<PieceType, number>>,
): PieceType | null {
  const entries = (Object.entries(counts) as [PieceType, number][])
    .filter(([t]) => t !== "pawn")
    .sort(([, a], [, b]) => b - a);
  return entries[0]?.[0] ?? null;
}

/** Returns preferred game mode id (most played). */
export function getPreferredMode(
  modeGameCount: Record<string, number>,
): string | null {
  const entries = Object.entries(modeGameCount).sort(([, a], [, b]) => b - a);
  return entries[0]?.[0] ?? null;
}

/** Returns win rate as a value between 0 and 1. */
export function getWinRate(stats: ChessverseStats): number {
  if (stats.totalGames === 0) return 0;
  return stats.wins / stats.totalGames;
}

/** Returns heatmap data for the last 365 days. */
export function getHeatmapData(
  dailyActivity: Record<string, number>,
): { date: string; count: number }[] {
  const result: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    result.push({ date: key, count: dailyActivity[key] ?? 0 });
  }
  return result;
}

/** Format duration in ms to human-readable string (e.g. "2h 34m" or "45m 12s") */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
