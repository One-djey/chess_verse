// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameSettings from "./GameSettings";
import { SkinProvider } from "../context/SkinContext";
import { BoardSkinProvider } from "../context/BoardSkinContext";
import type { LocalSettings } from "../hooks/useChessGame";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

// matchMedia is not available in jsdom — stub useInstall to avoid the crash
vi.mock("../hooks/useInstall", () => ({
  useInstall: () => ({ canInstall: false, triggerInstall: vi.fn() }),
}));

// recordCoffeeDonation is called from the donate link — stub it out
vi.mock("../services/statsService", () => ({
  recordCoffeeDonation: vi.fn(),
  BADGES: [],
}));

const DEFAULT_SETTINGS: LocalSettings = {
  aiEnabled: true,
  aiDifficulty: 5,
  flipBoard: false,
  showDangerIndicator: false,
  showHint: false,
  showMoveAnnotations: false,
};

function renderSettings(
  props: Partial<Parameters<typeof GameSettings>[0]> = {},
) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    settings: DEFAULT_SETTINGS,
    onSettingsChange: vi.fn(),
  };
  return render(
    <SkinProvider>
      <BoardSkinProvider>
        <GameSettings {...defaultProps} {...props} />
      </BoardSkinProvider>
    </SkinProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// ── Visibility ────────────────────────────────────────────────────────────────

describe("GameSettings — visibility", () => {
  it("renders nothing when isOpen=false", () => {
    renderSettings({ isOpen: false });
    expect(screen.queryByText("gameSettings.title")).not.toBeInTheDocument();
  });

  it("renders the modal when isOpen=true", () => {
    renderSettings();
    expect(screen.getByText("gameSettings.title")).toBeInTheDocument();
  });

  it("calls onClose when the X button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSettings({ onClose });
    // The X button has no accessible name — query by role button nearest the title
    const closeBtn = screen.getAllByRole("button").find((b) =>
      b.getAttribute("class")?.includes("rounded-lg"),
    );
    await user.click(closeBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Tabs ──────────────────────────────────────────────────────────────────────

describe("GameSettings — tabs", () => {
  it("starts on the 'partie' tab and shows game-type buttons", () => {
    renderSettings();
    expect(
      screen.getByRole("button", { name: "gameSettings.soloPlay" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "gameSettings.vsAI" }),
    ).toBeInTheDocument();
  });

  it("switches to the assistance tab", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      screen.getByRole("button", { name: "gameSettings.tab.assistance" }),
    );
    expect(screen.getByText("learning.dangerIndicator")).toBeInTheDocument();
  });

  it("switches to the apparence tab and shows the language select", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      screen.getByRole("button", { name: "gameSettings.tab.apparence" }),
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("hides the 'partie' tab for coliseum mode", () => {
    renderSettings({ gameMode: "coliseum" });
    expect(
      screen.queryByRole("button", { name: "gameSettings.tab.partie" }),
    ).not.toBeInTheDocument();
    // The assistance tab should be the first visible tab
    expect(
      screen.getByRole("button", { name: "gameSettings.tab.assistance" }),
    ).toBeInTheDocument();
  });
});

// ── Game settings changes ─────────────────────────────────────────────────────

describe("GameSettings — settings changes", () => {
  it("calls onSettingsChange with aiEnabled=false when solo play is clicked", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    renderSettings({ onSettingsChange });
    await user.click(
      screen.getByRole("button", { name: "gameSettings.soloPlay" }),
    );
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ aiEnabled: false }),
    );
  });

  it("calls onSettingsChange with aiEnabled=true when vs AI is clicked", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    renderSettings({
      settings: { ...DEFAULT_SETTINGS, aiEnabled: false },
      onSettingsChange,
    });
    await user.click(
      screen.getByRole("button", { name: "gameSettings.vsAI" }),
    );
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ aiEnabled: true }),
    );
  });

  it("changes difficulty when a gauge segment is clicked", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    renderSettings({ onSettingsChange });
    // Segments are buttons with title="1".."20"
    const seg10 = screen.getByRole("button", { name: "10" });
    await user.click(seg10);
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ aiDifficulty: 10 }),
    );
  });

  it("toggles showDangerIndicator in assistance tab", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    renderSettings({ onSettingsChange });
    await user.click(
      screen.getByRole("button", { name: "gameSettings.tab.assistance" }),
    );
    // Accessible name includes the "OFF" badge text, so use regex
    await user.click(
      screen.getByRole("switch", { name: /learning\.dangerIndicator/ }),
    );
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ showDangerIndicator: true }),
    );
  });

  it("toggles showMoveAnnotations in assistance tab", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    renderSettings({ onSettingsChange });
    await user.click(
      screen.getByRole("button", { name: "gameSettings.tab.assistance" }),
    );
    await user.click(
      screen.getByRole("switch", { name: /learning\.moveAnnotations/ }),
    );
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ showMoveAnnotations: true }),
    );
  });
});

// ── Without game settings prop (standalone mode) ──────────────────────────────

describe("GameSettings — standalone (no settings prop)", () => {
  it("reads from and writes to localStorage when no settings prop is provided", async () => {
    const user = userEvent.setup();
    renderSettings({ settings: undefined, onSettingsChange: undefined });
    await user.click(
      screen.getByRole("button", { name: "gameSettings.soloPlay" }),
    );
    const saved = JSON.parse(localStorage.getItem("chess_settings") ?? "{}");
    expect(saved.aiEnabled).toBe(false);
  });

  it("falls back to defaults when localStorage is empty", () => {
    renderSettings({ settings: undefined, onSettingsChange: undefined });
    // The "vs AI" button should appear selected (default aiEnabled=true)
    expect(
      screen.getByRole("button", { name: "gameSettings.vsAI" }),
    ).toBeInTheDocument();
  });
});

// ── Feedback modal integration ─────────────────────────────────────────────────

describe("GameSettings — feedback button", () => {
  it("calls onClose and reveals the FeedbackModal when feedback button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSettings({ onClose });
    // Close the settings modal
    await user.click(
      screen.getByRole("button", { name: "feedback.button" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    // FeedbackModal should now be open (it survives outside the isOpen guard)
    expect(screen.getByText("feedback.title")).toBeInTheDocument();
  });
});
