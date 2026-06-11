import { describe, it, expect } from "vitest";
import {
  ASSISTANCE_OPTIONS,
  isAnyAssistanceActive,
  type LocalSettings,
} from "./useChessGame";

const BASE_SETTINGS: LocalSettings = {
  aiEnabled: true,
  aiDifficulty: 5,
  flipBoard: false,
  showDangerIndicator: false,
  showHint: false,
  showMoveAnnotations: false,
};

describe("isAnyAssistanceActive", () => {
  it("returns false when all assistance options are off", () => {
    expect(isAnyAssistanceActive(BASE_SETTINGS)).toBe(false);
  });

  it.each(ASSISTANCE_OPTIONS)(
    "returns true when '%s' is the only option enabled",
    (option) => {
      expect(isAnyAssistanceActive({ ...BASE_SETTINGS, [option]: true })).toBe(
        true,
      );
    },
  );

  it("returns true when multiple assistance options are enabled", () => {
    const all = ASSISTANCE_OPTIONS.reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      BASE_SETTINGS,
    );
    expect(isAnyAssistanceActive(all)).toBe(true);
  });
});
