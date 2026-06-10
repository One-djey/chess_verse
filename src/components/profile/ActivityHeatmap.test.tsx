// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ActivityHeatmap from "./ActivityHeatmap";

// i18n: t() returns the raw key so assertions are locale-independent.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

// Freeze "today" so getHeatmapData (last 365 days) is deterministic:
// today = 2026-06-10 (local), range starts 2025-06-11 — a Wednesday (getDay 3),
// so the first week column is padded with 3 empty cells → 368 padded entries
// → 53 week columns (52 × 7 + one final column of 4).
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ACTIVITY = {
  "2026-06-10": 5, // > 3  → bg-emerald-600
  "2026-06-09": 1, // == 1 → bg-emerald-200
  "2026-06-08": 3, // <= 3 → bg-emerald-400
  "2026-06-07": 2, // <= 3 → bg-emerald-400
};

describe("ActivityHeatmap — structure", () => {
  it("renders the title, day labels and legend", () => {
    render(<ActivityHeatmap dailyActivity={{}} />);
    expect(screen.getByText("profile.activity")).toBeInTheDocument();
    expect(screen.getByText("profile.days.mon")).toBeInTheDocument();
    expect(screen.getByText("profile.days.wed")).toBeInTheDocument();
    expect(screen.getByText("profile.days.fri")).toBeInTheDocument();
    expect(screen.getByText("profile.less")).toBeInTheDocument();
    expect(screen.getByText("profile.more")).toBeInTheDocument();
  });

  it("renders a 7-row grid: 53 week columns + the day-label column", () => {
    const { container } = render(<ActivityHeatmap dailyActivity={{}} />);
    // Columns are the only flex-col divs: 1 day-label column + 53 weeks
    const columns = container.querySelectorAll("div.flex.flex-col");
    expect(columns).toHaveLength(54);
    expect(columns[0].childElementCount).toBe(7); // day labels
    expect(columns[1].childElementCount).toBe(7); // first (padded) week
    expect(columns[52].childElementCount).toBe(7); // a full middle week
    expect(columns[53].childElementCount).toBe(4); // trailing partial week
  });

  it("renders 365 day cells, all gray when there is no activity (+1 legend swatch)", () => {
    const { container } = render(<ActivityHeatmap dailyActivity={{}} />);
    expect(container.querySelectorAll(".bg-gray-100")).toHaveLength(366);
    expect(container.querySelectorAll(".bg-emerald-200")).toHaveLength(1); // legend only
    expect(container.querySelectorAll(".bg-emerald-400")).toHaveLength(1); // legend only
    expect(container.querySelectorAll(".bg-emerald-600")).toHaveLength(1); // legend only
  });
});

describe("ActivityHeatmap — cell colors per count", () => {
  // The color class IS the behavior here, so we assert classes directly.
  // Counts include the 4 fixed legend swatches (one per color).
  it("maps counts to intensity classes (0 / 1 / <=3 / >3)", () => {
    const { container } = render(<ActivityHeatmap dailyActivity={ACTIVITY} />);
    expect(container.querySelectorAll(".bg-emerald-600")).toHaveLength(2); // count 5 + legend
    expect(container.querySelectorAll(".bg-emerald-200")).toHaveLength(2); // count 1 + legend
    expect(container.querySelectorAll(".bg-emerald-400")).toHaveLength(3); // counts 3 & 2 + legend
    expect(container.querySelectorAll(".bg-gray-100")).toHaveLength(362); // 361 empty days + legend
  });
});

describe("ActivityHeatmap — month labels", () => {
  it("renders 12 deduplicated month labels, one per month in range", () => {
    const { container } = render(<ActivityHeatmap dailyActivity={{}} />);
    const monthRow = container.querySelector(".relative")!;
    expect(monthRow.childElementCount).toBe(12);
    // June 2025 days 1–7 are out of range, so "jun" comes from 2026 only.
    for (const key of ["jan", "jun", "jul", "dec"]) {
      expect(screen.getAllByText(`profile.months.${key}`)).toHaveLength(1);
    }
  });
});

describe("ActivityHeatmap — tooltip", () => {
  // NOTE: React's onMouseEnter is synthesized from mouseover/mouseout, so we
  // fire mouseOver/mouseOut (fireEvent.mouseEnter doesn't bubble to the root).
  it("shows date and plural game count on hover, hides on leave", () => {
    const { container } = render(<ActivityHeatmap dailyActivity={ACTIVITY} />);
    // First .bg-emerald-600 in document order is the grid cell (legend is after)
    const cell = container.querySelectorAll(".bg-emerald-600")[0];
    fireEvent.mouseOver(cell);
    expect(
      screen.getByText("2026-06-10: 5 profile.games"),
    ).toBeInTheDocument();
    fireEvent.mouseOut(cell);
    expect(
      screen.queryByText("2026-06-10: 5 profile.games"),
    ).not.toBeInTheDocument();
  });

  it("uses the singular key for a single game", () => {
    const { container } = render(<ActivityHeatmap dailyActivity={ACTIVITY} />);
    const cell = container.querySelectorAll(".bg-emerald-200")[0];
    fireEvent.mouseOver(cell);
    expect(screen.getByText("2026-06-09: 1 profile.game")).toBeInTheDocument();
  });

  it("shows the no-games text for an empty day (first cell = range start)", () => {
    const { container } = render(<ActivityHeatmap dailyActivity={ACTIVITY} />);
    const firstGrayCell = container.querySelectorAll(".bg-gray-100")[0];
    fireEvent.mouseOver(firstGrayCell);
    expect(
      screen.getByText("2025-06-11: profile.activityNoGames"),
    ).toBeInTheDocument();
  });
});
