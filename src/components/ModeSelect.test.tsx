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
  return <div data-testid="location">{location.pathname}</div>;
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
});

describe("ModeSelect — rendering", () => {
  it("shows the subtitle and both mode cards", () => {
    renderModeSelect();
    expect(screen.getByText("modeSelect.subtitle")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /modeSelect\.local/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /modeSelect\.multiplayer/i }),
    ).toBeInTheDocument();
  });
});

describe("ModeSelect — navigation", () => {
  it("navigates to /local when Local is clicked", async () => {
    const user = userEvent.setup();
    renderModeSelect();
    await user.click(screen.getByRole("button", { name: /modeSelect\.local/i }));
    expect(screen.getByTestId("location")).toHaveTextContent("/local");
  });

  it("navigates to /p2p when Multiplayer is clicked while online", async () => {
    const user = userEvent.setup();
    renderModeSelect();
    await user.click(
      screen.getByRole("button", { name: /modeSelect\.multiplayer/i }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/p2p");
  });
});

describe("ModeSelect — offline state", () => {
  it("disables the Multiplayer button and shows offline label when offline", async () => {
    mockIsOnline = false;
    cleanup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <SkinProvider>
          <BoardSkinProvider>
            <ModeSelect />
          </BoardSkinProvider>
        </SkinProvider>
        <LocationProbe />
      </MemoryRouter>,
    );

    const multiBtn = screen.getByRole("button", { name: /modeSelect\.offline/i });
    expect(multiBtn).toBeDisabled();

    // Clicking a disabled button must not navigate
    await userEvent.setup().click(multiBtn);
    expect(screen.getByTestId("location")).toHaveTextContent("/");

    mockIsOnline = true;
  });
});
