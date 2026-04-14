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
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
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

function mockFetchStats(overrides = {}) {
  const defaultStats = {
    totalGames: 10,
    wins: 7,
    losses: 3,
    winRate: 70,
    pvbGames: 8,
    pvpGames: 2,
    lastFive: [
      { opponent: "minimax_bot",  result: "win",  boardSize: 7,  gameMode: "pvb", date: "2026-04-13T10:00:00Z" },
      { opponent: "heuristic_bot",result: "loss", boardSize: 9,  gameMode: "pvb", date: "2026-04-12T10:00:00Z" },
      { opponent: "alfa_beta_bot", result: "win",  boardSize: 7,  gameMode: "pvb", date: "2026-04-11T10:00:00Z" },
      { opponent: "carlos",        result: "win",  boardSize: 7,  gameMode: "pvp", date: "2026-04-10T10:00:00Z" },
      { opponent: "minimax_bot",  result: "loss", boardSize: 11, gameMode: "pvb", date: "2026-04-09T10:00:00Z" },
    ],
    ...overrides,
  };

  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, username: "Pablo", stats: defaultStats }),
  } as Response);

  return defaultStats;
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

    expect(screen.getByText(/Cargando|Loading/i)).toBeInTheDocument();
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

    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  test("renders win rate bar section", async () => {
    mockFetchStats();
    renderStatistics();

    expect(
      await screen.findByRole("progressbar")
    ).toBeInTheDocument();
  });

  test("renders game mode breakdown with pvb and pvp counts", async () => {
    mockFetchStats();
    renderStatistics();

    await screen.findByText("10");

    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/vs Bot/i)).toBeInTheDocument();
    expect(screen.getByText(/vs (Jugador|Player)/i)).toBeInTheDocument();
  });

  test("renders last five games table with correct rows", async () => {
    mockFetchStats();
    renderStatistics();

    await screen.findByText("minimax_bot");

    expect(screen.getByText("heuristic_bot")).toBeInTheDocument();
    expect(screen.getByText("alfa_beta_bot")).toBeInTheDocument();
    expect(screen.getByText("carlos")).toBeInTheDocument();

    const winPills  = screen.getAllByText(/^(Victoria|Win)$/i);
    const lossPills = screen.getAllByText(/^(Derrota|Loss)$/i);
    expect(winPills.length).toBe(3);
    expect(lossPills.length).toBe(2);
  });

  test("renders board size and game mode in table rows", async () => {
    mockFetchStats();
    renderStatistics();

    await screen.findByText("minimax_bot");

    expect(screen.getByText("7×7")).toBeInTheDocument();
    expect(screen.getByText("9×9")).toBeInTheDocument();
    expect(screen.getAllByText("PVB").length).toBeGreaterThan(0);
    expect(screen.getByText("PVP")).toBeInTheDocument();
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  test("shows empty state message when user has no games", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        username: "Pablo",
        stats: { totalGames: 0, wins: 0, losses: 0, winRate: 0, pvbGames: 0, pvpGames: 0, lastFive: [] },
      }),
    } as Response);

    renderStatistics();

    expect(await screen.findByText(/no tienes partidas|no recorded games/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /juega|play your first/i })).toBeInTheDocument();
  });

  test("navigates to select-difficulty when play first button is clicked", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        username: "Pablo",
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

    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          username: "Pablo",
          stats: { totalGames: 1, wins: 1, losses: 0, winRate: 100, pvbGames: 1, pvpGames: 0, lastFive: [] },
        }),
      } as Response);

    renderStatistics();

    await screen.findByRole("button", { name: /Reintentar|Retry/i });
    await user.click(screen.getByRole("button", { name: /Reintentar|Retry/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  // ── Refresh button ────────────────────────────────────────────────────────

  test("refresh button triggers a new fetch", async () => {
    const user = userEvent.setup();
    mockFetchStats();

    renderStatistics();
    await screen.findByText("10");

    mockFetchStats({ totalGames: 11, wins: 8, losses: 3, winRate: 73 });

    await user.click(screen.getByRole("button", { name: /Actualizar|Refresh/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test("navigates to home when back button is clicked", async () => {
    const user = userEvent.setup();
    mockFetchStats();
    renderStatistics();

    await screen.findByText("10");

    await user.click(screen.getByRole("button", { name: /Volver al inicio|Back to home/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  test("logout clears storage and navigates to root", async () => {
    const user = userEvent.setup();
    mockFetchStats();
    renderStatistics();

    await screen.findByText("10");

    await user.click(screen.getByRole("button", { name: /Salir|Logout/i }));

    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  // ── Navbar renders ────────────────────────────────────────────────────────

  test("renders navbar with username", async () => {
    mockFetchStats();
    renderStatistics();

    await screen.findByText("10");

    expect(screen.getByText(/Pablo/i)).toBeInTheDocument();
  });

  test("renders page title", async () => {
    mockFetchStats();
    renderStatistics();

    expect(
      await screen.findByRole("heading", { name: /Mis Estadísticas|My Statistics/i })
    ).toBeInTheDocument();
  });
});
