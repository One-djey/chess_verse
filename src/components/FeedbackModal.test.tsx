// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FeedbackModal from "./FeedbackModal";
import { recordFeedbackSent } from "../services/statsService";

// i18n: t() returns the raw key so assertions are locale-independent.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("../services/statsService", () => ({
  recordFeedbackSent: vi.fn(),
}));

beforeEach(() => {
  // jsdom's window.location is unforgeable, but in Vitest's jsdom environment
  // window === globalThis, so stubbing the global `location` also makes
  // `window.location.href = ...` write to this plain object.
  vi.stubGlobal("location", { href: "" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FeedbackModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <FeedbackModal isOpen={false} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("feedback.title")).not.toBeInTheDocument();
  });

  it("renders title, the three categories, textarea and submit when open", () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText("feedback.title")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "feedback.categories.bug" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "feedback.categories.feature" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "feedback.categories.general" }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("feedback.messagePlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "feedback.submit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("feedback.note")).toBeInTheDocument();
  });

  it("selects 'general' by default and toggles selection on click", async () => {
    const user = userEvent.setup();
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    const general = screen.getByRole("button", {
      name: "feedback.categories.general",
    });
    const bug = screen.getByRole("button", { name: "feedback.categories.bug" });
    // The selected pill is the blue one (class is the selected-state signal)
    expect(general.className).toContain("bg-blue-600");
    expect(bug.className).not.toContain("bg-blue-600");
    await user.click(bug);
    expect(bug.className).toContain("bg-blue-600");
    expect(general.className).not.toContain("bg-blue-600");
  });

  it("submit builds a mailto href with encoded subject (category) and body (message)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FeedbackModal isOpen onClose={onClose} />);
    await user.click(
      screen.getByRole("button", { name: "feedback.categories.bug" }),
    );
    await user.type(
      screen.getByPlaceholderText("feedback.messagePlaceholder"),
      "Hello world",
    );
    await user.click(screen.getByRole("button", { name: "feedback.submit" }));

    const expectedSubject = encodeURIComponent(
      "ChessVerse - feedback.categories.bug",
    );
    const expectedBody = encodeURIComponent("Hello world");
    expect(window.location.href).toBe(
      `mailto:contact@jeremy-maisse.com?subject=${expectedSubject}&body=${expectedBody}`,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(recordFeedbackSent).toHaveBeenCalledTimes(1);
  });

  it("resets the form (message cleared, category back to general) after submit", async () => {
    const user = userEvent.setup();
    // Keep isOpen true — onClose is the parent's job; the component stays
    // mounted here so we can observe the reset state.
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    await user.click(
      screen.getByRole("button", { name: "feedback.categories.feature" }),
    );
    const textarea = screen.getByPlaceholderText(
      "feedback.messagePlaceholder",
    ) as HTMLTextAreaElement;
    await user.type(textarea, "Add a 4-player mode");
    await user.click(screen.getByRole("button", { name: "feedback.submit" }));

    expect(textarea.value).toBe("");
    expect(
      screen.getByRole("button", { name: "feedback.categories.general" })
        .className,
    ).toContain("bg-blue-600");
  });

  it("the ✕ button calls onClose without sending anything", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<FeedbackModal isOpen onClose={onClose} />);
    // The close button is the icon-only button in the header (no accessible name)
    const headerButtons = container.querySelectorAll("button");
    await user.click(headerButtons[0]); // first button in DOM order = header ✕
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe("");
    expect(recordFeedbackSent).not.toHaveBeenCalled();
  });
});
