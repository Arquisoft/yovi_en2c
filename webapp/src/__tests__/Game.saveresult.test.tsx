import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Game from "../Game";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderGame(
  username = "Pablo",
  bot = "minimax_bot",
  boardSize = 7
) {
  localStorage.clear();
  localStorage.setItem("username", username);

  return render(
    <I18nProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/game",
            state: { username, bot, boardSize },
          } as any,
        ]}
      >
        <Game />
      </MemoryRouter>
    </I18nProvider>
  );
}

function emptyBoardLayout(size = 7) {
  return Array.from({ length: size }, (_, row) => ".".repeat(size - row)).join("/");
}

function mockFetchNewGame(size = 7) {
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        ok: true,
        yen: {
          size,
          players: ["B", "R"],
          layout: emptyBoardLayout(size),
        },
      }),
  } as Response;
}

function mockFetchMoveFinished(winner: string | null, size = 7) {
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        ok: true,
        finished: true,
        winner,
        winning_edges: winner ? [[[0, 0], [1, 0]]] : [],
        yen: {
          size,
          players: ["B", "R"],
          layout: emptyBoardLayout(size),
        },
      }),
  } as Response;
}

function mockFetchMoveContinues(size = 7) {
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        ok: true,
        finished: false,
        yen: {
          size,
          players: ["B", "R"],
          layout: emptyBoardLayout(size),
        },
      }),
  } as Response;
}

describe("Game — saveGameResult and boardSize", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockNavigate.mockReset();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("sends boardSize from state to POST /game/new", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockFetchNewGame(9));

    renderGame("Pablo", "minimax_bot", 9);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/game\/new$/),
        expect.objectContaining({
          body: JSON.stringify({ size: 9 }),
        })
      );
    });
  });

  test("sends default boardSize 7 when not in state", async () => {
    localStorage.setItem("username", "Pablo");

    global.fetch = vi.fn().mockResolvedValueOnce(mockFetchNewGame(7));

    render(
      <I18nProvider>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/game",
              state: { username: "Pablo", bot: "minimax_bot" },
            } as any,
          ]}
        >
          <Game />
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/game\/new$/),
        expect.objectContaining({
          body: JSON.stringify({ size: 7 }),
        })
      );
    });
  });

  test("calls POST /gameresult with correct fields when player wins", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockFetchNewGame(7))
      .mockResolvedValueOnce(mockFetchMoveFinished("B", 7))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      } as Response);

    renderGame("Pablo", "minimax_bot", 7);

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    const gameResultCall = (global.fetch as any).mock.calls[2];
    expect(gameResultCall[0]).toMatch(/\/gameresult$/);

    const body = JSON.parse(gameResultCall[1].body);
    expect(body).toMatchObject({
      username: "Pablo",
      opponent: "minimax_bot",
      result: "win",
      boardSize: 7,
      gameMode: "pvb",
    });
    expect(typeof body.score).toBe("number");
    expect(body.score).toBeGreaterThanOrEqual(1);
  });

  test("calls POST /gameresult with result loss when bot wins", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockFetchNewGame(7))
      .mockResolvedValueOnce(mockFetchMoveFinished("R", 7))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      } as Response);

    renderGame("Pablo", "minimax_bot", 7);

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    const gameResultCall = (global.fetch as any).mock.calls[2];
    const body = JSON.parse(gameResultCall[1].body);

    expect(body.result).toBe("loss");
    expect(body.gameMode).toBe("pvb");
    expect(body.boardSize).toBe(7);
  });

  test("does NOT call POST /gameresult when game ends in draw", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockFetchNewGame(7))
      .mockResolvedValueOnce(mockFetchMoveFinished(null, 7));

    renderGame("Pablo", "minimax_bot", 7);

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => {
      expect(screen.getByText(/Empate|Draw/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("game overlay still shows when saveGameResult fails silently", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockFetchNewGame(7))
      .mockResolvedValueOnce(mockFetchMoveFinished("B", 7))
      .mockRejectedValueOnce(new Error("Network error saving result"));

    renderGame("Pablo", "minimax_bot", 7);

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => {
      expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument();
    });
  });

  test("resets moveCount to 0 when new game is started", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockFetchNewGame(7))
      .mockResolvedValueOnce(mockFetchMoveContinues(7))
      .mockResolvedValueOnce(mockFetchNewGame(7))
      .mockResolvedValueOnce(mockFetchMoveFinished("B", 7))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      } as Response);

    renderGame("Pablo", "minimax_bot", 7);

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });

    const gameResultCall = (global.fetch as any).mock.calls[4];
    const body = JSON.parse(gameResultCall[1].body);

    expect(body.score).toBe(1);
  });

  test("sends correct boardSize 11 in gameresult when custom size was selected", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockFetchNewGame(11))
      .mockResolvedValueOnce(mockFetchMoveFinished("B", 11))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      } as Response);

    renderGame("Pablo", "minimax_bot", 11);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/game\/new$/),
        expect.objectContaining({
          body: JSON.stringify({ size: 11 }),
        })
      );
    });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    const gameResultCall = (global.fetch as any).mock.calls[2];
    const body = JSON.parse(gameResultCall[1].body);

    expect(body.boardSize).toBe(11);
  });
});