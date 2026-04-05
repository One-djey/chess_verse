# ChessVerse — Claude Context

## Stack
React 18 + TypeScript + Vite + Tailwind CSS. No backend. P2P via Trystero (WebRTC). AI via Stockfish (Web Worker in `/public/stockfish/`).

## Key paths
| What | Where |
|---|---|
| Routing | `src/App.tsx` |
| Shared nav bar | `src/components/NavBar.tsx` |
| Home screen | `src/components/ModeSelect.tsx` |
| Local mode select | `src/components/GameModes.tsx` + `GameModeSelect.tsx` |
| P2P lobby | `src/components/P2PLobby.tsx` |
| Game (main logic) | `src/components/Game.tsx` |
| Game end modal | `src/components/GameOver.tsx` |
| Settings modal | `src/components/GameSettings.tsx` |
| Chess rules/utils | `src/utils/chess.ts` |
| P2P context | `src/context/P2PContext.tsx` |
| AI service | `src/services/ChessAI.ts` |

## Routes
- `/` → ModeSelect (home)
- `/local` → GameModes (local mode lobby)
- `/p2p` → P2PLobby (host/guest P2P lobby)
- `/game/:modeId` → Game (`classic`, `borderless`, `all-random`, or `p2p`)

## NavBar
`NavBar` is used on every page. Props:
- `breadcrumbs?: Crumb[]` — items after "ChessVerse"; last item is non-clickable (current page)
- `onSurrender?` — shows red Surrender button (only pass in active game)
- `gameSettings?` / `onGameSettingsChange?` — passes local-game settings to the Settings modal; when absent, modal shows language-only

Breadcrumb map:
| Page | Breadcrumbs |
|---|---|
| ModeSelect | *(none)* |
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

## i18n
- Library: `react-i18next` + `i18next-browser-languagedetector`
- Config: `src/i18n/index.ts`
- Translations: `src/i18n/locales/{en,fr,es,it,ar,ja,zh,ko}.json`
- Language auto-detected from browser, stored in `localStorage` key `chessverse_language`
- Selector in the Settings modal (accessible everywhere via NavBar gear icon)
- **To add a language**: create `src/i18n/locales/<code>.json`, add the code to `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`, register it in `resources`, add its label to `languages.<code>` in every locale file.
- Arabic (`ar`) translations are present but RTL CSS layout is not yet applied.

## Game modes
Defined in `src/components/GameModes.tsx` as `gameModes[]`. Each has `id`, `image`, `rules`. Titles/descriptions come from translations: `t('modes.<id>.title')`.

## P2P protocol
Host generates room, validates all moves, sends `sync_state` + `color_assign` to guest. Message types in `src/types/p2p.ts`.

## Local storage keys
- `chess_settings` — AI difficulty, flip board toggle
- `chessverse_language` — UI language
