import { createContext, useState, type ReactNode } from "react";
import { type BoardSkin } from "../utils/boardSkin";

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
      const saved = localStorage.getItem(STORAGE_KEY);
      return (saved as BoardSkin) ?? DEFAULT_SKIN;
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
