// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import BadgesGrid from "./BadgesGrid";
import { BADGES } from "../../services/statsService";
import type { ChessverseStats } from "../../services/statsService";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const BASE_STATS: ChessverseStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  localGames: 0,
  p2pGames: 0,
  aiGames: 0,
  surrenders: 0,
  totalDurationMs: 0,
  currentWinStreak: 0,
  maxWinStreak: 0,
  currentDayStreak: 0,
  maxDayStreak: 0,
  lastPlayedDate: null,
  maxAILevelBeaten: 0,
  nightGames: 0,
  morningGames: 0,
  quickWins: 0,
  promotions: 0,
  scholarsMates: 0,
  feedbackSent: 0,
  coffeeDonated: false,
  pieceMoveCount: {},
  pieceCapturedCount: {},
  modeGameCount: {},
  dailyActivity: {},
  modesPlayed: [],
  languagesUsed: [],
};

afterEach(() => {
  cleanup();
});

describe("BadgesGrid — structure", () => {
  it("renders one card per badge", () => {
    render(<BadgesGrid stats={BASE_STATS} />);
    // Each badge renders its i18nKey as label text (t returns key)
    for (const badge of BADGES) {
      expect(screen.getByText(badge.i18nKey)).toBeInTheDocument();
    }
  });

  it("all cards are locked (grayscale) when stats are empty", () => {
    const { container } = render(<BadgesGrid stats={BASE_STATS} />);
    const cards = container.querySelectorAll(".grayscale");
    expect(cards.length).toBe(BADGES.length);
  });
});

describe("BadgesGrid — unlock state", () => {
  it("shows the 'profile.unlocked' label for an unlocked badge", () => {
    // firstStep badge unlocks at totalGames >= 1
    const stats: ChessverseStats = { ...BASE_STATS, totalGames: 1 };
    render(<BadgesGrid stats={stats} />);
    expect(screen.getAllByText("profile.unlocked").length).toBeGreaterThan(0);
  });

  it("does not show 'profile.unlocked' when the badge is still locked", () => {
    render(<BadgesGrid stats={BASE_STATS} />);
    expect(screen.queryByText("profile.unlocked")).not.toBeInTheDocument();
  });

  it("shows the progress bar for locked badges that have a progress fn", () => {
    const { container } = render(<BadgesGrid stats={BASE_STATS} />);
    // All BADGES have a progress function and stats.totalGames=0 keeps them locked
    const bars = container.querySelectorAll(".bg-blue-400");
    expect(bars.length).toBeGreaterThan(0);
  });
});

describe("BadgesGrid — specific badges", () => {
  it("unlocks p2pPioneer after one P2P game", () => {
    const stats: ChessverseStats = { ...BASE_STATS, totalGames: 1, p2pGames: 1 };
    render(<BadgesGrid stats={stats} />);
    // Two badges unlocked: firstStep + p2pPioneer
    expect(screen.getAllByText("profile.unlocked").length).toBeGreaterThanOrEqual(2);
  });

  it("unlocks onFire when maxWinStreak >= 3", () => {
    const stats: ChessverseStats = {
      ...BASE_STATS,
      totalGames: 3,
      wins: 3,
      maxWinStreak: 3,
    };
    render(<BadgesGrid stats={stats} />);
    const unlocked = screen.getAllByText("profile.unlocked");
    expect(unlocked.length).toBeGreaterThanOrEqual(2); // firstStep + onFire
  });

  it("shows progress 0/3 for onFire when maxWinStreak=0", () => {
    render(<BadgesGrid stats={BASE_STATS} />);
    // Progress text e.g. "0/3" — the onFire badge shows 0/3
    expect(screen.getByText("0/3")).toBeInTheDocument();
  });
});
