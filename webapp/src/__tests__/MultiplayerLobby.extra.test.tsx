import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import MultiplayerLobby from "../MultiplayerLobby";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../Navbar", () => ({
  default: ({ username, onLogout }: any) => (
    <div>
      <span>Navbar {username}</span>
      <button onClick={onLogout}>Mock logout</button>
    </div>
  ),
}));

function renderLobby(username = "Pablo") {
  localStorage.clear();
  localStorage.setItem("username", username);
  localStorage.setItem("token", "fake-token");

  return render(
    <I18nProvider>
      <MemoryRouter
        initialEntries={[{ pathname: "/multiplayer", state: { username } } as any]}
      >
        <MultiplayerLobby />
      </MemoryRouter>
    </I18nProvider>
  );
}

function getCreateCard() {
  return screen.getByText(/crear una nueva sala|create a new room/i).closest(".card") as HTMLElement;
}

function getJoinCard() {
  return screen.getByText(/unirse a una sala|join a room/i).closest(".card") as HTMLElement;
}

describe("MultiplayerLobby extra coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  test("switching to join mode clears previous error", async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false, error: "boom" }),
    });

    renderLobby();

    const createCard = getCreateCard();
    const createSubmit = within(createCard).getByRole("button", {
      name: /crear sala|create room/i,
    });

    await user.click(createSubmit);
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /unirse|join/i }));

    await waitFor(() => {
      expect(screen.queryByText(/boom/i)).not.toBeInTheDocument();
    });
  });

  test("preset button 9 is used when selected", async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, room: { code: "ROOM99", size: 9 } }),
    });

    renderLobby();

    const createCard = getCreateCard();

    await user.click(within(createCard).getByRole("button", { name: /^9$/ }));

    const createSubmit = within(createCard).getByRole("button", {
      name: /crear sala|create room/i,
    });
    await user.click(createSubmit);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/multiplayer/room/create",
        expect.objectContaining({
          body: JSON.stringify({ username: "Pablo", size: 9 }),
        })
      );
    });
  });

  test("create button stays disabled with custom size below 3", async () => {
    const user = userEvent.setup();
    renderLobby();

    const createCard = getCreateCard();
    const input = within(createCard).getByRole("spinbutton");

    await user.clear(input);
    await user.type(input, "2");

    await waitFor(() => {
      expect(
        within(createCard).getByRole("button", { name: /crear sala|create room/i })
      ).toBeDisabled();
    });
  });

  test("join uses fallback board size 7 when backend omits room.size", async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, room: {} }),
    });

    renderLobby();

    await user.click(screen.getByRole("button", { name: /unirse|join/i }));

    const joinCard = getJoinCard();
    await user.type(within(joinCard).getByRole("textbox"), "ABCD");

    await user.click(
      within(joinCard).getByRole("button", { name: /unirse a la sala|join room/i })
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/multiplayer/game", {
        state: {
          username: "Pablo",
          roomCode: "ABCD",
          boardSize: 7,
          isHost: false,
        },
      });
    });
  });
});