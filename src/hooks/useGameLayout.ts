import { useEffect, useState } from "react";

export const SIDE_LAYOUT_THRESHOLD = 160; // px — minimum lateral margin to switch to side layout
export const MIN_OVERLAY_MARGIN = 80; // px — minimum top/bottom margin to keep overlays outside the board
const NAVBAR_HEIGHT_ESTIMATE = 56; // px

export type GameLayout = "side" | "top-bottom";

interface GameLayoutInfo {
  layout: GameLayout;
  sideMargin: number;
  /** When false, top/bottom space is too tight — overlays should render inside the board */
  overlayOutside: boolean;
}

function compute(width: number, height: number): GameLayoutInfo {
  const boardSize = Math.min(width, height - NAVBAR_HEIGHT_ESTIMATE);
  const sideMargin = Math.max(0, (width - boardSize) / 2);
  const topBottomMargin = Math.max(
    0,
    (height - NAVBAR_HEIGHT_ESTIMATE - boardSize) / 2,
  );
  return {
    layout: sideMargin >= SIDE_LAYOUT_THRESHOLD ? "side" : "top-bottom",
    sideMargin,
    overlayOutside: topBottomMargin >= MIN_OVERLAY_MARGIN,
  };
}

export function useGameLayout(): GameLayoutInfo {
  const [info, setInfo] = useState<GameLayoutInfo>(() =>
    compute(window.innerWidth, window.innerHeight),
  );

  useEffect(() => {
    const onResize = () =>
      setInfo(compute(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return info;
}
