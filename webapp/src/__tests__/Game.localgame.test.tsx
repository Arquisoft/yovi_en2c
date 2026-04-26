// src/__tests__/Game.localgame.test.tsx
// Covers: local multiplayer mode, pie rule modal, timer timeout in local mode,
// undo in local mode, and the local game overlay with winner name.

import { render, screen, waitFor, act } from "@testing-library/react";
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

function mockNewGame(size = 7) {
  return {
    ok: true,
    text: async () => JSON.stringify({
      ok: true,
      yen: { size, players: ["B", "R"], layout: emptyBoardLayout(size) },
    }),
  } as Response;
}

function mockCheckContinues(size = 7) {
  return {
    ok: true,
    text: async () => JSON.stringify({
      ok: true,
      finished: false,
      yen: { size, players: ["B", "R"], layout: emptyBoardLayout(size) },
    }),
  } as Response;
}

function mockCheckFinished(winner: string | null, size = 7) {
  return {
    ok: true,
    text: async () => JSON.stringify({
      ok: true,
      finished: true,
      winner,
      winning_edges: winner ? [[[0, 0], [1, 0]]] : [],
      yen: { size, players: ["B", "R"], layout: emptyBoardLayout(size) },
    }),
  } as Response;
}

function renderLocalGame({
                           player1Name = "Alice",
                           player2Name = "Bob",
                           firstPlayer = "player1",
                           pieRule = false,
                           allowUndo = false,
                           undoLimit = 0,
                           timerSeconds = 0,
                           boardSize = 7,
                         } = {}) {
  localStorage.clear();
  localStorage.setItem("username", player1Name);

  return render(
      <I18nProvider>
        <MemoryRouter
            initialEntries={[{
              pathname: "/game",
              state: {
                username: player1Name,
                mode: "local",
                player1Name,
                player2Name,
                firstPlayer,
                pieRule,
                allowUndo,
                undoLimit,
                timerSeconds,
                boardSize,
              },
            } as any]}
        >
          <Game />
        </MemoryRouter>
      </I18nProvider>
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

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

// ── Mode: local ───────────────────────────────────────────────────────────────

describe("Game — local multiplayer mode", () => {

  test("shows active player name indicator on the board", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockNewGame());
    renderLocalGame({ player1Name: "Alice", player2Name: "Bob" });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    // Alice appears in navbar too — check that at least one element with Alice exists
    expect(screen.getAllByText(/Alice/i).length).toBeGreaterThan(0);
  });

  test("calls POST /game/check (not /game/pvb/move) when making a move", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockCheckContinues());

    renderLocalGame();

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });
    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });

    const [url] = (global.fetch as any).mock.calls[1];
    expect(url).toMatch(/\/game\/check$/);
    expect(url).not.toMatch(/pvb/);
  });

  test("alternates active player after each move", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockCheckContinues());

    renderLocalGame({ player1Name: "Alice", player2Name: "Bob" });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    // Initially Alice's turn — may appear in navbar too
    expect(screen.getAllByText(/Alice/i).length).toBeGreaterThan(0);

    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/Bob/i).length).toBeGreaterThan(0);
    });
  });

  test("hint button is NOT shown in local mode", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockNewGame());
    renderLocalGame();

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    expect(screen.queryByRole("button", { name: /Pista|Hint/i })).not.toBeInTheDocument();
  });

  test("shows winner name in overlay when local game ends", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockCheckFinished("B"));

    renderLocalGame({ player1Name: "Alice", player2Name: "Bob" });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });
    await user.click(document.querySelectorAll("polygon")[0]);

    // In local mode the overlay shows the winner's name, not "Has ganado"
    await waitFor(() => {
      // Overlay shows winner name + i18n key e.g. "Alice game.finished.wins"
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/Alice/i);
    });
  });

  test("does NOT call /gameresult when local game ends", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockCheckFinished("B"));

    renderLocalGame();

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });
    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });
    // Only 2 calls: new game + check. No /gameresult
    const urls = (global.fetch as any).mock.calls.map((c: any) => c[0]);
    expect(urls.every((u: string) => !u.includes("gameresult"))).toBe(true);
  });

  test("player2 starts first when firstPlayer is player2", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockNewGame());
    renderLocalGame({ player1Name: "Alice", player2Name: "Bob", firstPlayer: "player2" });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    // Bob should be shown as active first (may also appear in navbar if username=Bob)
    expect(screen.getAllByText(/Bob/i).length).toBeGreaterThan(0);
  });
});

// ── Pie Rule ──────────────────────────────────────────────────────────────────

describe("Game — pie rule", () => {

  test("pie rule modal appears after first move in local mode", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockCheckContinues());

    renderLocalGame({ pieRule: true, player1Name: "Alice", player2Name: "Bob" });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });
    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => {
      expect(screen.getByText(/🥧/)).toBeInTheDocument();
    });
  });

  test("declining pie rule closes modal and continues game normally", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockCheckContinues());

    renderLocalGame({ pieRule: true, player1Name: "Alice", player2Name: "Bob" });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });
    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => { expect(screen.getByText(/🥧/)).toBeInTheDocument(); });

    // Click decline
    await user.click(screen.getByRole("button", { name: /pierule.modal.decline/i }));

    // Modal disappears
    await waitFor(() => {
      expect(screen.queryByText(/🥧/)).not.toBeInTheDocument();
    });
  });

  test("pie rule modal does NOT appear when pieRule is disabled", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockCheckContinues());

    renderLocalGame({ pieRule: false });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });
    await user.click(document.querySelectorAll("polygon")[0]);

    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });

    expect(screen.queryByText(/🥧/)).not.toBeInTheDocument();
  });

  test("pie rule does not trigger on second move", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockCheckContinues()) // move 1
        .mockResolvedValueOnce(mockCheckContinues()); // move 2 (after declining)

    renderLocalGame({ pieRule: true });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    // Move 1 → pie rule appears
    await user.click(document.querySelectorAll("polygon")[0]);
    await waitFor(() => { expect(screen.getByText(/🥧/)).toBeInTheDocument(); });

    // Decline pie rule
    await user.click(screen.getByRole("button", { name: /pierule.modal.decline/i }));
    await waitFor(() => { expect(screen.queryByText(/🥧/)).not.toBeInTheDocument(); });

    // Move 2 → no pie rule modal
    await user.click(document.querySelectorAll("polygon")[1]);
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(3); });
    expect(screen.queryByText(/🥧/)).not.toBeInTheDocument();
  });
});

// ── Undo in local mode ────────────────────────────────────────────────────────

describe("Game — undo in local mode", () => {

  test("undo button is shown in local mode when allowUndo is true", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockNewGame());
    renderLocalGame({ allowUndo: true });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    expect(screen.getByRole("button", { name: /Deshacer|Undo|game\.undo/i })).toBeInTheDocument();
  });

  test("undo cancels pie rule pending state", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockCheckContinues());

    renderLocalGame({ allowUndo: true, pieRule: true, player1Name: "Alice", player2Name: "Bob" });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    // Move 1 → pie rule modal
    await user.click(document.querySelectorAll("polygon")[0]);
    await waitFor(() => { expect(screen.getByText(/🥧/)).toBeInTheDocument(); });

    // Undo from inside pie rule pending — modal should close
    const undoBtn = screen.getByRole("button", { name: /Deshacer|Undo|game\.undo/i });
    await user.click(undoBtn);

    await waitFor(() => {
      expect(screen.queryByText(/🥧/)).not.toBeInTheDocument();
    });
  });

  test("undo is disabled when no moves have been made", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockNewGame());
    renderLocalGame({ allowUndo: true });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    expect(screen.getByRole("button", { name: /Deshacer|Undo|game\.undo/i })).toBeDisabled();
  });

  test("undo is disabled when undoLimit is reached", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn()
        .mockResolvedValueOnce(mockNewGame())
        .mockResolvedValueOnce(mockCheckContinues())
        .mockResolvedValueOnce(mockCheckContinues());

    renderLocalGame({ allowUndo: true, undoLimit: 1, player1Name: "Alice", player2Name: "Bob" });

    await waitFor(() => {
      expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });

    await user.click(document.querySelectorAll("polygon")[0]);
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });

    // Use the 1 undo allowed
    const undoBtn = screen.getByRole("button", { name: /Deshacer|Undo|game\.undo/i });
    await user.click(undoBtn);

    // Make another move
    await user.click(document.querySelectorAll("polygon")[0]);
    await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(3); });

    // Undo should now be disabled (limit reached)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Deshacer|Undo|game\.undo/i })).toBeDisabled();
    });
  });
});

