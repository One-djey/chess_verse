export type PieceSkin = "classic" | "fantasy" | "zombie";

export const SKINS: { id: PieceSkin; label: string; ext: string }[] = [
  { id: "classic", label: "Classic", ext: "png" },
  { id: "fantasy", label: "Fantasy", ext: "webp" },
  { id: "zombie", label: "Zombie", ext: "png" },
];

export function getPieceImageSrc(
  color: string,
  type: string,
  skin: PieceSkin,
): string {
  const s = SKINS.find((sk) => sk.id === skin)!;
  return `/ressources/pieces/${skin}/${color}_${type}.${s.ext}`;
}
