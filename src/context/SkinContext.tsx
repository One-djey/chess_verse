import { createContext, useState, type ReactNode } from "react";
import { PieceSkin } from "../utils/pieceImage";

const STORAGE_KEY = "chessverse_skin";
const DEFAULT_SKIN: PieceSkin = "classic";

export interface SkinContextValue {
  skin: PieceSkin;
  setSkin: (skin: PieceSkin) => void;
}

export const SkinContext = createContext<SkinContextValue | null>(null);

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<PieceSkin>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return (saved as PieceSkin) ?? DEFAULT_SKIN;
    } catch {
      return DEFAULT_SKIN;
    }
  });

  const setSkin = (next: PieceSkin) => {
    setSkinState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <SkinContext.Provider value={{ skin, setSkin }}>
      {children}
    </SkinContext.Provider>
  );
}
