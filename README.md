# ChessVerse

## Description
A **React-based chess game** featuring multiple **unique game modes** inspired by various gaming cultures. Each mode introduces new rules, mechanics, or strategic twists on the classic game.

This application is **100% frontend** — no backend, no database, no account required.

## Play the Game
Play directly in your browser:
[**chess.jeremy-maisse.com**](https://chess.jeremy-maisse.com)
No installation needed — just open the link and start playing!

## Features
- **Multiple game modes** — Classic, Borderless, All Random, Assimilation.
- **Solo & vs AI** — Play both sides yourself or face Stockfish at 10 difficulty levels (Beginner to Superhuman).
- **P2P multiplayer** — Challenge a friend remotely via a shareable link, with no server involved (WebRTC).
- **Classic chess rules** — Castling, en passant, pawn promotion, check detection, stalemate.
- **Visual indicators** — Highlighted valid moves, selected piece, king in check (orange), assimilated pieces (green glow).
- **Assimilation mode** — Pieces permanently acquire the movement abilities of pieces they capture; accumulated abilities visualised via hover tooltip.
- **Multilingual UI** — English, French, Spanish, Italian, Arabic, Japanese, Chinese, Korean.
- **Installable as a PWA** — Add to home screen for quick access.
- **Endgame statistics** — Match duration, move count, AI level, rematch option.

## Game Modes
| Mode | Description |
|---|---|
| **Classic** | Standard chess with all classic rules. |
| **Borderless** | Pieces can cross board edges and reappear on the other side. |
| **All Random** | Pieces are placed randomly at game start. |
| **Assimilation** | A piece that captures another permanently acquires its movement abilities (cumulative). |

## Installation
To run the game locally:

1. **Clone the project**
   ```sh
   git clone https://github.com/One-djey/chess_verse.git
   ```
2. **Navigate to the project folder**
   ```sh
   cd chess_verse
   ```
3. **Install dependencies**
   ```sh
   npm install
   ```
4. **Start the development server**
   ```sh
   npm run dev
   ```

## Technologies Used
- **React 18** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool and dev server
- **Tailwind CSS** — Styling
- **Stockfish** — Chess AI engine (WebAssembly Web Worker)
- **Trystero** — P2P connection via WebRTC (no signalling server)
- **react-i18next** — Internationalisation

## Contribution
Contributions to enhance the game are welcome!

### Adding a New Game Mode
1. **Fork the repository** and create a branch.
2. Add a `rules` flag to `GameMode` in `src/types/chess.ts`.
3. Register the mode in `src/components/GameModes.tsx` (`gameModes[]` array).
4. Implement movement or board logic in `src/utils/chess/moves.ts` (guard on `gameMode.rules`).
5. Add translations for the mode title and description in every `src/i18n/locales/*.json` file.
6. **Test thoroughly** — check that all other modes are unaffected.
7. **Submit a pull request** describing the mode and its gameplay changes.

## License
This project is licensed under the **MIT License**.
