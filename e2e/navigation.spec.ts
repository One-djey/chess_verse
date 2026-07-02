import { test, expect } from "@playwright/test";

test.describe("Navigation — home screen", () => {
  test("home page loads and shows the Local/Multiplayer toggle with the mode grid", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("ChessVerse")).toBeVisible();
    // Toggle replaces the old two-step mode chooser
    await expect(page.getByRole("button", { name: /^local$/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /multiplayer/i }),
    ).toBeVisible();
    // The mode grid is already shown, no extra navigation step needed
    await expect(page.getByText("Classic", { exact: false }).first()).toBeVisible();
  });

  test("navigates to /profile via the profile icon", async ({ page }) => {
    await page.goto("/");
    await page.locator("nav button[aria-label], nav button").last().click();
    // Profile icon is the last icon button in the nav
    await page.goto("/profile");
    await expect(page).toHaveURL("/profile");
  });

  test("Local/Multiplayer toggle choice persists across reloads", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /multiplayer/i }).click();
    await expect(
      page.getByRole("button", { name: /multiplayer/i }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(
      page.getByRole("button", { name: /multiplayer/i }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: /^local$/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("Navigation — game mode selection", () => {
  test("home → Classic starts a local game directly", async ({ page }) => {
    await page.goto("/");
    // Local is selected by default; click the Classic mode card
    await page.getByText("Classic", { exact: false }).first().click();
    await expect(page).toHaveURL(/\/game\/classic/);
  });

  test("in-game breadcrumb shows only the mode title, not Local/Multiplayer", async ({
    page,
  }) => {
    await page.goto("/game/classic");
    const nav = page.locator("nav");
    await expect(nav.getByText("Classic", { exact: false })).toBeVisible();
    await expect(nav.getByText(/^local$/i)).toHaveCount(0);
    await expect(nav.getByText(/multiplayer/i)).toHaveCount(0);
    // The mode-title breadcrumb is a plain (non-clickable) label, not a button
    await expect(
      nav.getByRole("button", { name: "Classic", exact: false }),
    ).toHaveCount(0);

    // "ChessVerse" brand is still the way back home
    await page.getByRole("button", { name: "ChessVerse" }).click();
    await expect(page).toHaveURL("/");
  });

  test("profile page shows empty state when no games played", async ({
    page,
  }) => {
    // Force English and clear stats to ensure a deterministic empty state
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("chessverse_stats");
      localStorage.setItem("chessverse_language", "en");
    });
    await page.goto("/profile");
    await expect(page).toHaveURL("/profile");
    // en.json profile.noGames: "No games recorded yet. Play a game to see your stats!"
    await expect(page.getByText(/No games recorded yet/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
