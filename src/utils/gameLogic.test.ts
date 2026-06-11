import { describe, it, expect } from "vitest";
import { resolveGameMode } from "./gameLogic";
import { gameModes } from "./gameModes";
import type { GameMode } from "../types/chess";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mode(id: string): GameMode {
  return { id, title: id, description: "", image: "" };
}

const CLASSIC_MODE = gameModes.find((m) => m.id === "classic")!;
const BORDERLESS_MODE = gameModes.find((m) => m.id === "borderless")!;
const ASSIMILATION_MODE = gameModes.find((m) => m.id === "assimilation")!;

// ---------------------------------------------------------------------------
// resolveGameMode
// ---------------------------------------------------------------------------

describe("resolveGameMode — nominal cases", () => {
  it('resolves "classic" modeId to the classic game mode', () => {
    const result = resolveGameMode("classic", null);
    expect(result.id).toBe("classic");
    expect(result).toBe(CLASSIC_MODE);
  });

  it('resolves "borderless" modeId to the borderless game mode', () => {
    const result = resolveGameMode("borderless", null);
    expect(result.id).toBe("borderless");
    expect(result).toBe(BORDERLESS_MODE);
  });

  it('resolves "assimilation" modeId to the assimilation game mode', () => {
    const result = resolveGameMode("assimilation", null);
    expect(result.id).toBe("assimilation");
    expect(result).toBe(ASSIMILATION_MODE);
  });

  it('returns the p2pMode when modeId is "p2p" and p2pMode is provided', () => {
    const p2pMode = mode("borderless");
    const result = resolveGameMode("p2p", p2pMode);
    expect(result).toBe(p2pMode);
    expect(result.id).toBe("borderless");
  });

  it('ignores p2pMode when modeId is not "p2p"', () => {
    const p2pMode = mode("assimilation");
    const result = resolveGameMode("classic", p2pMode);
    expect(result.id).toBe("classic");
    expect(result).not.toBe(p2pMode);
  });
});

describe("resolveGameMode — edge cases", () => {
  it('falls back to gameModes[0] (classic) for an unknown modeId', () => {
    const result = resolveGameMode("non-existent-mode", null);
    expect(result).toBe(gameModes[0]);
    expect(result.id).toBe("classic");
  });

  it('falls back to gameModes[0] (classic) for undefined modeId', () => {
    const result = resolveGameMode(undefined, null);
    expect(result).toBe(gameModes[0]);
    expect(result.id).toBe("classic");
  });

  it('falls back to gameModes[0] when modeId is "p2p" but p2pMode is null', () => {
    // When arriving at Game before P2P context is ready, p2pMode can be null
    const result = resolveGameMode("p2p", null);
    expect(result).toBe(gameModes[0]);
    expect(result.id).toBe("classic");
  });

  it('falls back to gameModes[0] for an empty-string modeId', () => {
    const result = resolveGameMode("", null);
    expect(result).toBe(gameModes[0]);
    expect(result.id).toBe("classic");
  });

  it("preserves the full GameMode object including rules from p2pMode", () => {
    const p2pMode: GameMode = {
      id: "all-random",
      title: "All Random",
      description: "Random placement",
      image: "/img.webp",
      rules: { randomPieces: true },
    };
    const result = resolveGameMode("p2p", p2pMode);
    expect(result.rules?.randomPieces).toBe(true);
  });
});
