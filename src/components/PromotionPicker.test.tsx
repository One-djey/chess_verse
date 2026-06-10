// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromotionPicker } from "./PromotionPicker";
import { SkinContext } from "../context/SkinContext";

// i18n: t() returns the raw key so assertions are locale-independent.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

afterEach(() => cleanup());

describe("PromotionPicker", () => {
  it("renders the prompt and the 4 promotion options in order", () => {
    render(<PromotionPicker color="white" onSelect={vi.fn()} />);
    expect(screen.getByText("promotion.choosePiece")).toBeInTheDocument();
    const alts = screen.getAllByRole("img").map((img) => img.getAttribute("alt"));
    expect(alts).toEqual(["queen", "rook", "bishop", "knight"]);
  });

  it("each option button carries the translated piece name as title", () => {
    render(<PromotionPicker color="white" onSelect={vi.fn()} />);
    for (const type of ["queen", "rook", "bishop", "knight"]) {
      expect(screen.getByTitle(`profile.pieces.${type}`)).toBeInTheDocument();
    }
  });

  it("calls onSelect with the clicked piece type", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PromotionPicker color="white" onSelect={onSelect} />);
    await user.click(screen.getByTitle("profile.pieces.knight"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("knight");
  });

  it("calls onSelect with 'queen' when the queen is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PromotionPicker color="black" onSelect={onSelect} />);
    await user.click(screen.getByTitle("profile.pieces.queen"));
    expect(onSelect).toHaveBeenCalledWith("queen");
  });

  it("uses white classic images by default (no SkinContext)", () => {
    render(<PromotionPicker color="white" onSelect={vi.fn()} />);
    expect(screen.getByAltText("queen")).toHaveAttribute(
      "src",
      "/ressources/pieces/classic/white_queen.png",
    );
    expect(screen.getByAltText("knight")).toHaveAttribute(
      "src",
      "/ressources/pieces/classic/white_knight.png",
    );
  });

  it("uses black images for the black color", () => {
    render(<PromotionPicker color="black" onSelect={vi.fn()} />);
    expect(screen.getByAltText("rook")).toHaveAttribute(
      "src",
      "/ressources/pieces/classic/black_rook.png",
    );
  });

  it("resolves the skin from SkinContext (fantasy → .webp path)", () => {
    render(
      <SkinContext.Provider value={{ skin: "fantasy", setSkin: vi.fn() }}>
        <PromotionPicker color="black" onSelect={vi.fn()} />
      </SkinContext.Provider>,
    );
    expect(screen.getByAltText("queen")).toHaveAttribute(
      "src",
      "/ressources/pieces/fantasy/black_queen.webp",
    );
  });
});
