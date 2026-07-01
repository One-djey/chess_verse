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
  it("defaults to null when localStorage is empty (BUG-016 fixed)", () => {
    const { result } = renderSkin();
    expect(result.current.skin).toBeNull();
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

  it("falls back to 'classic' when an unknown skin is stored (BUG-006 fixed)", () => {
    localStorage.setItem(STORAGE_KEY, "hacker");
    const { result } = renderSkin();
    expect(result.current.skin).toBe("classic");
  });

  it("falls back to 'classic' when an empty string is stored (BUG-006 fixed)", () => {
    localStorage.setItem(STORAGE_KEY, "");
    const { result } = renderSkin();
    expect(result.current.skin).toBe("classic");
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
