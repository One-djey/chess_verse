// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { SkinProvider } from "./SkinContext";
import { useSkin } from "../hooks/useSkin";

const STORAGE_KEY = "chessverse_skin";

/** Rend useSkin() à l'intérieur d'un SkinProvider frais. */
function renderSkin() {
  return renderHook(() => useSkin(), { wrapper: SkinProvider });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("SkinProvider — initial value", () => {
  it('defaults to "classic" when localStorage is empty', () => {
    const { result } = renderSkin();
    expect(result.current.skin).toBe("classic");
  });

  it("reads the persisted skin from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY, "fantasy");
    const { result } = renderSkin();
    expect(result.current.skin).toBe("fantasy");
  });

  it("does not write to localStorage just by mounting", () => {
    renderSkin();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // NOTE: locks current behavior of BUG-006 (docs/KNOWN_ISSUES.md) — the
  // provider does NOT validate the stored string against known skins, so an
  // arbitrary value is exposed as-is (and produces 404 piece images).
  // If BUG-006 is fixed to fall back to "classic", update this test.
  it("exposes an unknown stored value as-is (BUG-006)", () => {
    localStorage.setItem(STORAGE_KEY, "hacker");
    const { result } = renderSkin();
    expect(result.current.skin).toBe("hacker");
  });

  // NOTE: companion case of BUG-006 — the `?? DEFAULT_SKIN` fallback only
  // catches null/undefined, so an empty string stored in localStorage is
  // returned verbatim instead of falling back to "classic".
  it("exposes an empty-string stored value as-is (BUG-006)", () => {
    localStorage.setItem(STORAGE_KEY, "");
    const { result } = renderSkin();
    expect(result.current.skin).toBe("");
  });
});

describe("setSkin", () => {
  it("updates the exposed skin value", () => {
    const { result } = renderSkin();
    act(() => {
      result.current.setSkin("fantasy");
    });
    expect(result.current.skin).toBe("fantasy");
  });

  it("persists the new skin to localStorage", () => {
    const { result } = renderSkin();
    act(() => {
      result.current.setSkin("fantasy");
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("fantasy");
  });

  it("a remount after setSkin restores the persisted skin", () => {
    const first = renderSkin();
    act(() => {
      first.result.current.setSkin("fantasy");
    });
    first.unmount();

    const second = renderSkin();
    expect(second.result.current.skin).toBe("fantasy");
  });
});

describe("useSkin outside provider", () => {
  it("throws an explicit error", () => {
    // React logge l'erreur de rendu sur console.error — on la silencie.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useSkin())).toThrow(
        "useSkin must be used inside SkinProvider",
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
