// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import GameOver from "./GameOver";

// i18n: t() returns the raw key so assertions are locale-independent.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

/** Renders the current pathname so we can assert navigation results. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const baseProps = {
  winner: "white" as const,
  duration: 125000,
  moveCount: 42,
  onReplay: vi.fn(),
};

function renderGameOver(props: Partial<React.ComponentProps<typeof GameOver>> = {}) {
  return render(
    <MemoryRouter initialEntries={["/game/classic"]}>
      <GameOver {...baseProps} {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GameOver — title logic", () => {
  it("shows draw title and stalemate reason when winner is null", () => {
    renderGameOver({ winner: null, drawReason: "stalemate" });
    expect(screen.getByText("gameOver.draw")).toBeInTheDocument();
    expect(screen.getByText("gameOver.stalemate")).toBeInTheDocument();
    // No winner badge on a draw
    expect(screen.queryByText("gameOver.white")).not.toBeInTheDocument();
    expect(screen.queryByText("gameOver.black")).not.toBeInTheDocument();
  });

  it("shows only-kings reason for that draw type", () => {
    renderGameOver({ winner: null, drawReason: "only-kings" });
    expect(screen.getByText("gameOver.draw")).toBeInTheDocument();
    expect(screen.getByText("gameOver.onlyKings")).toBeInTheDocument();
  });

  it("shows surrender titles for each color", () => {
    renderGameOver({ winner: "black", surrenderedBy: "white" });
    expect(screen.getByText("gameOver.whiteSurrendered")).toBeInTheDocument();
    cleanup();
    renderGameOver({ winner: "white", surrenderedBy: "black" });
    expect(screen.getByText("gameOver.blackSurrendered")).toBeInTheDocument();
  });

  it("shows defeat when the AI (black) wins, victory when white beats the AI", () => {
    renderGameOver({ winner: "black", aiEnabled: true, aiDifficulty: 5 });
    expect(screen.getByText("gameOver.defeat")).toBeInTheDocument();
    cleanup();
    renderGameOver({ winner: "white", aiEnabled: true, aiDifficulty: 5 });
    expect(screen.getByText("gameOver.victory")).toBeInTheDocument();
  });

  // NOTE: in local non-AI games the title is always "victory" even when black
  // wins — both players are local humans, so someone at the device won.
  it("shows victory for a black win in a local game without AI", () => {
    renderGameOver({ winner: "black", aiEnabled: false });
    expect(screen.getByText("gameOver.victory")).toBeInTheDocument();
    expect(screen.getByText("gameOver.black")).toBeInTheDocument(); // winner badge
  });

  // NOTE: in P2P the title only names the winning color; playerColor is used
  // for the defeat *styling* (gray trophy), not the title text.
  it("shows whiteWins / blackWins titles in P2P mode regardless of playerColor", () => {
    renderGameOver({ isP2PMode: true, winner: "white", playerColor: "black" });
    expect(screen.getByText("gameOver.whiteWins")).toBeInTheDocument();
    cleanup();
    renderGameOver({ isP2PMode: true, winner: "black", playerColor: "white" });
    expect(screen.getByText("gameOver.blackWins")).toBeInTheDocument();
  });
});

describe("GameOver — stats", () => {
  it("formats duration as minutes and seconds (125000ms → 2m 5s)", () => {
    renderGameOver({ duration: 125000 });
    expect(screen.getByText("2m 5s")).toBeInTheDocument();
  });

  it("shows the move count", () => {
    renderGameOver({ moveCount: 42 });
    expect(screen.getByText("gameOver.movesPlayed")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows the AI level row only when aiEnabled with a difficulty", () => {
    renderGameOver({ aiEnabled: true, aiDifficulty: 5 });
    expect(screen.getByText("gameOver.aiLevel")).toBeInTheDocument();
    // getDifficultyKey(5) → index ceil(5/2)-1 = 2
    expect(
      screen.getByText("gameSettings.difficultyLevels.2"),
    ).toBeInTheDocument();
    cleanup();
    renderGameOver({ aiEnabled: false });
    expect(screen.queryByText("gameOver.aiLevel")).not.toBeInTheDocument();
  });
});

describe("GameOver — rematch states (P2P)", () => {
  it("shows the rematch button when idle and calls onRematch on click", async () => {
    const user = userEvent.setup();
    const onRematch = vi.fn();
    renderGameOver({
      isP2PMode: true,
      rematchState: "idle",
      peerLeft: false,
      onRematch,
    });
    const btn = screen.getByRole("button", { name: "gameOver.rematch" });
    await user.click(btn);
    expect(onRematch).toHaveBeenCalledTimes(1);
  });

  it("shows a waiting indicator (and no rematch button) when requested", () => {
    renderGameOver({ isP2PMode: true, rematchState: "requested" });
    expect(screen.getByText("gameOver.waitingForOpponent")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "gameOver.rematch" }),
    ).not.toBeInTheDocument();
  });

  it("shows accept/decline when the opponent offers a rematch and wires the handlers", async () => {
    const user = userEvent.setup();
    const onAcceptRematch = vi.fn();
    const onDeclineRematch = vi.fn();
    renderGameOver({
      isP2PMode: true,
      rematchState: "offered",
      onAcceptRematch,
      onDeclineRematch,
    });
    expect(
      screen.getByText("gameOver.opponentWantsRematch"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "gameOver.accept" }));
    expect(onAcceptRematch).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "gameOver.decline" }));
    expect(onDeclineRematch).toHaveBeenCalledTimes(1);
  });

  // NOTE: when the peer left, the rematch button is *hidden* (not disabled).
  it("hides the rematch button and shows the opponent-left banner when peerLeft", () => {
    renderGameOver({ isP2PMode: true, rematchState: "idle", peerLeft: true });
    expect(screen.getByText("gameOver.opponentLeft")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "gameOver.rematch" }),
    ).not.toBeInTheDocument();
  });
});

describe("GameOver — buttons & navigation", () => {
  it("calls onReplay when Play Again is clicked (local mode only)", async () => {
    const user = userEvent.setup();
    const onReplay = vi.fn();
    renderGameOver({ onReplay });
    await user.click(screen.getByRole("button", { name: "gameOver.playAgain" }));
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it("does not render Play Again in P2P mode", () => {
    renderGameOver({ isP2PMode: true, rematchState: "idle" });
    expect(
      screen.queryByRole("button", { name: "gameOver.playAgain" }),
    ).not.toBeInTheDocument();
  });

  it("navigates to returnPath and calls onMainMenu on Main Menu click", async () => {
    const user = userEvent.setup();
    const onMainMenu = vi.fn();
    renderGameOver({ returnPath: "/local", onMainMenu });
    await user.click(screen.getByRole("button", { name: "gameOver.mainMenu" }));
    expect(onMainMenu).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location")).toHaveTextContent("/local");
  });

  it("navigates to '/' by default when returnPath is not provided", async () => {
    const user = userEvent.setup();
    renderGameOver();
    await user.click(screen.getByRole("button", { name: "gameOver.mainMenu" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });
});

describe("GameOver — dismiss", () => {
  it("calls onDismiss when the ✕ button is clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    renderGameOver({ onDismiss });
    // NOTE: the close button aria-label is hardcoded "Close" (not translated).
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss on backdrop click but not on clicks inside the card", () => {
    const onDismiss = vi.fn();
    const { container } = renderGameOver({ onDismiss });
    // Click inside the card — stopPropagation must prevent dismissal
    fireEvent.click(screen.getByText("gameOver.victory"));
    expect(onDismiss).not.toHaveBeenCalled();
    // Click the overlay (backdrop)
    fireEvent.click(container.firstChild as Element);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders no ✕ button when onDismiss is not provided", () => {
    renderGameOver();
    expect(
      screen.queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument();
  });
});
