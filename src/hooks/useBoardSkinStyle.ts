import type { CSSProperties } from "react";
import { useBoardSkin } from "./useBoardSkin";
import { getBoardSkinDef } from "../utils/boardSkin";

export function useBoardSkinStyle(): CSSProperties {
  const { boardSkin } = useBoardSkin();
  const def = getBoardSkinDef(boardSkin);
  if (!def.ground) return {};
  return {
    backgroundImage: `url(${def.ground})`,
    backgroundRepeat: "repeat",
    backgroundSize: "1000px 1000px",
  };
}
