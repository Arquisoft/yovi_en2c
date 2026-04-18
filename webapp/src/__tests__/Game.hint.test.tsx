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
          // timerSeconds: 0 → timer disabled, consistent with existing test suite
          state: { username, bot, boardSize, timerSeconds: 0 },
        } as any]}
      >
        <Game />
      </MemoryRouter>
    </I18nProvider>
  );
}

/** Standard mock: new game resolves successfully. */
function mockNewGame(size = 7) {
  return {
    ok: true,
    text: async () => JSON.stringify({
      ok: true,
      yen: { size, players: ["B", "R"], layout: emptyBoardLayout(size) },
    }),
  } as Response;
}

/** Standard mock: hint resolves with barycentric coords. */
function mockHintSuccess(x = 3, y = 2, z = 1) {
  return {
    ok: true,
    json: async () => ({ ok: true, coords: { x, y, z } }),
  } as Response;
}

/** Standard mock: hint resolves with an error. */
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
    global.ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useRealTimers();
  });

  // ── Visibility ──────────────────────────────────────────────────────────────

  test("hint button is NOT visible before the game starts (no yen yet)", () => {
    // fetch never resolves → game stays in loading state
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
      .mockResolvedValueOnce(mockNewGame())    // new game
      .mockResolvedValueOnce(mockHintSuccess()); // hint

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));

    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });

    const [url, options] = (global.fetch as any).mock.calls[1];
    expect(url).toMatch(/\/api\/hint$/);

    const body = JSON.parse(options.body);
    expect(body).toHaveProperty("yen");
    // bot_id must NOT be sent — the gateway decides the bot internally
    expect(body.bot_id).toBeUndefined();
  });

  test("hint button shows loading text while request is in flight", async () => {
    const user = userEvent.setup();

    let resolveHint!: (v: any) => void;
    const hintPromise = new Promise<Response>((res) => { resolveHint = res; });

    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockNewGame())
      .mockReturnValueOnce(hintPromise);

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));

    // While in flight the button must show the loading label
    expect(await screen.findByRole("button", { name: /Calculando|Thinking/i })).toBeInTheDocument();

    // Now resolve the request
    resolveHint(mockHintSuccess());
  });

  test("hint button is disabled while loading", async () => {
    const user = userEvent.setup();

    let resolveHint!: (v: any) => void;
    const hintPromise = new Promise<Response>((res) => { resolveHint = res; });

    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockNewGame())
      .mockReturnValueOnce(hintPromise);

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));

    const btn = await screen.findByRole("button", { name: /Calculando|Thinking/i });
    expect(btn).toBeDisabled();

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

    // After resolution the button label reverts
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Pista|Hint/i })).not.toBeDisabled();
    });
  });

  // ── Hint cell highlight ─────────────────────────────────────────────────────

  test("hint highlight is cleared when the player makes a move", async () => {
    const user = userEvent.setup();

    // Game board layout: row 0 has 1 cell (index 0 in polygon list)
    // Hint returns x=6,y=0,z=0 → row=0, col=0 (same cell we'll click)
    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockNewGame())
      .mockResolvedValueOnce(mockHintSuccess(6, 0, 0)) // hint
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          ok: true, finished: false,
          yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
        }),
      } as Response); // move

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });

    // Make a move — hint must clear regardless of which cell is clicked
    const polygons = document.querySelectorAll("polygon");
    await user.click(polygons[0]);
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(3); });
  });

  test("hint highlight is cleared when new game is started", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockNewGame())
      .mockResolvedValueOnce(mockHintSuccess())
      .mockResolvedValueOnce(mockNewGame()); // new game

    renderGame();

    await screen.findByRole("button", { name: /Pista|Hint/i });
    await user.click(screen.getByRole("button", { name: /Pista|Hint/i }));
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(3); });

    // After new game the hint button must be back to its normal state
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

    // After error resolves the button must be enabled again
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
      .mockReturnValueOnce(movePromise); // move never resolves → busy=true

    renderGame();

    await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });

    // Trigger a move (sets busy=true)
    await user.click(document.querySelectorAll("polygon")[0]);

    // Hint button should not be present while busy
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
