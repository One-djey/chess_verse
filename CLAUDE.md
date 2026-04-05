# ChessVerse — Claude Context

## Stack
React 18 + TypeScript + Vite + Tailwind CSS. No backend. P2P via Trystero (WebRTC). AI via Stockfish (Web Worker in `/public/stockfish/`).

## Key paths
| What | Where |
|---|---|
| Routing | `src/App.tsx` |
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

## Navigation rules
- "Main Menu" from a local game → `/local`
- "Main Menu" from a P2P game → `/p2p`
- Controlled by `returnPath` prop on `GameOver` and `resolveReturnPath` in `Game.tsx`

## i18n
- Library: `react-i18next` + `i18next-browser-languagedetector`
- Config: `src/i18n/index.ts`
- Translations: `src/i18n/locales/{en,fr,es,ja,zh,ko}.json`
- Language auto-detected from browser, stored in `localStorage` key `chessverse_language`
- Selector available on ModeSelect (home) and in GameSettings modal
- **To add a language**: add a JSON file in `src/i18n/locales/`, add the code to `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`, register it in `resources`, and add its label to the `languages` key in every locale file.

## Game modes
Defined in `src/components/GameModes.tsx` as `gameModes[]`. Each has `id`, `image`, `rules`. Titles/descriptions are translated via `t('modes.<id>.title')`.

## P2P protocol
Host generates room, validates all moves, sends `sync_state` + `color_assign` to guest. Message types in `src/types/p2p.ts`.

## Local storage keys
- `chess_settings` — AI difficulty, flip board toggle
- `chessverse_language` — UI language
