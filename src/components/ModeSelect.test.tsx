// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import ModeSelect from "./ModeSelect";
import { SkinProvider } from "../context/SkinContext";
import { BoardSkinProvider } from "../context/BoardSkinContext";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

// Stub Footer so we don't need to deal with its i18n dependencies
vi.mock("./Footer", () => ({ default: () => null }));

// Hoisted so the factory can close over it
let mockIsOnline = true;
vi.mock("../hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => mockIsOnline,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}|{JSON.stringify(location.state)}
    </div>
  );
}

function renderModeSelect() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <SkinProvider>
        <BoardSkinProvider>
          <ModeSelect />
        </BoardSkinProvider>
      </SkinProvider>
      <LocationProbe />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  mockIsOnline = true;
});

describe("ModeSelect — online toggle", () => {
  it("shows the Local/Multiplayer toggle and the mode grid", () => {
    renderModeSelect();
    expect(
      screen.getByRole("button", { name: "modeSelect.local" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "modeSelect.multiplayer" }),
    ).toBeInTheDocument();
    expect(screen.getByText("modes.classic.title")).toBeInTheDocument();
  });

  it("defaults to Local: selecting a mode navigates to /game/:id", async () => {
    const user = userEvent.setup();
    renderModeSelect();
    await user.click(screen.getByText("modes.classic.title"));
    expect(screen.getByTestId("location")).toHaveTextContent("/game/classic");
  });

  it("switching to Multiplayer routes mode selection through /p2p with the preset mode", async () => {
    const user = userEvent.setup();
    renderModeSelect();
    await user.click(
      screen.getByRole("button", { name: "modeSelect.multiplayer" }),
    );
    await user.click(screen.getByText("modes.classic.title"));
    expect(screen.getByTestId("location")).toHaveTextContent(
      '/p2p|{"presetModeId":"classic"}',
    );
  });
});

describe("ModeSelect — offline state", () => {
  it("replaces the toggle with an offline label and stays in local mode", async () => {
    mockIsOnline = false;
    const user = userEvent.setup();
    renderModeSelect();

    expect(screen.getByText("modeSelect.offlineMode")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "modeSelect.multiplayer" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText("modes.classic.title"));
    expect(screen.getByTestId("location")).toHaveTextContent("/game/classic");
  });
});
