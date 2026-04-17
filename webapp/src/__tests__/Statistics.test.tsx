import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import Statistics from "../Statistics";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderStatistics(username = "Pablo", token = "fake-token") {
  localStorage.clear();
  if (username) localStorage.setItem("username", username);
  if (token)    localStorage.setItem("token", token);

  return render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/statistics"]}>
          <Statistics />
        </MemoryRouter>
      </I18nProvider>
  );
}

const DEFAULT_LAST_FIVE = [
  { opponent: "heuristic_bot",      result: "win",  boardSize: 7,  gameMode: "pvb", date: "2026-04-13T10:00:00Z" },
  { opponent: "alfa_beta_bot",       result: "loss", boardSize: 9,  gameMode: "pvb", date: "2026-04-12T10:00:00Z" },
  { opponent: "minimax_bot",         result: "win",  boardSize: 7,  gameMode: "pvb", date: "2026-04-11T10:00:00Z" },
  { opponent: "carlos",              result: "win",  boardSize: 7,  gameMode: "pvp", date: "2026-04-10T10:00:00Z" },
  { opponent: "monte_carlo_extreme", result: "loss", boardSize: 11, gameMode: "pvb", date: "2026-04-09T10:00:00Z" },
];

const DEFAULT_STATS = {
  totalGames: 10, wins: 7, losses: 3, winRate: 70,
  pvbGames: 8, pvpGames: 2,
  lastFive: DEFAULT_LAST_FIVE,
};

function makeStatsResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({ success: true, username: "Pablo", stats: { ...DEFAULT_STATS, ...overrides } }),
  } as Response;
}

// Mocks fetch N times with the same stats payload
function mockFetchStats(times = 1) {
  let mock = vi.fn();
  for (let i = 0; i < times; i++) {
    mock = mock.mockResolvedValueOnce(makeStatsResponse());
  }
  global.fetch = mock;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Statistics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  test("redirects to root when username is missing", async () => {
    renderStatistics("", "");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  test("redirects to root when token is missing", async () => {
    renderStatistics("Pablo", "");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  test("shows loading indicator while fetching", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    renderStatistics();
    expect(screen.getAllByText(/Cargando|Loading/i).length).toBeGreaterThanOrEqual(1);
  });

  // ── API call ──────────────────────────────────────────────────────────────

  test("calls /api/stats/:username with Authorization header", async () => {
    mockFetchStats();
    renderStatistics();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
          "/api/stats/Pablo",
          expect.objectContaining({
            headers: expect.objectContaining({ Authorization: "Bearer fake-token" }),
          })
      );
    });
  });

  // ── Stats display ─────────────────────────────────────────────────────────

  test("renders summary cards with correct values", async () => {
    mockFetchStats();
    renderStatistics();
    expect(await screen.findByText(/Partidas jugadas|Games played/i)).toBeInTheDocument();
    expect(screen.getByText(/Tasa de victoria|Win rate/i)).toBeInTheDocument();
  });

  test("renders win rate bar section", async () => {
    mockFetchStats();
    renderStatistics();
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();
  });

  test("renders game mode breakdown with pvb and pvp labels", async () => {
    mockFetchStats();
    renderStatistics();
    await screen.findByText(/Partidas jugadas|Games played/i);
    expect(screen.getByText(/vs Bot/i)).toBeInTheDocument();
    expect(screen.getByText(/vs (Jugador|Player)/i)).toBeInTheDocument();
  });

  // ── Bot label mapping (ES) ────────────────────────────────────────────────

  test("displays 'Bot - Fácil' instead of heuristic_bot in ES", async () => {
    mockFetchStats();
    renderStatistics();
    expect(await screen.findByText("Bot - Fácil")).toBeInTheDocument();
    expect(screen.queryByText("heuristic_bot")).not.toBeInTheDocument();
  });

  test("displays 'Bot - Difícil' instead of alfa_beta_bot in ES", async () => {
    mockFetchStats();
    renderStatistics();
    await screen.findByText("Bot - Fácil");
    expect(screen.getByText("Bot - Difícil")).toBeInTheDocument();
    expect(screen.queryByText("alfa_beta_bot")).not.toBeInTheDocument();
  });

  test("displays 'Bot - Medio' instead of minimax_bot in ES", async () => {
    mockFetchStats();
    renderStatistics();
    await screen.findByText("Bot - Fácil");
    expect(screen.getByText("Bot - Medio")).toBeInTheDocument();
    expect(screen.queryByText("minimax_bot")).not.toBeInTheDocument();
  });

  test("displays 'Bot - Extremo' instead of monte_carlo_extreme in ES", async () => {
    mockFetchStats();
    renderStatistics();
    await screen.findByText("Bot - Fácil");
    expect(screen.getByText(/Bot - Extremo/i)).toBeInTheDocument();
    expect(screen.queryByText("monte_carlo_extreme")).not.toBeInTheDocument();
  });

  test("PvP opponent username is displayed unchanged in ES", async () => {
    mockFetchStats();
    renderStatistics();
    await screen.findByText("Bot - Fácil");
    expect(screen.getByText("carlos")).toBeInTheDocument();
  });

  // ── Bot label mapping (EN) ────────────────────────────────────────────────
  // Switching language triggers a re-fetch because t() changes.
  // We mock fetch TWICE: once for the initial load, once for the refetch after language change.

  test("displays 'Bot - Easy' instead of heuristic_bot in EN", async () => {
    mockFetchStats(2); // initial + refetch after lang change
    const { getByRole } = renderStatistics();

    await screen.findByText("Bot - Fácil");
    await userEvent.click(getByRole("button", { name: /^EN$/i }));

    await waitFor(() => {
      expect(screen.getByText("Bot - Easy")).toBeInTheDocument();
    });
    expect(screen.queryByText("heuristic_bot")).not.toBeInTheDocument();
  });

  test("displays 'Bot - Hard' instead of alfa_beta_bot in EN", async () => {
    mockFetchStats(2);
    const { getByRole } = renderStatistics();

    await screen.findByText("Bot - Fácil");
    await userEvent.click(getByRole("button", { name: /^EN$/i }));

    await waitFor(() => {
      expect(screen.getByText("Bot - Hard")).toBeInTheDocument();
    });
    expect(screen.queryByText("alfa_beta_bot")).not.toBeInTheDocument();
  });

  test("displays 'Bot - Medium' instead of minimax_bot in EN", async () => {
    mockFetchStats(2);
    const { getByRole } = renderStatistics();

    await screen.findByText("Bot - Fácil");
    await userEvent.click(getByRole("button", { name: /^EN$/i }));

    await waitFor(() => {
      expect(screen.getByText("Bot - Medium")).toBeInTheDocument();
    });
    expect(screen.queryByText("minimax_bot")).not.toBeInTheDocument();
  });

  test("PvP username remains unchanged after switching to EN", async () => {
    mockFetchStats(2);
    const { getByRole } = renderStatistics();

    await screen.findByText("Bot - Fácil");
    await userEvent.click(getByRole("button", { name: /^EN$/i }));

    await waitFor(() => {
      expect(screen.getByText("carlos")).toBeInTheDocument();
    });
  });

  // ── Unknown bot ID fallback ───────────────────────────────────────────────

  test("displays raw opponent name when bot ID is unknown", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true, username: "Pablo",
        stats: {
          totalGames: 1, wins: 1, losses: 0, winRate: 100,
          pvbGames: 1, pvpGames: 0,
          lastFive: [
            { opponent: "unknown_bot_v99", result: "win", boardSize: 7, gameMode: "pvb", date: "2026-04-13T10:00:00Z" },
          ],
        },
      }),
    } as Response);

    renderStatistics();
    expect(await screen.findByText("unknown_bot_v99")).toBeInTheDocument();
  });

  // ── Table columns ─────────────────────────────────────────────────────────

  test("renders board size and game mode in table rows", async () => {
    mockFetchStats();
    renderStatistics();
    await screen.findByText("Bot - Fácil");
    expect(screen.getAllByText("7×7").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("9×9")).toBeInTheDocument();
    expect(screen.getByText("11×11")).toBeInTheDocument();
    expect(screen.getAllByText("PVB").length).toBeGreaterThan(0);
    expect(screen.getByText("PVP")).toBeInTheDocument();
  });

  test("renders win and loss pills correctly", async () => {
    mockFetchStats();
    renderStatistics();
    await screen.findByText("Bot - Fácil");
    expect(screen.getAllByText(/^(Victoria|Win)$/i).length).toBe(3);
    expect(screen.getAllByText(/^(Derrota|Loss)$/i).length).toBe(2);
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  test("shows empty state message when user has no games", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true, username: "Pablo",
        stats: { totalGames: 0, wins: 0, losses: 0, winRate: 0, pvbGames: 0, pvpGames: 0, lastFive: [] },
      }),
    } as Response);

    renderStatistics();
    expect(await screen.findByText(/no tienes partidas|no recorded games/i)).toBeInTheDocument();
  });

  test("navigates to select-difficulty when play first button is clicked", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true, username: "Pablo",
        stats: { totalGames: 0, wins: 0, losses: 0, winRate: 0, pvbGames: 0, pvpGames: 0, lastFive: [] },
      }),
    } as Response);

    renderStatistics();
    await user.click(await screen.findByRole("button", { name: /juega|play your first/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/select-difficulty");
  });

  // ── Error state ───────────────────────────────────────────────────────────

  test("shows error message when API returns not ok", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: "User not found" }),
    } as Response);

    renderStatistics();
    expect(await screen.findByText(/User not found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar|Retry/i })).toBeInTheDocument();
  });

  test("shows error message when fetch throws a network error", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
    renderStatistics();
    expect(await screen.findByText(/Error de red|Network error/i)).toBeInTheDocument();
  });

  test("retries fetch when retry button is clicked", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(makeStatsResponse({ totalGames: 5, wins: 4, losses: 1, winRate: 80, lastFive: [] }));

    renderStatistics();
    await screen.findByRole("button", { name: /Reintentar|Retry/i });
    await user.click(screen.getByRole("button", { name: /Reintentar|Retry/i }));
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });
    expect(await screen.findByText(/Tasa de victoria|Win rate/i)).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  // ── Refresh ───────────────────────────────────────────────────────────────

  test("refresh button triggers a new fetch", async () => {
    const user = userEvent.setup();
    mockFetchStats(2);
    renderStatistics();
    await screen.findByText(/Partidas jugadas|Games played/i);
    await user.click(screen.getByRole("button", { name: /Actualizar|Refresh/i }));
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test("navigates to home when back button is clicked", async () => {
    const user = userEvent.setup();
    mockFetchStats();
    renderStatistics();
    await screen.findByText(/Partidas jugadas|Games played/i);
    await user.click(screen.getByRole("button", { name: /Volver al inicio|Back to home/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  test("logout clears storage and navigates to root", async () => {
    const user = userEvent.setup();
    mockFetchStats();
    renderStatistics();
    await screen.findByText(/Partidas jugadas|Games played/i);
    await user.click(screen.getByRole("button", { name: /Salir|Logout/i }));
    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  // ── Navbar ────────────────────────────────────────────────────────────────

  test("renders navbar with username", async () => {
    mockFetchStats();
    renderStatistics();
    await screen.findByText(/Partidas jugadas|Games played/i);
    expect(screen.getByLabelText(/Usuario actual/i)).toHaveTextContent("Pablo");
  });

  test("renders page title", async () => {
    mockFetchStats();
    renderStatistics();
    expect(
        await screen.findByRole("heading", { name: /Mis Estadísticas|My Statistics/i })
    ).toBeInTheDocument();
  });
});