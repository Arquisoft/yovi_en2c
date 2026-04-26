import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom";
import MultiplayerLobby from "../MultiplayerLobby";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../Navbar", () => ({
  default: ({ username, onLogout }: { username: string; onLogout: () => void }) => (
    <div>
      <span>Navbar {username}</span>
      <button onClick={onLogout}>Mock logout</button>
    </div>
  ),
}));

function renderLobby(usernameFromState?: string, usernameInStorage?: string) {
  localStorage.clear();
  if (usernameInStorage) localStorage.setItem("username", usernameInStorage);
  if (usernameFromState) localStorage.setItem("username", usernameFromState);
  localStorage.setItem("token", "fake-token");

  return render(
    <I18nProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/multiplayer",
            state: usernameFromState ? { username: usernameFromState } : undefined,
          } as any,
        ]}
      >
        <MultiplayerLobby />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("MultiplayerLobby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("redirects to root when there is no username", async () => {
    renderLobby();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  test("renders lobby when username exists", async () => {
    renderLobby("Pablo");

    expect(await screen.findByText(/Navbar Pablo/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Multijugador|Multiplayer/i })).toBeInTheDocument();

    const createButtons = screen.getAllByRole("button", { name: /Crear sala|Create room/i });
    expect(createButtons.length).toBeGreaterThan(0);

    expect(screen.getByRole("button", { name: /Unirse|Join/i })).toBeInTheDocument();
  });

  test("creates a room with default preset size and navigates as host", async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        room: { code: "ABCD12" },
      }),
    });

    renderLobby("Pablo");

    const createCard = screen
      .getByRole("heading", { name: /Crear una nueva sala|Create a new room/i })
      .closest("article");
    expect(createCard).not.toBeNull();

    await user.click(
      within(createCard as HTMLElement).getByRole("button", { name: /Crear sala|Create room/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/multiplayer/room/create",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "Pablo",
            size: 7,
          }),
        })
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith("/multiplayer/game", {
      state: {
        username: "Pablo",
        roomCode: "ABCD12",
        boardSize: 7,
        isHost: true,
      },
    });
  });

  test("creates a room using custom board size", async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        room: { code: "ZXCV99" },
      }),
    });

    renderLobby("Pablo");

    const customInput = screen.getByRole("spinbutton");
    await user.clear(customInput);
    await user.type(customInput, "11");

    const createCard = screen
      .getByRole("heading", { name: /Crear una nueva sala|Create a new room/i })
      .closest("article");
    expect(createCard).not.toBeNull();

    await user.click(
      within(createCard as HTMLElement).getByRole("button", { name: /Crear sala|Create room/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/multiplayer/room/create",
        expect.objectContaining({
          body: JSON.stringify({
            username: "Pablo",
            size: 11,
          }),
        })
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith("/multiplayer/game", {
      state: {
        username: "Pablo",
        roomCode: "ZXCV99",
        boardSize: 11,
        isHost: true,
      },
    });
  });

  test("switches to join mode and uppercases room code before joining", async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        room: { size: 9 },
      }),
    });

    renderLobby("Pablo");

    await user.click(screen.getByRole("button", { name: /Unirse|Join/i }));

    const codeInput = screen.getByRole("textbox");
    await user.type(codeInput, "ab12");

    expect(codeInput).toHaveValue("AB12");

    await user.click(screen.getByRole("button", { name: /Unirse a la sala|Join room/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/multiplayer/room/join",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            code: "AB12",
            username: "Pablo",
          }),
        })
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith("/multiplayer/game", {
      state: {
        username: "Pablo",
        roomCode: "AB12",
        boardSize: 9,
        isHost: false,
      },
    });
  });

  test("disables join button when room code is too short", async () => {
    const user = userEvent.setup();
    renderLobby("Pablo");

    await user.click(screen.getByRole("button", { name: /Unirse|Join/i }));

    const joinButton = screen.getByRole("button", { name: /Unirse a la sala|Join room/i });
    expect(joinButton).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "ABC");
    expect(joinButton).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "D");
    expect(joinButton).not.toBeDisabled();
  });

  test("shows backend error when create room fails", async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        ok: false,
        error: "Room creation failed",
      }),
    });

    renderLobby("Pablo");

    const createCard = screen
      .getByRole("heading", { name: /Crear una nueva sala|Create a new room/i })
      .closest("article");
    expect(createCard).not.toBeNull();

    await user.click(
      within(createCard as HTMLElement).getByRole("button", { name: /Crear sala|Create room/i })
    );

    expect(await screen.findByText(/Room creation failed/i)).toBeInTheDocument();
  });

  test("shows network error when join request throws", async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockRejectedValueOnce(new Error("network down"));

    renderLobby("Pablo");

    await user.click(screen.getByRole("button", { name: /Unirse|Join/i }));
    await user.type(screen.getByRole("textbox"), "ABCD");
    await user.click(screen.getByRole("button", { name: /Unirse a la sala|Join room/i }));

    expect(await screen.findByText(/network|red/i)).toBeInTheDocument();
  });

  test("renders Navbar with username", async () => {
    renderLobby(undefined, "Pablo");

    expect(await screen.findByText(/Navbar Pablo/i)).toBeInTheDocument();
  });
});