import { createContext, useState, type ReactNode } from "react";
import { PieceSkin, SKINS } from "../utils/pieceImage";

const STORAGE_KEY = "chessverse_skin";
const DEFAULT_SKIN: PieceSkin = "classic";

function isValidSkin(value: string | null): value is PieceSkin {
  return SKINS.some((s) => s.id === value);
}

export interface SkinContextValue {
  /** `null` = no explicit user preference yet — resolve via `resolveEffectivePieceSkin`. */
  skin: PieceSkin | null;
  setSkin: (skin: PieceSkin) => void;
}

export const SkinContext = createContext<SkinContextValue | null>(null);

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<PieceSkin | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) return null;
      return isValidSkin(saved) ? saved : DEFAULT_SKIN;
    } catch {
      return null;
    }
  });

  const setSkin = (next: PieceSkin) => {
    if (!isValidSkin(next)) return;
    setSkinState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <SkinContext.Provider value={{ skin, setSkin }}>
      {children}
    </SkinContext.Provider>
  );
}
