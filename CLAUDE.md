# ChessVerse — Claude Context

## Stack

React 18 + TypeScript + Vite + Tailwind CSS. No backend. P2P via Trystero (WebRTC). AI via Stockfish (Web Worker in `/public/stockfish/`).

## Tests

- Runner: **Vitest 3** (`vitest.config.ts`, separate from `vite.config.ts`), default env `node`; component tests opt into jsdom via `// @vitest-environment jsdom` docblock.
- Commands: `npm run test` | `npm run test:watch` | `npm run test:coverage` (per-file coverage thresholds on P0 modules) | `npm run test:e2e` (Playwright — requires a `npm run build` first or uses cached `dist/`).
- Tests are colocated (`src/utils/chess/moves.test.ts` next to `moves.ts`). Shared fixtures in `src/test/helpers.ts` (`makePiece`, `makeState`, `CLASSIC`/`BORDERLESS`/`ALL_RANDOM`/`ASSIMILATION` modes). E2E specs in `e2e/` (`navigation.spec.ts`, `settings-persistence.spec.ts`, `game-board.spec.ts`).
- Full QA strategy & test-case catalog: `docs/TEST_STRATEGY.md`. Known bugs/debt registry (causes, locations, recommended fixes — read before fixing any listed bug): `docs/KNOWN_ISSUES.md`. CI: `.github/workflows/test.yml` (lint + unit tests + build + e2e in separate job).
- Other chess modules not listed below: `src/utils/chess/tactics.ts` (tactic detection), `src/utils/chess/coliseumMoves.ts` + `src/components/ColiseumGame.tsx` (coliseum mode), `src/utils/chess/coliseumAI.ts` (coliseum AI — minimax depth 2, see below), `src/utils/chess/legendaryPatterns.ts` (famous mate detection).

### Test policy — MANDATORY for every code change

- **Every change to `src/` ships its tests in the same commit.** New module → colocated `*.test.ts(x)` (nominal + expected errors + edge cases). Changed behavior → update the affected tests in the same commit. New user-facing flow → add/update an `e2e/` scenario. Full doctrine per change type: `docs/TEST_STRATEGY.md` §8.
- **Bug fix = red → green.** Write the failing test first. If the bug is listed in `docs/KNOWN_ISSUES.md`, follow its procedure (invert the `// NOTE:` test, update the entry's status).
- **Never "fix" a failing `// NOTE:` test by inverting it blindly** — these assert known-buggy behavior on purpose. Read `docs/KNOWN_ISSUES.md` first; the failure usually means you changed behavior that was deliberately locked.
- **Never lower coverage thresholds** in `vitest.config.ts` to make CI pass. New game-logic modules (`src/utils/chess/*`, services) must be **added** to the per-file thresholds.
- Definition of done: `npm run test` + `npm run lint` + `npm run build` green locally. CI blocks merges otherwise.

## Key paths

| What                 | Where                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Routing              | `src/App.tsx`                                                                                                |
| Shared nav bar       | `src/components/NavBar.tsx`                                                                                  |
| Home screen (mode select) | `src/components/ModeSelect.tsx` — merged Local/Multiplayer toggle + mode grid, see "Home screen" below  |
| Mode grid (shared)   | `src/components/GameModeSelect.tsx` (exports `ModeGrid`, reused by `ModeSelect.tsx` and the P2P host fallback) |
| P2P lobby            | `src/components/P2PLobby.tsx`                                                                                |
| Game (main logic)    | `src/components/Game.tsx`                                                                                    |
| Game end modal       | `src/components/GameOver.tsx`                                                                                |
| Settings modal       | `src/components/GameSettings.tsx`                                                                            |
| Feedback modal       | `src/components/FeedbackModal.tsx`                                                                           |
| Chess board/pieces   | `src/utils/chess/board.ts`                                                                                   |
| Chess move logic     | `src/utils/chess/moves.ts`                                                                                   |
| Assimilation logic   | `src/utils/chess/assimilation.ts`                                                                            |
| Chess barrel export  | `src/utils/chess.ts` (re-exports board, moves, assimilation, constants, aiFallback)                          |
| Chess constants      | `src/utils/chess/constants.ts` (`PIECE_VALUES` — standard material values)                                   |
| AI fallback logic    | `src/utils/chess/aiFallback.ts` (`getSmartFallbackMove` — priority chain when Stockfish plays illegal moves) |
| Game state hook      | `src/hooks/useChessGame.ts`                                                                                  |
| P2P game hook        | `src/hooks/useP2PGame.ts`                                                                                    |
| P2P context          | `src/context/P2PContext.tsx`                                                                                 |
| Skin context         | `src/context/SkinContext.tsx`                                                                                |
| Piece image resolver | `src/utils/pieceImage.ts`                                                                                    |
| AI service           | `src/services/ChessAI.ts`                                                                                    |
| Stats service        | `src/services/statsService.ts`                                                                               |
| Profile page         | `src/components/ProfilePage.tsx`                                                                             |
| Profile sub-comps    | `src/components/profile/` (ActivityHeatmap, ELOBadge, WinRateRing, PieceStats, ModeDistribution, BadgesGrid) |

## Routes

- `/` → ModeSelect (home — Local/Multiplayer toggle + mode grid, see "Home screen" below)
- `/p2p` → P2PLobby (host/guest P2P lobby; also reachable directly, e.g. via an invite link)
- `/game/:modeId` → Game (`classic`, `borderless`, `all-random`, `assimilation`, or `p2p`)
- `/profile` → ProfilePage (player stats, heatmap, badges)

## Home screen (`ModeSelect.tsx`)

The former two-step flow (choose Local vs Multiplayer, then choose a game mode) is merged into a single screen to minimize clicks before a new user can play:

- `useOnlineStatus()` (`src/hooks/useOnlineStatus.ts`, `navigator.onLine` + `online`/`offline` listeners) drives the header:
  - **Online**: a Local/Multiplayer segmented toggle (local `playTypeState`, always defaults to `"local"` on load — not persisted).
  - **Offline**: toggle is replaced by static text `t("modeSelect.offlineMode")`; `playType` is forced to `"local"` regardless of the last toggle state.
- Below the header, `ModeGrid` (exported from `GameModeSelect.tsx`) renders the mode cards directly — no extra navigation step.
- Selecting a mode:
  - `playType === "local"` → `navigate(\`/game/${mode.id}\`)`
  - `playType === "multiplayer"` → `navigate("/p2p", { state: { presetModeId: mode.id } })` — `P2PLobby` reads `location.state.presetModeId` and auto-creates the room (calling the same `handleCreateGame` used by its own fallback mode-selection screen), skipping a second "choose your game mode" step. If `/p2p` is opened directly (no preset, e.g. a bookmark), it falls back to rendering `GameModeSelect` (`playType="multiplayer"`) as before.

## NavBar

`NavBar` is used on every page. Props:

- `breadcrumbs?: Crumb[]` — items after "ChessVerse"; last item is non-clickable (current page)
- `onSurrender?` — shows red Surrender button (only pass in active game)
- `gameSettings?` / `onGameSettingsChange?` — passes local-game settings to the Settings modal; when absent, modal shows language-only

Breadcrumb map:
| Page | Breadcrumbs |
|---|---|
| ModeSelect (home) | _(none)_ |
| P2PLobby – mode select (fallback, no preset) | `[Multiplayer]` |
| P2PLobby – auto-starting from preset mode | _(none — loading state)_ |
| P2PLobby – invite/waiting | `[Multiplayer, Invite]` |
| Game (local) | `[Local, <mode title>]` |
| Game (P2P) | `[Multiplayer, <mode title>]` |
| ProfilePage | `[profile.title]` |

## Navigation rules

- "Main Menu" from a local game → `/` (home)
- "Main Menu" from a P2P game → `/p2p`
- Controlled by `returnPath` prop on `GameOver`, computed in `Game.tsx`
- In-game breadcrumb items have no `path` (non-clickable) to prevent accidental quit
- `ScrollToTop` component in `App.tsx` scrolls to top on every route change

## i18n

- Library: `react-i18next` + `i18next-browser-languagedetector`
- Config: `src/i18n/index.ts`
- Translations: `src/i18n/locales/{en,fr,es,it,ar,ja,zh,ko}.json`
- Language auto-detected from browser, stored in `localStorage` key `chessverse_language`
- Selector in the Settings modal (accessible everywhere via NavBar gear icon)
- **To add a language**: create `src/i18n/locales/<code>.json`, add the code to `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`, register it in `resources`, add its label to `languages.<code>` in every locale file.
- Arabic (`ar`) translations are present but RTL CSS layout is not yet applied.

## Game modes

Defined in `src/utils/gameModes.ts` as `gameModes[]`. Each entry has `id`, `image`, `rules`. Titles/descriptions come from translations: `t('modes.<id>.title')`.

| id             | Key rules                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `classic`      | Standard chess                                                                                            |
| `borderless`   | `rules.borderless: true` — pieces wrap around board edges                                                 |
| `all-random`   | `rules.randomPieces: true` — pieces placed randomly at start                                              |
| `assimilation` | `rules.assimilation: true` — capturing piece permanently acquires the captured piece's movement abilities |

### Assimilation mode details

- `Piece.acquiredTypes?: PieceType[]` stores accumulated movement types (separate from `piece.type`, which remains the visual identity).
- `getPieceCapabilities(piece)` — returns `[piece.type, ...piece.acquiredTypes]`; used in `isValidMove` to iterate over all capabilities.
- `applyAssimilationCapture(capturingPiece, capturedPiece)` — merges types, called in `applyMoveToState` after each capture.
- Pieces with `acquiredTypes` receive a **green glow** (`rgba(74,222,128,1)`) — priority: orange (check) > blue (selected) > green (assimilation) > blue (playable).
- Hovering a piece with `acquiredTypes` shows a **tooltip bubble** with icons of the acquired piece types.

## Piece skins

Defined in `src/utils/pieceImage.ts`. Convention: `public/ressources/pieces/{skin}/{color}_{type}.{ext}`.

| skin      | path              | ext     |
| --------- | ----------------- | ------- |
| `classic` | `pieces/classic/` | `.png`  |
| `fantasy` | `pieces/fantasy/` | `.webp` |

- `getPieceImageSrc(color, type, skin)` — resolves image path
- `SkinContext` / `useSkin()` — global preference, persisted in localStorage `chessverse_skin`; `null` until the user explicitly picks a skin (see "Forced skins per mode" below)
- Skin picker in the Settings modal (always visible, visual cards with king/queen/knight preview)
- **To add a skin**: add images to `public/ressources/pieces/<id>/`, add entry to `SKINS` in `pieceImage.ts`, add `skins.<id>` key to all 8 locale files
- **P2P sync**: host embeds `hostSkin` in `color_assign`; guest sends `guest_ready { skin }` before navigating — both players see their own skin on their pieces and the opponent's skin on opponent pieces

### Forced skins per mode

Modes with a strong visual identity declare `forcedSkins` in `gameModes.ts` (`{ pieces, board }`). Three rules apply:

1. **Picker restriction** (`GameSettings.tsx`) — when `forcedSkins` is set, the skin picker only shows `classic` + the mode's forced piece skin, and `default` + the mode's forced board skin. `gameMode` prop must be passed to `NavBar` → `GameSettings` for the restriction to apply.

2. **Picker checked state** — the highlighted card is the _effective_ skin, not the raw stored value. `checkedPieceSkin = forcedSkins && skin !== "classic" ? forcedSkins.pieces : skin`. `checkedBoardSkin = forcedSkins && boardSkin !== "default" ? forcedSkins.board : boardSkin`.

3. **Effective skin at render time** — `SkinContext`/`BoardSkinContext` expose `skin`/`boardSkin` as `PieceSkin | null` / `BoardSkin | null`: `null` means no explicit preference has ever been saved (nothing written to `localStorage` until the user picks a skin in `GameSettings`). The resolution `null` → mode's forced skin (or `classic`/`default` if none) → `classic`/`default` (pieces/board) as the user accessibility override, always wins, even under a forced-skin mode → any other explicit choice defers to the forced skin if one exists — is centralized in `resolveEffectivePieceSkin` (`src/utils/pieceImage.ts`) and `resolveEffectiveBoardSkin` (`src/utils/boardSkin.ts`); every call site imports these instead of re-implementing the ternary (BUG-016). Implemented via `BoardSkinContext.Provider` so `ChessBoard` (which reads the context) receives the correct value:
   - `ZombieHordeGame.tsx` / `ColiseumGame.tsx`: wrap tree in `<BoardSkinContext.Provider value={{ boardSkin: effectiveBoardSkin, setBoardSkin }}>` where `effectiveBoardSkin = resolveEffectiveBoardSkin(boardSkin, "<forced-board-skin>")`. Board style computed from `effectiveBoardSkin`, not the global context.
   - `Game.tsx` (borderless, etc.): same Provider pattern for board skin; piece skin computed as `effectiveSkin = resolveEffectivePieceSkin(skin, forcedPieceSkin)` and passed directly to `ChessBoard`.
   - `P2PLobby.tsx`: resolves the local nullable `skin` to a concrete value via `resolveEffectivePieceSkin` before sending it as `hostSkin`/`guestSkin` over the wire (`types/p2p.ts` keeps `PieceSkin` non-nullable; `null` there means "not yet received from peer", a different concept handled in `P2PContext.tsx`).

## Coliseum AI

Coliseum uses an irregular arena (variable-shape grid), making Stockfish (FEN-based, 8×8 only) and the standard fallback (`getSmartFallbackMove`, which uses `getValidMoves`/`isSquareUnderAttack`) inapplicable. The coliseum AI is **100 % local**, implemented in `src/utils/chess/coliseumAI.ts`.

**Algorithm:** Minimax depth 2 with alpha-beta pruning.

- Evaluation function: material balance (`Σ PIECE_VALUES[black] − Σ PIECE_VALUES[white]`).
- At depth 0 (leaf): return material score.
- Checkmate/stalemate detected via `isColiseumInCheck` + `getAllLegalMoves` length = 0: score ±100 000 / 0.
- Branching factor ~30–40 moves; alpha-beta reduces effective search to ~300–500 node evaluations → well under 1 ms.
- Reuses: `getColiseumLegalMoves`, `isColiseumInCheck`, `applyColiseumMove` from `coliseumMoves.ts`.

AI toggle lives in the `chess_settings` localStorage key (`aiEnabled`). The AI is triggered by a `useEffect` in `ColiseumGame.tsx` when `state.currentTurn === "black"` and `settings.aiEnabled`. There is no difficulty selector for Coliseum (single level).

## AI fallback system

Stockfish operates on standard chess rules and can suggest illegal moves in special modes (borderless, assimilation). When this happens — or when all Stockfish retries have failed — `getSmartFallbackMove` (in `aiFallback.ts`) is called.

**Priority chain — king in check:**

1. Non-king piece resolving check, safe (lowest piece value first)
2. Non-king piece resolving check, risky (lowest piece value first)
3. King move to a safe square
4. `null` → checkmate confirmed

**Priority chain — normal turn:**

1. Safe capture (highest captured value, then lowest mover value)
2. Safe move (lowest mover value)
3. Risky capture (highest captured value, then lowest mover value)
4. Risky move (lowest mover value)
5. `null` → stalemate confirmed

**"Safe"** = after the move, the moved piece is not under attack by any opponent piece (`isSquareUnderAttack`).
**Candidate scan is always exhaustive** — never short-circuited, because borderless/assimilation modes have far more legal moves than standard chess.

## P2P protocol

Host generates room, validates all moves, sends `sync_state` + `color_assign` (with `hostSkin`) to guest. Guest responds with `guest_ready` (with `guestSkin`) — host navigates only after receiving it. Message types in `src/types/p2p.ts`.

## Feedback

Accessible via a **Support section** at the bottom of the Settings modal (gear icon in NavBar, available on every page).

- "Send feedback" button in the Support section closes Settings and opens `FeedbackModal` (no modal stacking)
- `FeedbackModal` — category picker (Bug report / Feature request / General feedback) + free-text textarea
- On submit: clears inputs, closes modal, then calls `window.location.href` with a `mailto:contact@jeremy-maisse.com` pre-filled link
- No backend involved; opens the user's local email client
- `feedbackOpen` state lives in `GameSettings` outside the `isOpen` guard (component uses `{isOpen && ...}` conditional render instead of early return) so the feedback modal can outlive the settings modal
- A future "Buy me a coffee" link will be added to the same Support section

## Local storage keys

- `chess_settings` — AI difficulty, flip board toggle
- `chessverse_language` — UI language
- `chessverse_stats` — Player stats (see `ChessverseStats` in `statsService.ts`): game counts, win/loss/draw, ELO, heatmap, piece stats, streaks, badge counters. Recorded at the end of every game via `recordGame()` called in `Game.tsx`'s `gameOver` effect.
- `chessverse_skin` — selected piece skin (`classic` | `fantasy` | ...); absent/unset until the user explicitly picks one (see BUG-016)
- `chessverse_board_skin` — selected board skin (`default` | `royal-arena` | ...); absent/unset until the user explicitly picks one (see BUG-016)
