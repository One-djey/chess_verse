import { describe, it, expect } from "vitest";
import { SUPPORTED_LANGUAGES } from "./index";

import en from "./locales/en.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import it_ from "./locales/it.json";
import ar from "./locales/ar.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import ko from "./locales/ko.json";

const LOCALES: Record<string, unknown> = {
  en,
  fr,
  es,
  it: it_,
  ar,
  ja,
  zh,
  ko,
};

const OTHER_LOCALES = Object.keys(LOCALES).filter((c) => c !== "en");

/**
 * Known parity gaps, locked so this suite passes today while still catching
 * future regressions. As of 2026-06 all 8 locales are in full parity with
 * en.json (426 keys each), so every list is empty. If a gap is ever
 * intentionally accepted, add the dot-path key under the locale code here
 * with a comment explaining why.
 */
const KNOWN_MISSING_KEYS: Record<string, readonly string[]> = {
  fr: [],
  es: [],
  it: [],
  ar: [],
  ja: [],
  zh: [],
  ko: [],
};

/**
 * Aplati un objet JSON imbriqué en chemins pointés -> valeur feuille.
 * Les tableaux sont aplatis par index (`gameSettings.difficultyLevels.0`)
 * pour que les écarts de longueur soient aussi détectés.
 */
function flattenKeys(
  node: unknown,
  prefix = "",
  out: Map<string, unknown> = new Map(),
): Map<string, unknown> {
  if (Array.isArray(node)) {
    node.forEach((value, i) => {
      flattenKeys(value, prefix ? `${prefix}.${i}` : String(i), out);
    });
  } else if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      flattenKeys(value, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, node);
  }
  return out;
}

const EN_KEYS = [...flattenKeys(en).keys()];
const EN_KEY_SET = new Set(EN_KEYS);

describe("locale key parity with en.json", () => {
  it.each(OTHER_LOCALES)(
    "%s.json contains every key of en.json (minus documented exceptions)",
    (code) => {
      const localeKeys = new Set(flattenKeys(LOCALES[code]).keys());
      const knownMissing = new Set(KNOWN_MISSING_KEYS[code] ?? []);
      const missing = EN_KEYS.filter(
        (key) => !localeKeys.has(key) && !knownMissing.has(key),
      );
      expect(
        missing,
        `Keys present in en.json but missing from ${code}.json:\n  ${missing.join("\n  ")}`,
      ).toEqual([]);
    },
  );

  it.each(OTHER_LOCALES)(
    "%s.json has no extra keys absent from en.json",
    (code) => {
      const localeKeys = [...flattenKeys(LOCALES[code]).keys()];
      const extra = localeKeys.filter((key) => !EN_KEY_SET.has(key));
      expect(
        extra,
        `Keys present in ${code}.json but absent from en.json:\n  ${extra.join("\n  ")}`,
      ).toEqual([]);
    },
  );

  it("KNOWN_MISSING_KEYS only documents keys that actually exist in en.json", () => {
    // Garde-fou contre une constante d'exceptions périmée.
    const stale = Object.entries(KNOWN_MISSING_KEYS).flatMap(([code, keys]) =>
      keys.filter((key) => !EN_KEY_SET.has(key)).map((key) => `${code}: ${key}`),
    );
    expect(stale).toEqual([]);
  });
});

describe("SUPPORTED_LANGUAGES", () => {
  it("matches exactly the set of locale files", () => {
    // Liste réelle des fichiers src/i18n/locales/*.json (résolue par Vite).
    const localeFiles = Object.keys(import.meta.glob("./locales/*.json"))
      .map((path) => /([a-zA-Z-]+)\.json$/.exec(path)?.[1] ?? path)
      .sort();
    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(localeFiles);
  });

  it("contains the 8 expected language codes", () => {
    expect([...SUPPORTED_LANGUAGES].sort()).toEqual([
      "ar",
      "en",
      "es",
      "fr",
      "it",
      "ja",
      "ko",
      "zh",
    ]);
  });

  it("every locale provides a label for every supported language (languages.*)", () => {
    // Règle du CLAUDE.md : ajouter `languages.<code>` dans chaque locale.
    const failures: string[] = [];
    for (const [code, json] of Object.entries(LOCALES)) {
      const keys = flattenKeys(json);
      for (const lang of SUPPORTED_LANGUAGES) {
        if (!keys.has(`languages.${lang}`)) {
          failures.push(`${code}.json is missing languages.${lang}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("en.json content sanity", () => {
  it("has no empty-string values", () => {
    const empty = [...flattenKeys(en).entries()]
      .filter(([, value]) => typeof value === "string" && value.trim() === "")
      .map(([key]) => key);
    expect(empty, `Empty values in en.json: ${empty.join(", ")}`).toEqual([]);
  });

  it("only contains string leaf values", () => {
    const nonString = [...flattenKeys(en).entries()]
      .filter(([, value]) => typeof value !== "string")
      .map(([key]) => key);
    expect(nonString).toEqual([]);
  });
});
