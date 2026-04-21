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
  return { ...actual, useNavigate: () => mockNavigate };
});

// timerSeconds: 0 disables the timer so existing tests stay unchanged
function renderGame(username = "Pablo", bot = "heuristic_bot", boardSize = 7) {
  localStorage.clear();
  if (username) localStorage.setItem("username", username);

  return render(
      <I18nProvider>
        <MemoryRouter initialEntries={[{
          pathname: "/game",
          state: username ? { username, bot, boardSize, timerSeconds: 0 } : undefined,
        } as any]}>
          <Game />
        </MemoryRouter>
      </I18nProvider>
  );
}

function emptyBoardLayout(size = 7) {
  return Array.from({ length: size }, (_, row) => ".".repeat(size - row)).join("/");
}

describe("Game component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockNavigate.mockReset();
    global.ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useRealTimers();
  });

  test("renders title and main action buttons", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
      }),
    } as Response);

    renderGame();

    expect(screen.getByRole("heading", { name: /GameY/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nueva partida|New game/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Instrucciones|Instructions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Volver al inicio|Back to home/i })).toBeInTheDocument();
  });

  test("creates new game automatically on mount", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
      }),
    } as Response);

    renderGame();

    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(1); });
    await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });
  });

  test("shows plain text error if new game response is not json", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500,
      text: async () => "Plain backend error",
    } as Response);

    renderGame();

    expect(await screen.findByText(/Plain backend error/i)).toBeInTheDocument();
  });

  test("shows error if new game fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ ok: false, error: "Game server unavailable" }),
    } as Response);

    renderGame();

    expect(await screen.findByText(/Game server unavailable/i)).toBeInTheDocument();
  });

  test("shows instructions panel when instructions button is clicked", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
      }),
    } as Response);

    renderGame();

    await user.click(await screen.findByRole("button", { name: /Instrucciones|Instructions/i }));

    expect(screen.getByRole("heading", { name: /Cómo se juega|How to play/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Dificultades$|^Difficulties$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Tamaño del tablero|Board size/i })).toBeInTheDocument();
  });

  test("sends move successfully on single click", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({
            ok: true,
            yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({
            ok: true, finished: false,
            yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
          }),
        } as Response);

    renderGame();

    await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });
    await user.click(document.querySelectorAll("polygon")[0]);
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });
  });

  test("shows backend error when move fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({
            ok: true,
            yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          text: async () => JSON.stringify({ ok: false, error: "Backend error" }),
        } as Response);

    renderGame();

    await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });
    await user.click(document.querySelectorAll("polygon")[0]);

    expect(await screen.findByText(/Backend error/i)).toBeInTheDocument();
  });

  test("navigates back to home when back button is clicked", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
      }),
    } as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Volver al inicio|Back to home/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/home", { state: { username: "Pablo" } });
  });

  test("redirects to root when username is missing", async () => {
    global.fetch = vi.fn();
    renderGame("");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  test("shows win overlay when backend returns a winning result", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({
            ok: true,
            yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({
            ok: true, finished: true, winner: "B",
            winning_edges: [[[0, 0], [1, 0]]],
            yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true, text: async () => JSON.stringify({ success: true }),
        } as Response);

    renderGame();

    await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });
    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => {
      expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument();
    });
  });
});