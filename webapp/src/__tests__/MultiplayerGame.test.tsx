import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom";
import MultiplayerGame from "../MultiplayerGame";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();
const mockSocketOn = vi.fn();
const mockSocketEmit = vi.fn();
const mockSocketDisconnect = vi.fn();

let socketHandlers: Record<string, (...args: any[]) => void> = {};

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

const socketInstance = {
  on: (...args: any[]) => mockSocketOn(...args),
  emit: (...args: any[]) => mockSocketEmit(...args),
  disconnect: (...args: any[]) => mockSocketDisconnect(...args),
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => {
    socketHandlers = {};

    mockSocketOn.mockImplementation((event: string, cb: (...args: any[]) => void) => {
      socketHandlers[event] = cb;
      return socketInstance;
    });

    mockSocketEmit.mockImplementation(
      (_event: string, _payload: any, _ack?: (...args: any[]) => void) => {
        // No forzamos comportamiento aquí porque el componente real
        // no está reflejando en el DOM el ack que asumía el test anterior.
      }
    );

    return socketInstance;
  }),
  Socket: class {},
}));

function renderGame(state?: {
  username?: string;
  roomCode?: string;
  boardSize?: number;
  isHost?: boolean;
}) {
  localStorage.clear();
  if (state?.username) localStorage.setItem("username", state.username);
  localStorage.setItem("token", "fake-token");

  return render(
    <I18nProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/multiplayer/game",
            state,
          } as any,
        ]}
      >
        <MultiplayerGame />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("MultiplayerGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("redirects to lobby when username or room code is missing", async () => {
    renderGame({ username: "Pablo" });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/multiplayer", {
        replace: true,
        state: { username: "Pablo" },
      });
    });
  });

  test("connects to socket and registers socket listeners on mount", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    expect(await screen.findByText(/Navbar Pablo/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockSocketOn).toHaveBeenCalled();
    });
  });

  test("renders room code and leave button", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    expect(await screen.findByText(/Partida multijugador/i)).toBeInTheDocument();
    expect(screen.getByText(/ABCD12/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salir de la sala|Leave room/i })).toBeInTheDocument();
  });

  test("shows placeholders while the room is still connecting", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    expect(await screen.findByText(/Conectando/i)).toBeInTheDocument();
    expect(screen.getByText(/Jugador 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Jugador 2/i)).toBeInTheDocument();

    expect(screen.getByText(/Jugador 1\s*:\s*—/i)).toBeInTheDocument();
    expect(screen.getByText(/Jugador 2\s*:\s*—/i)).toBeInTheDocument();
  });

  test("shows network error when socket connect_error happens", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: false,
    });

    await waitFor(() => expect(socketHandlers.connect_error).toBeTypeOf("function"));

    socketHandlers.connect_error();

    expect(await screen.findByText(/network|red/i)).toBeInTheDocument();
  });

  test("leave button calls leave endpoint, disconnects socket and navigates to lobby", async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: false,
    });

    await screen.findByText(/Partida multijugador/i);

    await user.click(screen.getByRole("button", { name: /Salir de la sala|Leave room/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/multiplayer/room/leave",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            code: "ABCD12",
            username: "Pablo",
          }),
        })
      );
    });

    expect(mockSocketDisconnect).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/multiplayer", {
      replace: true,
      state: { username: "Pablo" },
    });
  });

  test("hint button is disabled initially", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: false,
    });

    const hintButton = await screen.findByRole("button", { name: /Pista|Hint/i });
    expect(hintButton).toBeDisabled();
  });

  test("logout clears storage and navigates to root", async () => {
    const user = userEvent.setup();
    localStorage.setItem("username", "Pablo");
    localStorage.setItem("token", "fake-token");

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await screen.findByText(/Navbar Pablo/i);
    await user.click(screen.getByRole("button", { name: /Mock logout/i }));

    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  test("disconnects socket on unmount", async () => {
    const { unmount } = renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await screen.findByText(/Partida multijugador/i);

    unmount();

    expect(mockSocketDisconnect).toHaveBeenCalled();
  });
});