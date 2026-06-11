// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ELOBadge from "./ELOBadge";

// i18n: t() returns the raw key so assertions are locale-independent.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

afterEach(() => cleanup());

describe("ELOBadge — icon and rank tiers", () => {
  // NOTE: the icon tiers (<4, <7, <11, <15, <18, <20) and the rank tiers from
  // getELORank (0, 1-3, 4-6, 7-10, 11-14, 15-17, 18-19, 20) are two separate
  // tables that happen to align at these boundaries.
  it.each([
    [0, "♟", "profile.ranks.beginner"],
    [3, "🛡", "profile.ranks.novice"],
    [4, "⚔️", "profile.ranks.apprentice"],
    [6, "⚔️", "profile.ranks.apprentice"],
    [7, "🐴", "profile.ranks.knight"],
    [10, "🐴", "profile.ranks.knight"],
    [11, "🗼", "profile.ranks.strategist"],
    [14, "🗼", "profile.ranks.strategist"],
    [15, "👑", "profile.ranks.master"],
    [17, "👑", "profile.ranks.master"],
    [18, "🏆", "profile.ranks.grandmaster"],
    [19, "🏆", "profile.ranks.grandmaster"],
    [20, "⭐", "profile.ranks.legend"],
  ])("level %i shows icon %s and rank key %s", (level, icon, rankKey) => {
    render(<ELOBadge maxAILevelBeaten={level as number} />);
    expect(screen.getByText(icon as string)).toBeInTheDocument();
    expect(screen.getByText(rankKey as string)).toBeInTheDocument();
  });
});

describe("ELOBadge — level number and sub-label", () => {
  it("hides the level number and the AI fraction at level 0", () => {
    const { container } = render(<ELOBadge maxAILevelBeaten={0} />);
    expect(container.textContent).not.toContain("profile.level");
    expect(container.textContent).not.toContain("profile.ai");
    expect(screen.getByText("profile.eloRank")).toBeInTheDocument();
  });

  it("shows the level number and the AI x/20 fraction for level > 0", () => {
    render(<ELOBadge maxAILevelBeaten={5} />);
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "SPAN" && el.textContent === "profile.level5",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          (el.textContent ?? "").includes("profile.ai 5/20"),
      ),
    ).toBeInTheDocument();
  });
});

describe("ELOBadge — legend styling (level >= 20)", () => {
  it("applies the purple ring and shimmer overlay at level 20", () => {
    const { container } = render(<ELOBadge maxAILevelBeaten={20} />);
    expect(container.querySelector(".ring-purple-300")).not.toBeNull();
    expect(container.querySelector(".bg-gradient-to-br")).not.toBeNull();
  });

  it("does not apply legend styling at level 19", () => {
    const { container } = render(<ELOBadge maxAILevelBeaten={19} />);
    expect(container.querySelector(".ring-purple-300")).toBeNull();
    expect(container.querySelector(".bg-gradient-to-br")).toBeNull();
  });
});
