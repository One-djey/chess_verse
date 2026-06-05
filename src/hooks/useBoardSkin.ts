import { useContext } from "react";
import {
  BoardSkinContext,
  type BoardSkinContextValue,
} from "../context/BoardSkinContext";

export function useBoardSkin(): BoardSkinContextValue {
  const ctx = useContext(BoardSkinContext);
  if (!ctx)
    throw new Error("useBoardSkin must be used inside BoardSkinProvider");
  return ctx;
}
