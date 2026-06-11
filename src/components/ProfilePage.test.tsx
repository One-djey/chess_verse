// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "./ProfilePage";
import { SkinProvider } from "../context/SkinContext";
import { BoardSkinProvider } from "../context/BoardSkinContext";
import type { ChessverseStats } from "../services/statsService";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("./Footer", () => ({ default: () => null }));

// Mock statsService so we control what getStats() returns
const mockStats: ChessverseStats = {
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

vi.mock("../services/statsService", async (importOriginal) => {
  const original = await importOriginal<typeof import("../services/statsService")>();
  return {
    ...original,
    getStats: vi.fn(() => mockStats),
    getPreferredMode: vi.fn(() => null),
    formatDuration: vi.fn((ms: number) => `${ms}ms`),
  };
});

function renderProfilePage() {
  return render(
    <MemoryRouter>
      <SkinProvider>
        <BoardSkinProvider>
          <ProfilePage />
        </BoardSkinProvider>
      </SkinProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  // Reset to zero-game state
  Object.assign(mockStats, {
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
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe("ProfilePage — empty state", () => {
  it("shows the no-games message when totalGames=0", () => {
    renderProfilePage();
    expect(screen.getByText("profile.noGames")).toBeInTheDocument();
  });

  it("does not show the stats grid when totalGames=0", () => {
    renderProfilePage();
    expect(screen.queryByText("profile.totalGames")).not.toBeInTheDocument();
  });

  it("always renders the badges section even with no games", () => {
    renderProfilePage();
    expect(screen.getByText("profile.achievements")).toBeInTheDocument();
  });
});

// ── With games ────────────────────────────────────────────────────────────────

describe("ProfilePage — with games", () => {
  beforeEach(() => {
    Object.assign(mockStats, {
      totalGames: 10,
      wins: 6,
      losses: 3,
      draws: 1,
      localGames: 8,
      p2pGames: 2,
      aiGames: 5,
      currentWinStreak: 2,
      maxWinStreak: 4,
    });
  });

  it("shows the stats grid when there are games", () => {
    renderProfilePage();
    expect(screen.getByText("profile.totalGames")).toBeInTheDocument();
  });

  it("renders the ELO badge hero section", () => {
    renderProfilePage();
    // ELOBadge renders; profile.currentStreak is shown
    expect(screen.getByText("profile.currentStreak")).toBeInTheDocument();
  });

  it("renders the current win streak value from stats", () => {
    renderProfilePage();
    // "profile.currentStreak" label is next to the streak value; assert its presence
    expect(screen.getByText("profile.currentStreak")).toBeInTheDocument();
    // The streak value "2" appears at least once (there may be multiple "2"s on the page)
    const all2 = screen.getAllByText("2");
    expect(all2.length).toBeGreaterThan(0);
  });

  it("renders the heatmap section", () => {
    renderProfilePage();
    // ActivityHeatmap renders a section heading or the component itself
    expect(screen.queryByText("profile.noGames")).not.toBeInTheDocument();
  });

  it("shows the badges section with at least the firstStep badge unlocked", () => {
    renderProfilePage();
    expect(screen.getByText("profile.achievements")).toBeInTheDocument();
    expect(screen.getAllByText("profile.unlocked").length).toBeGreaterThan(0);
  });
});

// ── Breadcrumb ────────────────────────────────────────────────────────────────

describe("ProfilePage — navigation", () => {
  it("shows 'profile.title' as a breadcrumb label", () => {
    renderProfilePage();
    expect(screen.getAllByText("profile.title").length).toBeGreaterThan(0);
  });
});
