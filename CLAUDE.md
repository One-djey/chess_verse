# ChessVerse — Claude Context

## Stack

React 18 + TypeScript + Vite + Tailwind CSS. No backend. P2P via Trystero (WebRTC). AI via Stockfish (Web Worker in `/public/stockfish/`).

## Key paths

| What                 | Where                                                            |
| -------------------- | ---------------------------------------------------------------- |
| Routing              | `src/App.tsx`                                                    |
| Shared nav bar       | `src/components/NavBar.tsx`                                      |
| Home screen          | `src/components/ModeSelect.tsx`                                  |
| Local mode select    | `src/components/GameModes.tsx` + `GameModeSelect.tsx`            |
| P2P lobby            | `src/components/P2PLobby.tsx`                                    |
| Game (main logic)    | `src/components/Game.tsx`                                        |
| Game end modal       | `src/components/GameOver.tsx`                                    |
| Settings modal       | `src/components/GameSettings.tsx`                                |
| Feedback modal       | `src/components/FeedbackModal.tsx`                               |
| Chess board/pieces   | `src/utils/chess/board.ts`                                       |
| Chess move logic     | `src/utils/chess/moves.ts`                                       |
| Assimilation logic   | `src/utils/chess/assimilation.ts`                                |
| Chess barrel export  | `src/utils/chess.ts` (re-exports board, moves, and assimilation) |
| Game state hook      | `src/hooks/useChessGame.ts`                                      |
| P2P game hook        | `src/hooks/useP2PGame.ts`                                        |
| P2P context          | `src/context/P2PContext.tsx`                                     |
| Skin context         | `src/context/SkinContext.tsx`                                    |
| Piece image resolver | `src/utils/pieceImage.ts`                                        |
| AI service           | `src/services/ChessAI.ts`                                        |

## Routes

- `/` → ModeSelect (home)
- `/local` → GameModes (local mode lobby)
- `/p2p` → P2PLobby (host/guest P2P lobby)
- `/game/:modeId` → Game (`classic`, `borderless`, `all-random`, `assimilation`, or `p2p`)

## NavBar

`NavBar` is used on every page. Props:

- `breadcrumbs?: Crumb[]` — items after "ChessVerse"; last item is non-clickable (current page)
- `onSurrender?` — shows red Surrender button (only pass in active game)
- `gameSettings?` / `onGameSettingsChange?` — passes local-game settings to the Settings modal; when absent, modal shows language-only

Breadcrumb map:
| Page | Breadcrumbs |
|---|---|
| ModeSelect | _(none)_ |
| GameModes | `[Local]` |
| P2PLobby – mode select | `[Multiplayer]` |
| P2PLobby – invite/waiting | `[Multiplayer, Invite]` |
| Game (local) | `[Local, <mode title>]` |
| Game (P2P) | `[Multiplayer, <mode title>]` |

## Navigation rules

- "Main Menu" from a local game → `/local`
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

Defined in `src/components/GameModes.tsx` as `gameModes[]`. Each entry has `id`, `image`, `rules`. Titles/descriptions come from translations: `t('modes.<id>.title')`.

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
- `SkinContext` / `useSkin()` — global preference, persisted in localStorage `chessverse_skin`
- Skin picker in the Settings modal (always visible, visual cards with king/queen/knight preview)
- **To add a skin**: add images to `public/ressources/pieces/<id>/`, add entry to `SKINS` in `pieceImage.ts`, add `skins.<id>` key to all 8 locale files
- **P2P sync**: host embeds `hostSkin` in `color_assign`; guest sends `guest_ready { skin }` before navigating — both players see their own skin on their pieces and the opponent's skin on opponent pieces

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
- `chessverse_skin` — selected piece skin (`classic` | `fantasy`)
