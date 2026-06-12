import { describe, it, expect } from "vitest";
import { gameModes } from "./gameModes";
import en from "../i18n/locales/en.json";

// Config sanity checks: a malformed mode entry breaks the mode-select screens
// silently. Locale parity across the other 7 languages is already guaranteed
// by src/i18n/locales.test.ts, so checking en.json covers them all.

describe("gameModes — definitions", () => {
  it("has unique, non-empty ids", () => {
    const ids = gameModes.map((m) => m.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every mode has a title, description, image under /ressources/modes/ and rules", () => {
    for (const mode of gameModes) {
      expect(mode.title.length).toBeGreaterThan(0);
      expect(mode.description.length).toBeGreaterThan(0);
      expect(mode.image).toMatch(/^\/ressources\/modes\/.+\.(webp|png|jpg)$/);
      expect(mode.rules).toBeTypeOf("object");
    }
  });

  it("every mode id has its title and description translated (en.json)", () => {
    const modes = (en as Record<string, unknown>).modes as Record<
      string,
      { title?: string; description?: string }
    >;
    for (const mode of gameModes) {
      expect(modes[mode.id]?.title, `modes.${mode.id}.title`).toBeTruthy();
      expect(
        modes[mode.id]?.description,
        `modes.${mode.id}.description`,
      ).toBeTruthy();
    }
  });
});
