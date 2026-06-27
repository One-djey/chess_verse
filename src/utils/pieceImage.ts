export type PieceSkin =
  "classic" | "fantasy" | "zombie" | "robot" | "legends" | "alien";

export const SKINS: { id: PieceSkin; label: string; ext: string }[] = [
  { id: "classic", label: "Classic", ext: "png" },
  { id: "fantasy", label: "Fantasy", ext: "webp" },
  { id: "zombie", label: "Zombie", ext: "png" },
  { id: "robot", label: "Robot", ext: "png" },
  { id: "legends", label: "Legends", ext: "png" },
  { id: "alien", label: "Alien", ext: "png" },
];

export function getPieceImageSrc(
  color: string,
  type: string,
  skin: PieceSkin,
): string {
  const s = SKINS.find((sk) => sk.id === skin)!;
  return `/ressources/pieces/${skin}/${color}_${type}.${s.ext}`;
}
