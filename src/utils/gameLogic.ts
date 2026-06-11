import type { GameMode } from "../types/chess";
import { gameModes } from "./gameModes";

/**
 * Resolves the active GameMode from a route param and an optional P2P mode.
 *
 * - When `modeId === "p2p"` and a `p2pMode` is provided, the P2P-supplied mode
 *   takes precedence (the host decides the game mode for both players).
 * - Otherwise the mode is looked up by `modeId` in the global `gameModes` list,
 *   falling back to the first entry (classic) when the id is unknown/undefined.
 */
export function resolveGameMode(
  modeId: string | undefined,
  p2pMode: GameMode | null,
): GameMode {
  if (modeId === "p2p" && p2pMode) return p2pMode;
  return gameModes.find((m) => m.id === modeId) ?? gameModes[0];
}
