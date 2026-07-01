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

/**
 * Resolves the piece skin that should actually be rendered.
 *
 * `skin === null` means no explicit user preference has been saved yet —
 * defers to the mode's forced skin if any, else "classic". An explicit
 * "classic" choice is an accessibility override and always wins.
 */
export function resolveEffectivePieceSkin(
  skin: PieceSkin | null,
  forcedSkin?: PieceSkin,
): PieceSkin {
  if (skin === null) return forcedSkin ?? "classic";
  if (forcedSkin && skin !== "classic") return forcedSkin;
  return skin;
}
