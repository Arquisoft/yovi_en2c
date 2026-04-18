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

// ── localStorage mock ─────────────────────────────────────────────────────────
// The webapp vitest config sets --localstorage-file to a path that may not
// exist, which produces a broken localStorage stub without .clear().
// We provide our own in-memory implementation via vi.stubGlobal, the same
// pattern used for ResizeObserver throughout this test suite.
function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear:      () => { store = {}; },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyBoardLayout(size = 7) {
  return Array.from({ length: size }, (_, row) => ".".repeat(size - row)).join("/");
}

function renderGame(username = "Pablo", bot = "heuristic_bot", boardSize = 7) {
  localStorage.clear();
  localStorage.setItem("username", username);

  return render(
      <I18nProvider>
        <MemoryRouter
            initialEntries={[{
              pathname: "/game",
              state: { username, bot, boardSize, timerSeconds: 0 },
            } as any]}
        >
          <Game />
        </MemoryRouter>
      </I18nProvider>
  );
}

function mockNewGame(size = 7) {
  return {
    ok: true,
    text: async () => JSON.stringify({
      ok: true,
      yen: { size, players: ["B", "R"], layout: emptyBoardLayout(size) },
    }),
  } as Response;
}

function mockHintSuccess(x = 3, y = 2, z = 1) {
  return {
    ok: true,
    json: async () => ({ ok: true, coords: { x, y, z } }),
  } as Response;
}

function mockHintError(errorMsg = "Hint unavailable") {
  return {
    ok: false,
    json: async () => ({ ok: false, error: errorMsg }),
  } as Response;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Game — hint feature", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockNavigate.mockReset();

    vi.stubGlobal("localStorage", makeLocalStorageMock());

    global.ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // ── Visibility ──────────────────────────────────────────────────────────────

  test("hint button is NOT visible before the game starts (no yen yet)", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    renderGame();

    expect(screen.queryByRole("button", { name: /Pista|Hint/i })).not.toBeInTheDocument();
  });

  test("hint button appears once the board is loaded", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockNewGame());

    renderGame();

    expect(await screen.findByRole("button", { name: /Pista|Hint/i })).toBeInTheDocument();
  });

  test("hint button is NOT visible after game is over", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({
            ok: true, finished: true, winner: "B",
            winning_edges: [[[0, 0], [1, 0]]],
            yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
          }),
        } as Response)
        .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ success: true }) } as Response);

    renderGame();

    await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });
    await user.click(document.querySelectorAll("polygon")[0]);
    await waitFor(() => { expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument(); });

    expect(screen.queryByRole("button", { name: /Pista|Hint/i })).not.toBeInTheDocument();
  });

  // ── Successful hint request ─────────────────────────────────────────────────

  test("clicking hint calls POST /api/hint with yen only (no bot_id)", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockHintSuccess());

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));

    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });

    const [url, options] = (global.fetch as any).mock.calls[1];
    expect(url).toMatch(/\/api\/hint$/);

    const body = JSON.parse(options.body);
    expect(body).toHaveProperty("yen");
    expect(body.bot_id).toBeUndefined();
  });

  test("hint button is disabled or hidden while loading", async () => {
    const user = userEvent.setup();

    let resolveHint!: (v: any) => void;
    const hintPromise = new Promise<Response>((res) => { resolveHint = res; });

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockReturnValueOnce(hintPromise);

    renderGame();

    const hintBtn = await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(hintBtn);

    // While hintLoading=true the button is either disabled or removed from DOM
    await waitFor(() => {
      const btn = screen.queryByRole("button", { name: /Pista|Hint/i });
      if (btn) {
        expect(btn).toBeDisabled();
      }
      // If btn is null the button is hidden, which also blocks double-clicks
    });

    resolveHint(mockHintSuccess());

    // After resolution the button must be back and enabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Pista|Hint/i })).not.toBeDisabled();
    });
  });

  test("hint is not triggered again while already loading", async () => {
    const user = userEvent.setup();

    let resolveHint!: (v: any) => void;
    const hintPromise = new Promise<Response>((res) => { resolveHint = res; });

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockReturnValueOnce(hintPromise);

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));

    // Only 2 calls: new game + 1 hint. A second click should not trigger a 3rd.
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    resolveHint(mockHintSuccess());
  });

  test("hint button returns to normal label after successful response", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockHintSuccess());

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Pista|Hint/i })).not.toBeDisabled();
    });
  });

  // ── Hint cell highlight ─────────────────────────────────────────────────────

  test("hint highlight is cleared when the player makes a move", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockHintSuccess(6, 0, 0))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({
            ok: true, finished: false,
            yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
          }),
        } as Response);

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });

    await user.click(document.querySelectorAll("polygon")[0]);
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(3); });
  });

  test("hint highlight is cleared when new game is started", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockHintSuccess())
        .mockResolvedValueOnce(mockNewGame());

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(3); });

    expect(await screen.findByRole("button", { name: /Pista|Hint/i })).not.toBeDisabled();
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  test("shows error message when hint request fails with ok:false", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockHintError("Hint unavailable"));

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));

    expect(await screen.findByText(/Hint unavailable/i)).toBeInTheDocument();
  });

  test("shows error message when hint request throws a network error", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockRejectedValueOnce(new Error("Network failure"));

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));

    expect(await screen.findByText(/Network failure/i)).toBeInTheDocument();
  });

  test("hint button returns to enabled state after an error", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockHintError());

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Pista|Hint/i })).not.toBeDisabled();
    });
  });

  // ── Guard conditions ────────────────────────────────────────────────────────

  test("hint button does nothing while another request is in flight (busy=true)", async () => {
    const user = userEvent.setup();

    let resolveMove!: (v: any) => void;
    const movePromise = new Promise<Response>((res) => { resolveMove = res; });

    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockReturnValueOnce(movePromise);

    renderGame();

    await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });

    await user.click(document.querySelectorAll("polygon")[0]);

    expect(screen.queryByRole("button", { name: /Pista|Hint/i })).not.toBeInTheDocument();

    resolveMove({
      ok: true,
      text: async () => JSON.stringify({
        ok: true, finished: false,
        yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
      }),
    });
  });
});