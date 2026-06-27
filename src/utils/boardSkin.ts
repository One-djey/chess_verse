export type BoardSkin =
  "default" | "royal-arena" | "apocalypse" | "spaceship" | "nexus" | "biome";

export interface BoardSkinDef {
  id: BoardSkin;
  slabsCount?: number;
  lightSquare?: string;
  darkSquare?: string;
  border?: string;
  /** Inset between the border image and the playable grid — use % to scale with board size */
  borderInset?: string;
  /** Tiled ground texture applied as background-image on the board container */
  ground?: string;
  /** Decorative camp image shown at the top (mobile) / right (desktop, rotated -90°) */
  campTop?: string;
  /** Decorative camp image shown at the bottom (mobile) / left (desktop, rotated 90°) */
  campBottom?: string;
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
    ground: "/ressources/board/royal-arena/ground.png",
    campTop: "/ressources/board/royal-arena/camp-top-right.png",
    campBottom: "/ressources/board/royal-arena/camp-bottom-left.png",
  },
  {
    id: "apocalypse",
    lightSquare: "/ressources/board/zombie/light_square.png",
    darkSquare: "/ressources/board/zombie/dark_square.png",
    border: "/ressources/board/zombie/border.png",
    borderInset: "10cqw",
    ground: "/ressources/board/zombie/ground.png",
  },
  {
    id: "spaceship",
    lightSquare: "/ressources/board/spaceship/light_square.png",
    darkSquare: "/ressources/board/spaceship/dark_square.png",
    border: "/ressources/board/spaceship/border.png",
    borderInset: "10cqw",
    ground: "/ressources/board/spaceship/ground.png",
  },
  {
    id: "nexus",
    lightSquare: "/ressources/board/nexus/light_square.png",
    darkSquare: "/ressources/board/nexus/dark_square.png",
    border: "/ressources/board/nexus/border.png",
    borderInset: "5.30cqw",
    ground: "/ressources/board/nexus/ground.png",
  },
  {
    id: "biome",
    lightSquare: "/ressources/board/biome/light_square.png",
    darkSquare: "/ressources/board/biome/dark_square.png",
    border: "/ressources/board/biome/border.png",
    borderInset: "7cqw",
    ground: "/ressources/board/biome/ground.png",
  },
];

export function getBoardSkinDef(skin: BoardSkin): BoardSkinDef {
  return BOARD_SKINS.find((s) => s.id === skin) ?? BOARD_SKINS[0];
}
