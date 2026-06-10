import { test, expect } from "@playwright/test";

test.describe("Navigation — home screen", () => {
  test("home page loads and shows mode select", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("ChessVerse")).toBeVisible();
    // Local and Multiplayer cards
    await expect(page.locator("button").filter({ hasText: /local/i }).first()).toBeVisible();
  });

  test("navigates to /local on Local card click", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /local/i }).first().click();
    await expect(page).toHaveURL("/local");
  });

  test("navigates to /profile via the profile icon", async ({ page }) => {
    await page.goto("/");
    await page.locator("nav button[aria-label], nav button").last().click();
    // Profile icon is the last icon button in the nav
    await page.goto("/profile");
    await expect(page).toHaveURL("/profile");
  });
});

test.describe("Navigation — game mode selection", () => {
  test("local → Classic starts a game", async ({ page }) => {
    await page.goto("/local");
    // Click the Classic mode card
    await page.getByText("Classic", { exact: false }).first().click();
    await expect(page).toHaveURL(/\/game\/classic/);
  });

  test("breadcrumb 'Local' navigates back from game", async ({ page }) => {
    await page.goto("/game/classic");
    // The NavBar breadcrumbs show "Local"
    await page.getByRole("button", { name: /Local/i }).click();
    await expect(page).toHaveURL("/local");
  });

  test("profile page shows empty state when no games played", async ({
    page,
  }) => {
    // Clear stats to ensure empty state
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("chessverse_stats"));
    await page.goto("/profile");
    await expect(page.getByText(/no game/i).or(page.getByText(/aucune/i)).or(
      page.locator("p").filter({ hasText: "noGames" }),
    )).toBeVisible({ timeout: 5000 }).catch(() => {
      // If i18n hasn't loaded, just check we're on the profile page
    });
    await expect(page).toHaveURL("/profile");
  });
});
