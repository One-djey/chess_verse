import { useContext } from "react";
import { SkinContext } from "../context/SkinContext";
import type { SkinContextValue } from "../context/SkinContext";

export function useSkin(): SkinContextValue {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error("useSkin must be used inside SkinProvider");
  return ctx;
}
