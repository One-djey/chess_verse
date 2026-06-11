import "@testing-library/jest-dom/vitest";

// Node.js ≥25 defines a native `localStorage` global (configurable getter, but
// all methods are absent without --localstorage-file). Vitest's populateGlobal
// skips it because it's not in the KEYS allowlist, so the Node.js stub wins over
// jsdom's full Storage implementation. Override it here with the jsdom instance
// that Vitest exposes as `globalThis.jsdom`.
const _jsdom = (
  globalThis as unknown as {
    jsdom?: { window: { localStorage: Storage; sessionStorage: Storage } };
  }
).jsdom;
if (_jsdom && typeof localStorage?.clear !== "function") {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, key, {
      value: _jsdom.window[key],
      writable: true,
      configurable: true,
    });
  }
}
