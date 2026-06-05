export type BoardSkin = "default" | "royal-arena";

export interface BoardSkinDef {
  id: BoardSkin;
  slabsCount?: number;
  lightSquare?: string;
  darkSquare?: string;
  border?: string;
  /** Inset between the border image and the playable grid — use % to scale with board size */
  borderInset?: string;
}

export function getSlabUrl(skin: BoardSkinDef, x: number, y: number): string {
  const idx = ((x * 7 + y * 13) % skin.slabsCount!) + 1;
  return `/ressources/board/${skin.id}/slab-${idx}.png`;
}

export const BOARD_SKINS: BoardSkinDef[] = [
  { id: "default" },
  {
    id: "royal-arena",
    slabsCount: 9,
    lightSquare: "/ressources/board/royal-arena/light_square.png",
    darkSquare: "/ressources/board/royal-arena/dark_square.png",
    border: "/ressources/board/royal-arena/border.png",
    borderInset: "4.9cqw",
  },
];

export function getBoardSkinDef(skin: BoardSkin): BoardSkinDef {
  return BOARD_SKINS.find((s) => s.id === skin) ?? BOARD_SKINS[0];
}
