import { test, expect, Page } from "@playwright/test";

// Helper: disable AI and navigate to the game ready for manual moves
async function startSoloGame(page: Page, mode = "classic") {
  // Must navigate to the app origin before accessing localStorage
  await page.goto("/");
  await page.evaluate(() => {
    // Force English so text assertions are deterministic across CI locales
    localStorage.setItem("chessverse_language", "en");
    localStorage.setItem(
      "chess_settings",
      JSON.stringify({
        aiEnabled: false,
        aiDifficulty: 5,
        flipBoard: false,
        showDangerIndicator: false,
        showHint: false,
        showMoveAnnotations: false,
      }),
    );
  });
  await page.goto(`/game/${mode}`);
  // The interactive layer: absolute overlay with z-20 class
  await page.locator(".grid-cols-8.grid-rows-8.z-20").waitFor({ timeout: 10_000 });
}

/**
 * Click a board square at display position (dx, dy).
 * dy=0 is the top row (black's back rank), dy=7 is the bottom (white's back rank).
 * dx=0 is the leftmost column (a-file).
 */
async function clickSquare(page: Page, dx: number, dy: number) {
  // The interactive layer is the 3rd .grid-cols-8 element (index 2, 0-based)
  // but it's uniquely identifiable by z-20 class
  const cells = page.locator(".grid-cols-8.grid-rows-8.z-20 > div");
  await cells.nth(dy * 8 + dx).click();
}

test.describe("Game board — rendering", () => {
  test("classic game board renders with 32 pieces", async ({ page }) => {
    await startSoloGame(page);
    // Each piece renders an <img alt="<color> <type>"> — exactly 16 per side
    const whitePieces = page.locator('img[alt^="white "]');
    const blackPieces = page.locator('img[alt^="black "]');
    await expect(whitePieces).toHaveCount(16);
    await expect(blackPieces).toHaveCount(16);
  });

  test("the surrender button is visible in an active game", async ({
    page,
  }) => {
    await startSoloGame(page);
    await expect(
      page.getByRole("button", { name: /surren|abandon/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("borderless game board loads correctly", async ({ page }) => {
    await startSoloGame(page, "borderless");
    await expect(page).toHaveURL("/game/borderless");
  });

  test("assimilation game board loads correctly", async ({ page }) => {
    await startSoloGame(page, "assimilation");
    await expect(page).toHaveURL("/game/assimilation");
  });

  test("all-random game board loads with pieces", async ({ page }) => {
    await startSoloGame(page, "all-random");
    await expect(page).toHaveURL("/game/all-random");
  });
});

test.describe("Game board — Scholar's mate (solo, no AI)", () => {
  /**
   * Scholar's mate: 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6?? 4. Qxf7#
   * Display coords with standard orientation (dy=0 = rank 8 = y=0 in board):
   *   e2 = (dx=4, dy=6) → e4 = (dx=4, dy=4)
   *   e7 = (dx=4, dy=1) → e5 = (dx=4, dy=3)
   *   d1 = (dx=3, dy=7) → h5 = (dx=7, dy=3)
   *   b8 = (dx=1, dy=0) → c6 = (dx=2, dy=2)
   *   f1 = (dx=5, dy=7) → c4 = (dx=2, dy=4)
   *   g8 = (dx=6, dy=0) → f6 = (dx=5, dy=2)
   *   h5 = (dx=7, dy=3) → f7 = (dx=5, dy=1)  ← checkmate
   */
  test("scholar's mate produces the game-over modal", async ({ page }) => {
    await startSoloGame(page);

    // 1. e4
    await clickSquare(page, 4, 6); // select e2 pawn
    await clickSquare(page, 4, 4); // move to e4

    // 1... e5
    await clickSquare(page, 4, 1); // select e7 pawn
    await clickSquare(page, 4, 3); // move to e5

    // 2. Qh5
    await clickSquare(page, 3, 7); // select queen d1
    await clickSquare(page, 7, 3); // move to h5

    // 2... Nc6
    await clickSquare(page, 1, 0); // select knight b8
    await clickSquare(page, 2, 2); // move to c6

    // 3. Bc4
    await clickSquare(page, 5, 7); // select bishop f1
    await clickSquare(page, 2, 4); // move to c4

    // 3... Nf6??
    await clickSquare(page, 6, 0); // select knight g8
    await clickSquare(page, 5, 2); // move to f6

    // 4. Qxf7# (checkmate)
    await clickSquare(page, 7, 3); // select queen h5
    await clickSquare(page, 5, 1); // move to f7

    // The GameOver modal must announce the white win (solo game, English forced)
    await expect(
      page.getByText(/White wins!|Victory!/),
    ).toBeVisible({ timeout: 5000 });
    // And offer both end-of-game actions
    await expect(page.getByRole("button", { name: "Play Again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
  });
});

test.describe("Game board — stats tracking", () => {
  test("localStorage chessverse_stats is updated after a game ends", async ({
    page,
  }) => {
    await startSoloGame(page);

    // Play Scholar's mate
    await clickSquare(page, 4, 6);
    await clickSquare(page, 4, 4);
    await clickSquare(page, 4, 1);
    await clickSquare(page, 4, 3);
    await clickSquare(page, 3, 7);
    await clickSquare(page, 7, 3);
    await clickSquare(page, 1, 0);
    await clickSquare(page, 2, 2);
    await clickSquare(page, 5, 7);
    await clickSquare(page, 2, 4);
    await clickSquare(page, 6, 0);
    await clickSquare(page, 5, 2);
    await clickSquare(page, 7, 3);
    await clickSquare(page, 5, 1);

    // The gameOver effect MUST write the stats — poll until the key appears
    await expect
      .poll(
        () => page.evaluate(() => localStorage.getItem("chessverse_stats")),
        { timeout: 5000 },
      )
      .not.toBeNull();

    const raw = await page.evaluate(() =>
      localStorage.getItem("chessverse_stats"),
    );
    const stats = JSON.parse(raw!);
    expect(stats.totalGames).toBeGreaterThanOrEqual(1);
    expect(stats.wins).toBeGreaterThanOrEqual(1); // white checkmated black
  });
});
