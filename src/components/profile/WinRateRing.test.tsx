// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import WinRateRing from "./WinRateRing";

// i18n: t() returns the raw key so assertions are locale-independent.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

afterEach(() => cleanup());

const CIRCUMFERENCE = 2 * Math.PI * 48; // r=48 per the component

const STROKES = {
  track: "#e5e7eb",
  empty: "#d1d5db",
  win: "#22c55e",
  draw: "#f59e0b",
  loss: "#ef4444",
};

function circlesByStroke(container: HTMLElement, stroke: string) {
  return Array.from(container.querySelectorAll("circle")).filter(
    (c) => c.getAttribute("stroke") === stroke,
  );
}

function dashOf(circle: Element) {
  const [dash] = circle.getAttribute("stroke-dasharray")!.split(" ").map(Number);
  const offset = Number(circle.getAttribute("stroke-dashoffset"));
  return { dash, offset };
}

describe("WinRateRing", () => {
  it("shows the win percentage in the centre (7W/2L/1D → 70%)", () => {
    render(<WinRateRing wins={7} losses={2} draws={1} />);
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("profile.winRate")).toBeInTheDocument();
  });

  it("renders the legend with each count", () => {
    render(<WinRateRing wins={7} losses={2} draws={1} />);
    expect(screen.getByText("profile.wins · 7")).toBeInTheDocument();
    expect(screen.getByText("profile.draws · 1")).toBeInTheDocument();
    expect(screen.getByText("profile.losses · 2")).toBeInTheDocument();
  });

  it("all-zero stats show 0% and the gray empty-state ring only", () => {
    const { container } = render(<WinRateRing wins={0} losses={0} draws={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    // Background track + empty ring, no colored segments
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(circlesByStroke(container, STROKES.empty)).toHaveLength(1);
    expect(circlesByStroke(container, STROKES.win)).toHaveLength(0);
    expect(circlesByStroke(container, STROKES.draw)).toHaveLength(0);
    expect(circlesByStroke(container, STROKES.loss)).toHaveLength(0);
  });

  it("renders one segment per nonzero category with correct arc math", () => {
    const { container } = render(<WinRateRing wins={7} losses={2} draws={1} />);

    const [win] = circlesByStroke(container, STROKES.win);
    const [draw] = circlesByStroke(container, STROKES.draw);
    const [loss] = circlesByStroke(container, STROKES.loss);
    expect(win).toBeDefined();
    expect(draw).toBeDefined();
    expect(loss).toBeDefined();

    // Wins: 70% of the circumference, starting at offset 0
    expect(dashOf(win).dash).toBeCloseTo(0.7 * CIRCUMFERENCE, 1);
    expect(dashOf(win).offset).toBeCloseTo(0, 1);
    // Draws: 10%, rotated past the win arc
    expect(dashOf(draw).dash).toBeCloseTo(0.1 * CIRCUMFERENCE, 1);
    expect(dashOf(draw).offset).toBeCloseTo(-0.7 * CIRCUMFERENCE, 1);
    // Losses: 20%, rotated past wins + draws
    expect(dashOf(loss).dash).toBeCloseTo(0.2 * CIRCUMFERENCE, 1);
    expect(dashOf(loss).offset).toBeCloseTo(-0.8 * CIRCUMFERENCE, 1);
  });

  it("omits segments for zero categories (wins only → single green arc)", () => {
    const { container } = render(<WinRateRing wins={5} losses={0} draws={0} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(circlesByStroke(container, STROKES.win)).toHaveLength(1);
    expect(circlesByStroke(container, STROKES.draw)).toHaveLength(0);
    expect(circlesByStroke(container, STROKES.loss)).toHaveLength(0);
    expect(circlesByStroke(container, STROKES.empty)).toHaveLength(0);
    expect(dashOf(circlesByStroke(container, STROKES.win)[0]).dash).toBeCloseTo(
      CIRCUMFERENCE,
      1,
    );
  });

  it("rounds the percentage (1W/2L → 33%) and excludes draws from wins (0W/4D → 0%)", () => {
    render(<WinRateRing wins={1} losses={2} draws={0} />);
    expect(screen.getByText("33%")).toBeInTheDocument();
    cleanup();
    render(<WinRateRing wins={0} losses={0} draws={4} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
