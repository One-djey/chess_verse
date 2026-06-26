import { createContext, useState, type ReactNode } from "react";
import { BOARD_SKINS, type BoardSkin } from "../utils/boardSkin";

const STORAGE_KEY = "chessverse_board_skin";
const DEFAULT_SKIN: BoardSkin = "default";

export interface BoardSkinContextValue {
  boardSkin: BoardSkin;
  setBoardSkin: (skin: BoardSkin) => void;
}

export const BoardSkinContext = createContext<BoardSkinContextValue | null>(
  null,
);

export function BoardSkinProvider({ children }: { children: ReactNode }) {
  const [boardSkin, setBoardSkinState] = useState<BoardSkin>(() => {
    try {
      // Migrate legacy value from before the rename.
      if (localStorage.getItem(STORAGE_KEY) === "zombie") {
        localStorage.setItem(STORAGE_KEY, "apocalypse");
      }
      // BUG-014: validate against known skins — an arbitrary stored value
      // would silently break the board rendering.
      const saved = localStorage.getItem(STORAGE_KEY);
      return BOARD_SKINS.some((s) => s.id === saved)
        ? (saved as BoardSkin)
        : DEFAULT_SKIN;
    } catch {
      return DEFAULT_SKIN;
    }
  });

  const setBoardSkin = (next: BoardSkin) => {
    setBoardSkinState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <BoardSkinContext.Provider value={{ boardSkin, setBoardSkin }}>
      {children}
    </BoardSkinContext.Provider>
  );
}
