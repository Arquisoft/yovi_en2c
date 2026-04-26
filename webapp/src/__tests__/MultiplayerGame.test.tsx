import { render, screen, waitFor, act } from "@testing-library/react";
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
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  async function emitSocketEvent(event: string, payload?: any) {
    await act(async () => {
      socketHandlers[event]?.(payload);
    });
  }

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

  test("renders Navbar with username", async () => {
    localStorage.setItem("username", "Pablo");
    localStorage.setItem("token", "token");

    renderGame();

    expect(await screen.findByText(/Navbar Pablo/i)).toBeInTheDocument();
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

  const activeRoom = {
    code: "ABCD12",
    size: 5,
    status: "active" as const,
    yen: {
      size: 5,
      turn: 0,
      players: ["B", "R"],
      layout: "./../.../..../.....",
    },
    players: {
      B: { username: "Pablo" },
      R: { username: "Laura" },
    },
  };

  test("emits join_room when socket connects", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.connect).toBeTypeOf("function"));

    socketHandlers.connect();

    expect(mockSocketEmit).toHaveBeenCalledWith(
      "join_room",
      { code: "ABCD12", username: "Pablo" },
      expect.any(Function)
    );
  });

  test("shows connected status after socket connect", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.connect).toBeTypeOf("function"));

    socketHandlers.connect();

    expect(await screen.findByText(/Conectado|Connected/i)).toBeInTheDocument();
  });

  test("shows join error when join_room ack fails", async () => {
    mockSocketEmit.mockImplementationOnce(
      (_event: string, _payload: any, ack?: (...args: any[]) => void) => {
        ack?.({ ok: false, error: "Room is full" });
      }
    );

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.connect).toBeTypeOf("function"));

    socketHandlers.connect();

    expect(await screen.findByText(/Room is full/i)).toBeInTheDocument();
  });

  test("sets room state when join_room ack succeeds", async () => {
    mockSocketEmit.mockImplementationOnce(
      (_event: string, _payload: any, ack?: (...args: any[]) => void) => {
        ack?.({ ok: true, room: activeRoom });
      }
    );

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.connect).toBeTypeOf("function"));

    socketHandlers.connect();

    expect(await screen.findByText(/Jugador 1\s*:\s*Pablo|Player 1\s*:\s*Pablo/i)).toBeInTheDocument();
    expect(screen.getByText(/Jugador 2\s*:\s*Laura|Player 2\s*:\s*Laura/i)).toBeInTheDocument();
  });

  test("updates room when room_updated event arrives", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.room_updated).toBeTypeOf("function"));

    socketHandlers.room_updated({ room: activeRoom });

    expect(await screen.findByText(/Jugador 1\s*:\s*Pablo|Player 1\s*:\s*Pablo/i)).toBeInTheDocument();
    expect(screen.getByText(/Jugador 2\s*:\s*Laura|Player 2\s*:\s*Laura/i)).toBeInTheDocument();
  });

  test("updates room when game_started event arrives", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.game_started).toBeTypeOf("function"));

    socketHandlers.game_started({ room: activeRoom });

    expect(await screen.findByText(/Jugador 2\s*:\s*Laura|Player 2\s*:\s*Laura/i)).toBeInTheDocument();
  });

  test("shows your turn when current turn belongs to current user", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.room_updated).toBeTypeOf("function"));

    socketHandlers.room_updated({ room: activeRoom });

    expect(await screen.findByText(/Tu turno|Your turn/i)).toBeInTheDocument();
  });

  test("shows opponent turn when current turn belongs to opponent", async () => {
    const roomWithOpponentTurn = {
      ...activeRoom,
      yen: {
        ...activeRoom.yen,
        turn: 1,
      },
    };

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.room_updated).toBeTypeOf("function"));

    socketHandlers.room_updated({ room: roomWithOpponentTurn });

    expect(await screen.findByText(/Turno del rival|Opponent turn/i)).toBeInTheDocument();
  });

  test("clicking an empty cell emits make_move when it is your turn", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.room_updated).toBeTypeOf("function"));

    socketHandlers.room_updated({ room: activeRoom });

    const cells = document.querySelectorAll("polygon");
    expect(cells.length).toBeGreaterThan(0);

    await userEvent.click(cells[0]);

    expect(mockSocketEmit).toHaveBeenCalledWith(
      "make_move",
      { code: "ABCD12", row: 0, col: 0 },
      expect.any(Function)
    );
  });

  test("does not emit make_move when it is not your turn", async () => {
    const roomWithOpponentTurn = {
      ...activeRoom,
      yen: {
        ...activeRoom.yen,
        turn: 1,
      },
    };

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.room_updated).toBeTypeOf("function"));

    socketHandlers.room_updated({ room: roomWithOpponentTurn });

    vi.clearAllMocks();

    const cells = document.querySelectorAll("polygon");
    await userEvent.click(cells[0]);

    expect(mockSocketEmit).not.toHaveBeenCalledWith(
      "make_move",
      expect.anything(),
      expect.any(Function)
    );
  });

  test("shows move error when make_move ack fails", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.room_updated).toBeTypeOf("function"));

    await emitSocketEvent("room_updated", { room: activeRoom });

    mockSocketEmit.mockImplementation(
      (event: string, _payload: any, ack?: (...args: any[]) => void) => {
        if (event === "make_move") {
          ack?.({ ok: false, error: "Invalid move" });
        }
      }
    );

    const cells = document.querySelectorAll("polygon");
    await userEvent.click(cells[0]);

    expect(await screen.findByText(/Invalid move/i)).toBeInTheDocument();
  });

  test("asks for hint", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        coords: { x: 4, y: 0 },
      }),
    });

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.room_updated).toBeTypeOf("function"));
    await emitSocketEvent("room_updated", { room: activeRoom });

    const hintButton = await screen.findByRole("button", { name: /Pista|Hint/i });
    expect(hintButton).not.toBeDisabled();

    await userEvent.click(hintButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hint",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ yen: activeRoom.yen }),
        })
      );
    });
  });

  test("shows hint error when hint endpoint returns not ok", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        ok: false,
        error: "No hint available",
      }),
    });

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.room_updated).toBeTypeOf("function"));
    await emitSocketEvent("room_updated", { room: activeRoom });

    await userEvent.click(await screen.findByRole("button", { name: /Pista|Hint/i }));

    expect(await screen.findByText(/No hint available/i)).toBeInTheDocument();
  });

  test("shows network error when hint request throws", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("network down"));

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.room_updated).toBeTypeOf("function"));
    await emitSocketEvent("room_updated", { room: activeRoom });

    await userEvent.click(await screen.findByRole("button", { name: /Pista|Hint/i }));

    expect(await screen.findByText(/network|red/i)).toBeInTheDocument();
  });

  test("shows game over win overlay when B wins and current user is B", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: false,
    });

    await waitFor(() => expect(socketHandlers.game_over).toBeTypeOf("function"));

    await emitSocketEvent("game_over", {
      room: activeRoom,
      winner: "B",
      winningEdges: [[[0, 0], [1, 0]]],
    });

    expect(
      await screen.findByRole("heading", {
        name: /Partida terminada.*Has ganado|Game finished.*You won|ganado|won/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Ganador|Winner/i)).toBeInTheDocument();
  });

  test("shows game over lost overlay when R wins and current user is B", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: false,
    });

    await waitFor(() => expect(socketHandlers.game_over).toBeTypeOf("function"));

    await emitSocketEvent("game_over", {
      room: activeRoom,
      winner: "R",
      winningEdges: [[[0, 0], [1, 0]]],
    });

    expect(
      await screen.findByRole("heading", {
        name: /Partida terminada.*Has perdido|Game finished.*You lost|perdido|lost/i,
      })
    ).toBeInTheDocument();

    expect(screen.getAllByText(/Laura/i).length).toBeGreaterThanOrEqual(1);
  });

  test("shows draw overlay when game finishes without winner", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: false,
    });

    await waitFor(() => expect(socketHandlers.game_over).toBeTypeOf("function"));

    await emitSocketEvent("game_over", {
      room: activeRoom,
      winner: null,
      winningEdges: [],
    });

    expect(await screen.findByText(/Empate|Draw/i)).toBeInTheDocument();
  });

  test("host saves multiplayer result when game finishes with winner", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: true,
    });

    await waitFor(() => expect(socketHandlers.game_over).toBeTypeOf("function"));

    await emitSocketEvent("game_over", {
      room: activeRoom,
      winner: "B",
      winningEdges: [[[0, 0], [1, 0]]],
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/gameresult/multiplayer",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            player1: "Pablo",
            player2: "Laura",
            winner: "Pablo",
            boardSize: 5,
          }),
        })
      );
    });
  });

  test("non-host does not save multiplayer result when game finishes", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: false,
    });

    await waitFor(() => expect(socketHandlers.game_over).toBeTypeOf("function"));

    await emitSocketEvent("game_over", {
      room: activeRoom,
      winner: "B",
      winningEdges: [[[0, 0], [1, 0]]],
    });

    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/gameresult/multiplayer",
      expect.anything()
    );
  });

  test("back button in game over overlay navigates to multiplayer lobby", async () => {
    const user = userEvent.setup();

    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: false,
    });

    await waitFor(() => expect(socketHandlers.game_over).toBeTypeOf("function"));

    await emitSocketEvent("game_over", {
      room: activeRoom,
      winner: "B",
      winningEdges: [[[0, 0], [1, 0]]],
    });

    const backButton = await screen.findByRole("button", {
      name: /Volver|Back/i,
    });

    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/multiplayer", {
      state: { username: "Pablo" },
    });
  });

  test("opponent_left event shows opponent left error", async () => {
    renderGame({
      username: "Pablo",
      roomCode: "ABCD12",
      boardSize: 5,
      isHost: false,
    });

    await waitFor(() => expect(socketHandlers.opponent_left).toBeTypeOf("function"));

    await emitSocketEvent("opponent_left");

    expect(
      await screen.findByText(/El rival se ha desconectado|opponent.*left|opponent.*disconnected/i)
    ).toBeInTheDocument();
  });
});