import { describe, it, expect } from "vitest";
import {
  BOARD_SKINS,
  getBoardSkinDef,
  resolveEffectiveBoardSkin,
} from "./boardSkin";

describe("getBoardSkinDef", () => {
  it("returns the matching skin definition", () => {
    expect(getBoardSkinDef("royal-arena").id).toBe("royal-arena");
  });

  it("falls back to the first entry for an unknown id", () => {
    expect(getBoardSkinDef("unknown" as never)).toBe(BOARD_SKINS[0]);
  });
});

describe("resolveEffectiveBoardSkin (BUG-016)", () => {
  it("falls back to default when unset and no forced skin", () => {
    expect(resolveEffectiveBoardSkin(null, undefined)).toBe("default");
  });

  it("applies the mode's forced board skin for a brand-new visitor (unset preference)", () => {
    expect(resolveEffectiveBoardSkin(null, "apocalypse")).toBe("apocalypse");
  });

  it("lets an explicit 'default' choice override the forced skin (accessibility)", () => {
    expect(resolveEffectiveBoardSkin("default", "apocalypse")).toBe("default");
  });

  it("applies the forced skin over any other explicit user choice", () => {
    expect(resolveEffectiveBoardSkin("nexus", "apocalypse")).toBe(
      "apocalypse",
    );
  });

  it("keeps the explicit user choice when the mode has no forced skin", () => {
    expect(resolveEffectiveBoardSkin("nexus", undefined)).toBe("nexus");
  });
});
