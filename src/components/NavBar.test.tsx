// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import NavBar from "./NavBar";
import { SkinProvider } from "../context/SkinContext";
import { BoardSkinProvider } from "../context/BoardSkinContext";

// i18n: t() returns the raw key so assertions are locale-independent.
// initReactI18next is needed because NavBar renders GameSettings, which
// transitively imports src/i18n (the real i18next init calls i18n.use()).
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

function renderNavBar(props: Partial<React.ComponentProps<typeof NavBar>> = {}) {
  // SkinProvider/BoardSkinProvider are required by the GameSettings modal
  // that NavBar always mounts (its hooks throw without a provider).
  return render(
    <MemoryRouter initialEntries={["/game/classic"]}>
      <SkinProvider>
        <BoardSkinProvider>
          <NavBar {...props} />
        </BoardSkinProvider>
      </SkinProvider>
      <LocationProbe />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("NavBar — breadcrumbs", () => {
  it("renders the brand and navigates home on click", async () => {
    const user = userEvent.setup();
    renderNavBar();
    await user.click(screen.getByRole("button", { name: "ChessVerse" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("renders breadcrumbs in order after the brand", () => {
    const { container } = renderNavBar({
      breadcrumbs: [{ label: "Local", path: "/local" }, { label: "Classic" }],
    });
    const nav = container.querySelector("nav")!;
    expect(nav.textContent).toMatch(/ChessVerse.*Local.*Classic/);
  });

  it("crumbs with a path are clickable buttons that navigate", async () => {
    const user = userEvent.setup();
    renderNavBar({
      breadcrumbs: [{ label: "Local", path: "/local" }, { label: "Classic" }],
    });
    await user.click(screen.getByRole("button", { name: "Local" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/local");
  });

  it("the last crumb (no path) is plain text, not a button", () => {
    renderNavBar({
      breadcrumbs: [{ label: "Local", path: "/local" }, { label: "Classic" }],
    });
    const last = screen.getByText("Classic");
    expect(last.tagName).toBe("SPAN");
    expect(
      screen.queryByRole("button", { name: "Classic" }),
    ).not.toBeInTheDocument();
  });
});

describe("NavBar — actions", () => {
  it("shows no Surrender button by default", () => {
    renderNavBar();
    expect(
      screen.queryByRole("button", { name: "nav.surrender" }),
    ).not.toBeInTheDocument();
  });

  it("shows the Surrender button when onSurrender is passed and forwards the click", async () => {
    const user = userEvent.setup();
    const onSurrender = vi.fn();
    renderNavBar({ onSurrender });
    await user.click(screen.getByRole("button", { name: "nav.surrender" }));
    expect(onSurrender).toHaveBeenCalledTimes(1);
  });

  it("shows the View Result button only when onShowResult is passed", async () => {
    const user = userEvent.setup();
    renderNavBar();
    expect(
      screen.queryByRole("button", { name: "nav.viewResult" }),
    ).not.toBeInTheDocument();
    cleanup();
    const onShowResult = vi.fn();
    renderNavBar({ onShowResult });
    await user.click(screen.getByRole("button", { name: "nav.viewResult" }));
    expect(onShowResult).toHaveBeenCalledTimes(1);
  });

  it("the profile icon navigates to /profile", async () => {
    const user = userEvent.setup();
    renderNavBar();
    await user.click(screen.getByRole("button", { name: "profile.title" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/profile");
  });

  it("the settings gear opens the GameSettings modal", async () => {
    const user = userEvent.setup();
    renderNavBar();
    expect(screen.queryByText("gameSettings.title")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "nav.settings" }));
    expect(screen.getByText("gameSettings.title")).toBeInTheDocument();
  });
});
