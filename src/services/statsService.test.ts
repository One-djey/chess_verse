import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Static import is only used for PURE exports (constants & pure helpers).
// All stateful functions (getStats/saveStats/recordGame/…) are accessed via a
// per-test dynamic import (see beforeEach) because the module keeps a mutable
// DEFAULT_STATS object that recordGame can pollute (see the NOTE test below).
import {
  BADGES,
  ELO_RANKS,
  getELORank,
  getTopPiece,
  getPreferredMode,
  getWinRate,
  getHeatmapData,
  formatDuration,
  type Badge,
  type ChessverseStats,
  type GameRecord,
} from "./statsService";

const STORAGE_KEY = "chessverse_stats";

// ── Test utilities ────────────────────────────────────────────────────────────

function createLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string): string | null =>
      store.has(key) ? store.get(key)! : null,
    setItem: (key: string, value: string): void => {
      store.set(key, String(value));
    },
    removeItem: (key: string): void => {
      store.delete(key);
    },
    clear: (): void => {
      store.clear();
    },
    get length(): number {
      return store.size;
    },
    key: (i: number): string | null => [...store.keys()][i] ?? null,
    _store: store,
  };
}

type Svc = typeof import("./statsService");

let storage: ReturnType<typeof createLocalStorageStub>;
let svc: Svc;

beforeEach(async () => {
  storage = createLocalStorageStub();
  vi.stubGlobal("localStorage", storage);
  // Fresh module instance per test so DEFAULT_STATS pollution (see NOTE test)
  // cannot leak between tests.
  vi.resetModules();
  svc = await import("./statsService");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Mirrors the source's local-date key format 'YYYY-MM-DD'. */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function makeGame(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    mode: "classic",
    playType: "local",
    winner: "white",
    duration: 60_000,
    moveCount: 30,
    pieceMoves: {},
    piecesLost: {},
    playerColor: "white",
    hour: 12,
    ...overrides,
  };
}

/** Full default-shaped stats object for pure badge/helper tests. */
function baseStats(overrides: Partial<ChessverseStats> = {}): ChessverseStats {
  return {
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
    ...overrides,
  };
}

// ── getStats defaults & robustness ───────────────────────────────────────────

describe("getStats defaults & robustness", () => {
  it("returns default-shaped stats when storage is empty", () => {
    const stats = svc.getStats();
    expect(stats).toEqual(baseStats());
  });

  it("falls back to defaults without throwing on corrupt JSON", () => {
    storage.setItem(STORAGE_KEY, "{not valid json!!!");
    expect(() => svc.getStats()).not.toThrow();
    expect(svc.getStats()).toEqual(baseStats());
  });

  it("falls back to defaults when localStorage.getItem throws", () => {
    storage.getItem = () => {
      throw new Error("storage unavailable");
    };
    expect(svc.getStats()).toEqual(baseStats());
  });

  it("merges a stored object missing newer fields with defaults (schema migration)", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ wins: 5 }));
    const stats = svc.getStats();
    expect(stats.wins).toBe(5);
    // Every other field comes from defaults
    expect(stats).toEqual(baseStats({ wins: 5 }));
    expect(stats.coliseumGames).toBe(0);
    expect(stats.lastPlayedDate).toBeNull();
    expect(stats.modesPlayed).toEqual([]);
  });

  it("resetStats() + getStats() returns pristine defaults — no pollution from previous game", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 9, 12, 0, 0));
    svc.recordGame(makeGame({ mode: "classic" }));
    svc.resetStats();
    const stats = svc.getStats();
    expect(stats.modeGameCount["classic"]).toBeUndefined(); // no leak
    expect(stats.dailyActivity[dateKey(new Date())]).toBeUndefined(); // no leak
    expect(stats.totalGames).toBe(0);
  });
});

// ── recordGame nominal ───────────────────────────────────────────────────────

describe("recordGame nominal", () => {
  it("records a win: totalGames, wins, localGames, mode count, daily activity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 9, 14, 30, 0));
    svc.recordGame(
      makeGame({ winner: "white", playerColor: "white", playType: "local" }),
    );
    const stats = svc.getStats();
    expect(stats.totalGames).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
    expect(stats.draws).toBe(0);
    expect(stats.localGames).toBe(1);
    expect(stats.p2pGames).toBe(0);
    expect(stats.aiGames).toBe(0);
    expect(stats.modeGameCount["classic"]).toBe(1);
    expect(stats.dailyActivity["2026-06-09"]).toBe(1);
    expect(stats.lastGameResult).toBe("win");
  });

  it("records a loss when winner is the opponent color", () => {
    svc.recordGame(makeGame({ winner: "black", playerColor: "white" }));
    const stats = svc.getStats();
    expect(stats.losses).toBe(1);
    expect(stats.wins).toBe(0);
    expect(stats.draws).toBe(0);
    expect(stats.lastGameResult).toBe("loss");
  });

  it("records a draw when winner is null", () => {
    svc.recordGame(makeGame({ winner: null, drawReason: "stalemate" }));
    const stats = svc.getStats();
    expect(stats.draws).toBe(1);
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(0);
    expect(stats.lastGameResult).toBe("draw");
  });

  it("increments the correct play-type counter (local / p2p / ai)", () => {
    svc.recordGame(makeGame({ playType: "local" }));
    svc.recordGame(makeGame({ playType: "p2p" }));
    svc.recordGame(makeGame({ playType: "p2p" }));
    svc.recordGame(makeGame({ playType: "ai" }));
    const stats = svc.getStats();
    expect(stats.localGames).toBe(1);
    expect(stats.p2pGames).toBe(2);
    expect(stats.aiGames).toBe(1);
    expect(stats.totalGames).toBe(4);
  });

  it("accumulates totalDurationMs across games", () => {
    svc.recordGame(makeGame({ duration: 90_000 }));
    svc.recordGame(makeGame({ duration: 30_000 }));
    expect(svc.getStats().totalDurationMs).toBe(120_000);
  });

  it("merges pieceMoves into pieceMoveCount across games", () => {
    svc.recordGame(makeGame({ pieceMoves: { queen: 5, pawn: 10 } }));
    svc.recordGame(makeGame({ pieceMoves: { queen: 2, knight: 1 } }));
    expect(svc.getStats().pieceMoveCount).toEqual({
      queen: 7,
      pawn: 10,
      knight: 1,
    });
  });

  it("merges piecesLost into pieceCapturedCount across games", () => {
    svc.recordGame(makeGame({ piecesLost: { rook: 1, pawn: 3 } }));
    svc.recordGame(makeGame({ piecesLost: { rook: 1, bishop: 2 } }));
    expect(svc.getStats().pieceCapturedCount).toEqual({
      rook: 2,
      pawn: 3,
      bishop: 2,
    });
  });

  it("increments modeGameCount per mode and dailyActivity for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0));
    svc.recordGame(makeGame({ mode: "classic" }));
    svc.recordGame(makeGame({ mode: "classic" }));
    svc.recordGame(makeGame({ mode: "borderless" }));
    const stats = svc.getStats();
    expect(stats.modeGameCount).toEqual({ classic: 2, borderless: 1 });
    expect(stats.dailyActivity["2026-01-15"]).toBe(3);
  });
});

// ── Surrender counting ───────────────────────────────────────────────────────

describe("surrender counting", () => {
  it("increments surrenders when the player surrenders (loss)", () => {
    svc.recordGame(
      makeGame({
        winner: "black",
        playerColor: "white",
        surrenderedBy: "white",
      }),
    );
    const stats = svc.getStats();
    expect(stats.surrenders).toBe(1);
    expect(stats.losses).toBe(1);
  });

  it("does NOT increment surrenders when the opponent surrenders (player wins)", () => {
    svc.recordGame(
      makeGame({
        winner: "white",
        playerColor: "white",
        surrenderedBy: "black",
      }),
    );
    const stats = svc.getStats();
    expect(stats.surrenders).toBe(0);
    expect(stats.wins).toBe(1);
  });
});

// ── Win streaks ──────────────────────────────────────────────────────────────

describe("win streaks", () => {
  const win = () => makeGame({ winner: "white", playerColor: "white" });
  const loss = () => makeGame({ winner: "black", playerColor: "white" });
  const draw = () => makeGame({ winner: null });

  it("consecutive wins increment currentWinStreak and maxWinStreak", () => {
    svc.recordGame(win());
    svc.recordGame(win());
    const stats = svc.getStats();
    expect(stats.currentWinStreak).toBe(2);
    expect(stats.maxWinStreak).toBe(2);
  });

  it("a loss resets currentWinStreak to 0 but keeps maxWinStreak", () => {
    svc.recordGame(win());
    svc.recordGame(win());
    svc.recordGame(win());
    svc.recordGame(loss());
    const stats = svc.getStats();
    expect(stats.currentWinStreak).toBe(0);
    expect(stats.maxWinStreak).toBe(3);
    expect(stats.lastGameResult).toBe("loss");
  });

  it("a draw does NOT reset the current win streak", () => {
    svc.recordGame(win());
    svc.recordGame(draw());
    let stats = svc.getStats();
    expect(stats.currentWinStreak).toBe(1);
    expect(stats.lastGameResult).toBe("draw");
    svc.recordGame(win());
    stats = svc.getStats();
    expect(stats.currentWinStreak).toBe(2);
    expect(stats.maxWinStreak).toBe(2);
  });
});

// ── Day streaks ──────────────────────────────────────────────────────────────

describe("day streaks", () => {
  it("first ever game starts the day streak at 1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0));
    svc.recordGame(makeGame());
    const stats = svc.getStats();
    expect(stats.currentDayStreak).toBe(1);
    expect(stats.maxDayStreak).toBe(1);
    expect(stats.lastPlayedDate).toBe("2026-03-10");
  });

  it("a game on the next day increments the streak to 2", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0));
    svc.recordGame(makeGame());
    vi.setSystemTime(new Date(2026, 2, 11, 9, 0, 0));
    svc.recordGame(makeGame());
    const stats = svc.getStats();
    expect(stats.currentDayStreak).toBe(2);
    expect(stats.maxDayStreak).toBe(2);
    expect(stats.lastPlayedDate).toBe("2026-03-11");
  });

  it("a second game on the same day does not change the streak", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0));
    svc.recordGame(makeGame());
    vi.setSystemTime(new Date(2026, 2, 11, 9, 0, 0));
    svc.recordGame(makeGame());
    vi.setSystemTime(new Date(2026, 2, 11, 23, 0, 0));
    svc.recordGame(makeGame());
    const stats = svc.getStats();
    expect(stats.currentDayStreak).toBe(2);
    expect(stats.maxDayStreak).toBe(2);
  });

  it("a gap of 2+ days resets currentDayStreak to 1 but keeps maxDayStreak", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0));
    svc.recordGame(makeGame());
    vi.setSystemTime(new Date(2026, 2, 11, 12, 0, 0));
    svc.recordGame(makeGame());
    vi.setSystemTime(new Date(2026, 2, 12, 12, 0, 0));
    svc.recordGame(makeGame());
    // gap: 13th and 14th skipped
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));
    svc.recordGame(makeGame());
    const stats = svc.getStats();
    expect(stats.currentDayStreak).toBe(1);
    expect(stats.maxDayStreak).toBe(3);
    expect(stats.lastPlayedDate).toBe("2026-03-15");
  });

  it("streak continues across a month boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0));
    svc.recordGame(makeGame());
    vi.setSystemTime(new Date(2026, 1, 1, 12, 0, 0));
    svc.recordGame(makeGame());
    const stats = svc.getStats();
    expect(stats.currentDayStreak).toBe(2);
  });
});

// ── AI level ─────────────────────────────────────────────────────────────────

describe("maxAILevelBeaten", () => {
  it("is updated on a win vs AI with the difficulty level", () => {
    svc.recordGame(
      makeGame({
        playType: "ai",
        winner: "white",
        playerColor: "white",
        aiDifficulty: 5,
      }),
    );
    expect(svc.getStats().maxAILevelBeaten).toBe(5);
  });

  it("takes the max: beating level 5 then level 3 keeps 5", () => {
    svc.recordGame(
      makeGame({
        playType: "ai",
        winner: "white",
        playerColor: "white",
        aiDifficulty: 5,
      }),
    );
    svc.recordGame(
      makeGame({
        playType: "ai",
        winner: "white",
        playerColor: "white",
        aiDifficulty: 3,
      }),
    );
    expect(svc.getStats().maxAILevelBeaten).toBe(5);
  });

  it("is NOT updated on a loss vs a high-level AI", () => {
    svc.recordGame(
      makeGame({
        playType: "ai",
        winner: "black",
        playerColor: "white",
        aiDifficulty: 18,
      }),
    );
    expect(svc.getStats().maxAILevelBeaten).toBe(0);
  });

  it("is NOT updated on a non-AI win even if aiDifficulty is set", () => {
    svc.recordGame(
      makeGame({
        playType: "local",
        winner: "white",
        playerColor: "white",
        aiDifficulty: 12,
      }),
    );
    expect(svc.getStats().maxAILevelBeaten).toBe(0);
  });
});

// ── beatMaxAINoAssist (Magnus Carlsen badge) ─────────────────────────────────

describe("beatMaxAINoAssist counter", () => {
  const win20NoAssist = () =>
    makeGame({
      playType: "ai",
      winner: "white",
      playerColor: "white",
      aiDifficulty: 20,
      assistanceUsedDuringGame: false,
    });

  it("increments on a win at level 20 without any assistance", () => {
    svc.recordGame(win20NoAssist());
    expect(svc.getStats().beatMaxAINoAssist).toBe(1);
  });

  it("accumulates across multiple qualifying wins", () => {
    svc.recordGame(win20NoAssist());
    svc.recordGame(win20NoAssist());
    expect(svc.getStats().beatMaxAINoAssist).toBe(2);
  });

  it("does NOT increment on a loss at level 20 without assistance", () => {
    svc.recordGame(
      makeGame({
        playType: "ai",
        winner: "black",
        playerColor: "white",
        aiDifficulty: 20,
        assistanceUsedDuringGame: false,
      }),
    );
    expect(svc.getStats().beatMaxAINoAssist).toBe(0);
  });

  it("does NOT increment on a win at level 19 without assistance", () => {
    svc.recordGame(
      makeGame({
        playType: "ai",
        winner: "white",
        playerColor: "white",
        aiDifficulty: 19,
        assistanceUsedDuringGame: false,
      }),
    );
    expect(svc.getStats().beatMaxAINoAssist).toBe(0);
  });

  it("does NOT increment on a win at level 20 when assistance was used", () => {
    svc.recordGame(
      makeGame({
        playType: "ai",
        winner: "white",
        playerColor: "white",
        aiDifficulty: 20,
        assistanceUsedDuringGame: true,
      }),
    );
    expect(svc.getStats().beatMaxAINoAssist).toBe(0);
  });
});

// ── Time-of-day badges ───────────────────────────────────────────────────────

describe("time-of-day badge counters", () => {
  // recordGame reads the GameRecord's `hour` field (not the clock directly),
  // so we set the fake clock AND derive `hour` from it, like the app does.
  function recordAt(time: Date) {
    vi.setSystemTime(time);
    svc.recordGame(makeGame({ hour: new Date().getHours() }));
  }

  it("a game at 21:59 does not count as a night game", () => {
    vi.useFakeTimers();
    recordAt(new Date(2026, 5, 9, 21, 59, 0));
    expect(svc.getStats().nightGames).toBe(0);
  });

  it("a game at 22:00 counts as a night game", () => {
    vi.useFakeTimers();
    recordAt(new Date(2026, 5, 9, 22, 0, 0));
    expect(svc.getStats().nightGames).toBe(1);
  });

  it("a game at 07:59 counts as a morning game", () => {
    vi.useFakeTimers();
    recordAt(new Date(2026, 5, 9, 7, 59, 0));
    expect(svc.getStats().morningGames).toBe(1);
  });

  it("a game at 08:00 does not count as a morning game", () => {
    vi.useFakeTimers();
    recordAt(new Date(2026, 5, 9, 8, 0, 0));
    expect(svc.getStats().morningGames).toBe(0);
  });
});

// ── Badge counters ───────────────────────────────────────────────────────────

describe("badge counters", () => {
  it("increments allRandomGames for mode 'all-random'", () => {
    svc.recordGame(makeGame({ mode: "all-random" }));
    svc.recordGame(makeGame({ mode: "all-random" }));
    svc.recordGame(makeGame({ mode: "classic" }));
    expect(svc.getStats().allRandomGames).toBe(2);
  });

  it("increments coliseumGames always and coliseumWins only on wins", () => {
    svc.recordGame(
      makeGame({ mode: "coliseum", winner: "white", playerColor: "white" }),
    );
    svc.recordGame(
      makeGame({ mode: "coliseum", winner: "black", playerColor: "white" }),
    );
    const stats = svc.getStats();
    expect(stats.coliseumGames).toBe(2);
    expect(stats.coliseumWins).toBe(1);
  });

  it("modesPlayed keeps unique mode ids only", () => {
    svc.recordGame(makeGame({ mode: "classic" }));
    svc.recordGame(makeGame({ mode: "classic" }));
    svc.recordGame(makeGame({ mode: "borderless" }));
    expect(svc.getStats().modesPlayed).toEqual(["classic", "borderless"]);
  });

  it("quickWins increments only on a win flagged isQuickWin", () => {
    svc.recordGame(
      makeGame({ winner: "white", playerColor: "white", isQuickWin: true }),
    );
    svc.recordGame(
      makeGame({ winner: "black", playerColor: "white", isQuickWin: true }),
    );
    svc.recordGame(makeGame({ winner: "white", playerColor: "white" }));
    expect(svc.getStats().quickWins).toBe(1);
  });

  it("promotions increments on wasPromoted regardless of result", () => {
    svc.recordGame(
      makeGame({ winner: "black", playerColor: "white", wasPromoted: true }),
    );
    svc.recordGame(
      makeGame({ winner: "white", playerColor: "white", wasPromoted: true }),
    );
    expect(svc.getStats().promotions).toBe(2);
  });

  it("scholarsMates increments only on a win flagged wasScholarsMate", () => {
    svc.recordGame(
      makeGame({
        winner: "white",
        playerColor: "white",
        wasScholarsMate: true,
      }),
    );
    svc.recordGame(
      makeGame({
        winner: "black",
        playerColor: "white",
        wasScholarsMate: true,
      }),
    );
    expect(svc.getStats().scholarsMates).toBe(1);
  });

  it("hintsFollowed accumulates hintsFollowedInGame across games", () => {
    svc.recordGame(makeGame({ hintsFollowedInGame: 3 }));
    svc.recordGame(makeGame({ hintsFollowedInGame: 2 }));
    svc.recordGame(makeGame());
    expect(svc.getStats().hintsFollowed).toBe(5);
  });

  it("languagesUsed keeps unique languages only", () => {
    svc.recordGame(makeGame({ language: "en" }));
    svc.recordGame(makeGame({ language: "en" }));
    svc.recordGame(makeGame({ language: "fr" }));
    svc.recordGame(makeGame());
    expect(svc.getStats().languagesUsed).toEqual(["en", "fr"]);
  });

  it("recordFeedbackSent increments feedbackSent each time", () => {
    svc.recordFeedbackSent();
    svc.recordFeedbackSent();
    expect(svc.getStats().feedbackSent).toBe(2);
  });

  it("recordCoffeeDonation sets coffeeDonated and skips the write when already set", () => {
    svc.recordCoffeeDonation();
    expect(svc.getStats().coffeeDonated).toBe(true);
    const spy = vi.spyOn(storage, "setItem");
    svc.recordCoffeeDonation();
    expect(spy).not.toHaveBeenCalled();
    expect(svc.getStats().coffeeDonated).toBe(true);
  });
});

// ── BADGES array ─────────────────────────────────────────────────────────────

describe("BADGES", () => {
  // For each badge: stats just below the threshold and at the threshold.
  const badgeCases: Record<
    string,
    { below: Partial<ChessverseStats>; at: Partial<ChessverseStats> }
  > = {
    first_step: { below: {}, at: { totalGames: 1 } },
    contributor: { below: {}, at: { feedbackSent: 1 } },
    what_else: { below: {}, at: { coffeeDonated: true } },
    p2p_pioneer: { below: {}, at: { p2pGames: 1 } },
    early_bird: { below: {}, at: { morningGames: 1 } },
    diplomat: { below: {}, at: { draws: 1 } },
    bilingue: {
      below: { languagesUsed: ["en"] },
      at: { languagesUsed: ["en", "fr"] },
    },
    coronation: { below: {}, at: { promotions: 1 } },
    quick_win: { below: {}, at: { quickWins: 1 } },
    scholars_mate: { below: {}, at: { scholarsMates: 1 } },
    on_fire: { below: { maxWinStreak: 2 }, at: { maxWinStreak: 3 } },
    explorer: {
      below: { modesPlayed: ["a", "b", "c", "d"] },
      at: { modesPlayed: ["a", "b", "c", "d", "e"] },
    },
    coward: { below: { surrenders: 9 }, at: { surrenders: 10 } },
    night_owl: { below: { nightGames: 9 }, at: { nightGames: 10 } },
    chaos_fan: { below: { allRandomGames: 9 }, at: { allRandomGames: 10 } },
    assimilation_fan: {
      below: { modeGameCount: { assimilation: 9 } },
      at: { modeGameCount: { assimilation: 10 } },
    },
    borderless_traveler: {
      below: { modeGameCount: { borderless: 9 } },
      at: { modeGameCount: { borderless: 10 } },
    },
    gladiator: { below: { coliseumGames: 9 }, at: { coliseumGames: 10 } },
    assiduous: { below: { maxDayStreak: 6 }, at: { maxDayStreak: 7 } },
    serial_winner: { below: { wins: 19 }, at: { wins: 20 } },
    veteran: { below: { totalGames: 99 }, at: { totalGames: 100 } },
    unstoppable: { below: { maxWinStreak: 9 }, at: { maxWinStreak: 10 } },
    assisted: { below: { hintsFollowed: 99 }, at: { hintsFollowed: 100 } },
    ai_hunter: {
      below: { maxAILevelBeaten: 14 },
      at: { maxAILevelBeaten: 15 },
    },
    marathon: {
      below: { totalDurationMs: 42 * 3_600_000 - 60_000 },
      at: { totalDurationMs: 42 * 3_600_000 },
    },
    magnus_carlsen: {
      below: { beatMaxAINoAssist: 0 },
      at: { beatMaxAINoAssist: 1 },
    },
  };

  it("the test table covers every badge id exactly", () => {
    expect(Object.keys(badgeCases).sort()).toEqual(
      BADGES.map((b) => b.id).sort(),
    );
  });

  it.each(BADGES.map((b): [string, Badge] => [b.id, b]))(
    "badge '%s' is locked below threshold and unlocked at threshold",
    (id, badge) => {
      const cases = badgeCases[id];
      expect(cases).toBeDefined();
      expect(badge.isUnlocked(baseStats(cases.below))).toBe(false);
      expect(badge.isUnlocked(baseStats(cases.at))).toBe(true);
    },
  );

  it.each(BADGES.map((b): [string, Badge] => [b.id, b]))(
    "badge '%s' progress() reports current/target consistently",
    (id, badge) => {
      const cases = badgeCases[id];
      expect(badge.progress).toBeDefined();
      const below = badge.progress!(baseStats(cases.below));
      const at = badge.progress!(baseStats(cases.at));
      expect(below.target).toBeGreaterThan(0);
      expect(below.current).toBeLessThan(below.target);
      expect(at.current).toBe(at.target);
      // progress is capped at the target even when far beyond it
      const beyond = badge.progress!(
        baseStats({
          totalGames: 1000,
          feedbackSent: 1000,
          coffeeDonated: true,
          p2pGames: 1000,
          morningGames: 1000,
          draws: 1000,
          languagesUsed: ["a", "b", "c"],
          promotions: 1000,
          quickWins: 1000,
          scholarsMates: 1000,
          maxWinStreak: 1000,
          modesPlayed: ["a", "b", "c", "d", "e", "f"],
          surrenders: 1000,
          nightGames: 1000,
          allRandomGames: 1000,
          modeGameCount: { assimilation: 1000, borderless: 1000 },
          coliseumGames: 1000,
          maxDayStreak: 1000,
          wins: 1000,
          hintsFollowed: 1000,
          maxAILevelBeaten: 1000,
          totalDurationMs: 1000 * 3_600_000,
          beatMaxAINoAssist: 1000,
        }),
      );
      expect(beyond.current).toBe(beyond.target);
    },
  );
});

// ── ELO_RANKS / getELORank ───────────────────────────────────────────────────

describe("ELO_RANKS / getELORank", () => {
  it("ranks are sorted and contiguous from level 0 to 20", () => {
    expect(ELO_RANKS[0].minLevel).toBe(0);
    expect(ELO_RANKS[ELO_RANKS.length - 1].maxLevel).toBe(20);
    for (let i = 1; i < ELO_RANKS.length; i++) {
      expect(ELO_RANKS[i].minLevel).toBe(ELO_RANKS[i - 1].maxLevel + 1);
    }
  });

  it.each(
    ELO_RANKS.flatMap((rank) => [
      [rank.minLevel, rank.label] as [number, string],
      [rank.maxLevel, rank.label] as [number, string],
    ]),
  )("level %i maps to rank '%s'", (level, label) => {
    expect(getELORank(level).label).toBe(label);
  });

  it("a level above 20 maps to the highest rank", () => {
    expect(getELORank(25).label).toBe("Légende");
  });

  it("a negative level falls back to the first rank", () => {
    expect(getELORank(-1).label).toBe("Débutant");
  });
});

// ── Computed helpers ─────────────────────────────────────────────────────────

describe("getWinRate", () => {
  it("returns 0 when no games were played", () => {
    expect(getWinRate(baseStats())).toBe(0);
  });

  it("returns the exact fraction wins/totalGames", () => {
    expect(getWinRate(baseStats({ totalGames: 4, wins: 1 }))).toBe(0.25);
    expect(getWinRate(baseStats({ totalGames: 3, wins: 1 }))).toBeCloseTo(
      1 / 3,
      10,
    );
    expect(getWinRate(baseStats({ totalGames: 5, wins: 5 }))).toBe(1);
  });
});

describe("formatDuration", () => {
  it("formats 0 ms as '0s'", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats sub-minute durations as seconds", () => {
    expect(formatDuration(12_000)).toBe("12s");
    expect(formatDuration(59_000)).toBe("59s");
  });

  it("rounds milliseconds to the nearest second", () => {
    expect(formatDuration(499)).toBe("0s");
    expect(formatDuration(999)).toBe("1s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(5 * 60_000 + 12_000)).toBe("5m 12s");
    expect(formatDuration(60_000)).toBe("1m 0s");
  });

  it("formats hours and minutes (seconds dropped)", () => {
    expect(formatDuration(2 * 3_600_000 + 34 * 60_000)).toBe("2h 34m");
    expect(formatDuration(3_600_000)).toBe("1h 0m");
    expect(formatDuration(3_600_000 + 59_000)).toBe("1h 0m");
  });
});

describe("getTopPiece", () => {
  it("returns null for an empty map", () => {
    expect(getTopPiece({})).toBeNull();
  });

  it("returns the piece type with the highest count", () => {
    expect(getTopPiece({ knight: 2, queen: 9, rook: 5 })).toBe("queen");
  });

  it("excludes pawns even when they have the highest count", () => {
    expect(getTopPiece({ pawn: 100, bishop: 3 })).toBe("bishop");
  });

  it("returns null when only pawns are present", () => {
    expect(getTopPiece({ pawn: 42 })).toBeNull();
  });

  it("on a tie, returns the first entry in insertion order (stable sort)", () => {
    expect(getTopPiece({ queen: 3, rook: 3 })).toBe("queen");
    expect(getTopPiece({ rook: 3, queen: 3 })).toBe("rook");
  });
});

describe("getPreferredMode", () => {
  it("returns null for an empty record", () => {
    expect(getPreferredMode({})).toBeNull();
  });

  it("returns the most played mode", () => {
    expect(
      getPreferredMode({ classic: 2, borderless: 7, "all-random": 1 }),
    ).toBe("borderless");
  });

  it("on a tie, returns the first entry in insertion order (stable sort)", () => {
    expect(getPreferredMode({ classic: 3, coliseum: 3 })).toBe("classic");
  });
});

describe("getHeatmapData", () => {
  it("returns 365 entries ending today, with counts filled from dailyActivity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 9, 12, 0, 0)); // 2026-06-09
    const oldest = new Date(2026, 5, 9, 12, 0, 0);
    oldest.setDate(oldest.getDate() - 364);
    const activity = {
      "2026-06-09": 3,
      "2026-06-08": 1,
      [dateKey(oldest)]: 2,
      "2020-01-01": 99, // out of window — must be ignored
    };

    const data = getHeatmapData(activity);
    expect(data).toHaveLength(365);
    expect(data[364]).toEqual({ date: "2026-06-09", count: 3 });
    expect(data[363]).toEqual({ date: "2026-06-08", count: 1 });
    expect(data[0]).toEqual({ date: dateKey(oldest), count: 2 });
    expect(data.some((e) => e.date === "2020-01-01")).toBe(false);
    // every entry has the expected shape and unknown days default to 0
    expect(data[100].count).toBe(0);
    expect(data[100].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns all zeros for empty activity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 9, 12, 0, 0));
    const data = getHeatmapData({});
    expect(data).toHaveLength(365);
    expect(data.every((e) => e.count === 0)).toBe(true);
  });
});

// ── saveStats / resetStats ───────────────────────────────────────────────────

describe("saveStats / resetStats", () => {
  it("saveStats persists and getStats reads it back", () => {
    const stats = baseStats({ wins: 7, totalGames: 9 });
    svc.saveStats(stats);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(svc.getStats()).toEqual(stats);
  });

  it("resetStats removes the storage key", () => {
    svc.saveStats(baseStats({ wins: 7 }));
    svc.resetStats();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(svc.getStats().wins).toBe(0);
  });

  it("saveStats does not crash and emits console.warn when localStorage.setItem throws (quota exceeded)", () => {
    const original = storage.setItem.bind(storage);
    let thrown = false;
    storage.setItem = (key: string, value: string) => {
      if (!thrown) {
        thrown = true;
        throw new Error("QuotaExceededError");
      }
      original(key, value);
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => svc.saveStats(baseStats({ wins: 1 }))).not.toThrow();
    expect(thrown).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("quota"));
    warnSpy.mockRestore();
    // nothing persisted by the failed call
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    // subsequent saves work again
    svc.saveStats(baseStats({ wins: 2 }));
    expect(svc.getStats().wins).toBe(2);
  });

  it("recordGame does not crash when the underlying save fails", () => {
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => svc.recordGame(makeGame())).not.toThrow();
  });
});
