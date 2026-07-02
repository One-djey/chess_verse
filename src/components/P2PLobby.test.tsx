// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import P2PLobby from "./P2PLobby";
import { SkinProvider } from "../context/SkinContext";
import { BoardSkinProvider } from "../context/BoardSkinContext";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock") },
}));

const startRoom = vi.fn();
const joinExistingRoom = vi.fn();
const leaveRoom = vi.fn();

vi.mock("../hooks/useP2P", () => ({
  useP2P: () => ({
    startRoom,
    joinExistingRoom,
    leaveRoom,
    connectionState: "idle",
    isP2PMode: false,
    gameMode: null,
  }),
}));

function renderP2PLobby(state?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/p2p", state }]}>
      <SkinProvider>
        <BoardSkinProvider>
          <P2PLobby />
        </BoardSkinProvider>
      </SkinProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("P2PLobby — preselected mode from home toggle", () => {
  it("auto-creates the room and skips the mode-selection grid when a mode was preselected", async () => {
    renderP2PLobby({ presetModeId: "classic" });

    await waitFor(() => expect(startRoom).toHaveBeenCalledTimes(1));
    expect(startRoom.mock.calls[0][1]).toMatchObject({ id: "classic" });
    expect(screen.queryByText("gameModeSelect.title")).not.toBeInTheDocument();
  });

  it("shows the mode-selection grid when no mode was preselected", () => {
    renderP2PLobby();

    expect(startRoom).not.toHaveBeenCalled();
    expect(screen.getByText("gameModeSelect.title")).toBeInTheDocument();
  });
});
