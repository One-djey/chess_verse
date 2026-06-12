// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { BoardSkinProvider } from "./BoardSkinContext";
import { useBoardSkin } from "../hooks/useBoardSkin";

const STORAGE_KEY = "chessverse_board_skin";

/** Rend useBoardSkin() à l'intérieur d'un BoardSkinProvider frais. */
function renderBoardSkin() {
  return renderHook(() => useBoardSkin(), { wrapper: BoardSkinProvider });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("BoardSkinProvider — initial value", () => {
  it('defaults to "default" when localStorage is empty', () => {
    const { result } = renderBoardSkin();
    expect(result.current.boardSkin).toBe("default");
  });

  it("reads the persisted board skin from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY, "royal-arena");
    const { result } = renderBoardSkin();
    expect(result.current.boardSkin).toBe("royal-arena");
  });

  it("does not write to localStorage just by mounting", () => {
    renderBoardSkin();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to 'default' when an unknown skin is stored (BUG-014 fixed)", () => {
    localStorage.setItem(STORAGE_KEY, "lava-arena");
    const { result } = renderBoardSkin();
    expect(result.current.boardSkin).toBe("default");
  });

  it("falls back to 'default' when an empty string is stored (BUG-014 fixed)", () => {
    localStorage.setItem(STORAGE_KEY, "");
    const { result } = renderBoardSkin();
    expect(result.current.boardSkin).toBe("default");
  });
});

describe("setBoardSkin", () => {
  it("updates the exposed board skin value", () => {
    const { result } = renderBoardSkin();
    act(() => {
      result.current.setBoardSkin("royal-arena");
    });
    expect(result.current.boardSkin).toBe("royal-arena");
  });

  it("persists the new board skin to localStorage", () => {
    const { result } = renderBoardSkin();
    act(() => {
      result.current.setBoardSkin("royal-arena");
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("royal-arena");
  });

  it("a remount after setBoardSkin restores the persisted skin", () => {
    const first = renderBoardSkin();
    act(() => {
      first.result.current.setBoardSkin("royal-arena");
    });
    first.unmount();

    const second = renderBoardSkin();
    expect(second.result.current.boardSkin).toBe("royal-arena");
  });
});

describe("useBoardSkin outside provider", () => {
  it("throws an explicit error", () => {
    // React logge l'erreur de rendu sur console.error — on la silencie.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useBoardSkin())).toThrow(
        "useBoardSkin must be used inside BoardSkinProvider",
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
