import React, { createContext, useContext, useState } from "react";
import { PieceSkin } from "../utils/pieceImage";

const STORAGE_KEY = "chessverse_skin";
const DEFAULT_SKIN: PieceSkin = "classic";

interface SkinContextValue {
  skin: PieceSkin;
  setSkin: (skin: PieceSkin) => void;
}

const SkinContext = createContext<SkinContextValue | null>(null);

export function SkinProvider({ children }: { children: React.ReactNode }) {
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

export function useSkin(): SkinContextValue {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error("useSkin must be used inside SkinProvider");
  return ctx;
}
