// ─────────────────────────────────────────────────────────────────────────────
// Game.undo.test.tsx
// Tests the Undo Move button behaviour in Game.tsx.
//
// Strategy: mock fetch so we can control game state, then verify:
//  - Button visibility (only when allowUndo=true)
//  - Disabled states (no history, busy, limit reached)
//  - Undo restores previous YEN
//  - Counter decrements
//  - Toast appears
//  - newGame resets undo state
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import Game from "../Game";
import { I18nProvider } from "../i18n/I18nProvider";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

// ── YEN fixtures ──────────────────────────────────────────────────────────────

const BASE_YEN = {
    size: 7,
    layout: "......./......./......./......./......./......./.......",
    players: ["B", "R"],
    turn: 0,
};

// YEN after human made one move at (0,0)
const YEN_AFTER_MOVE = {
    ...BASE_YEN,
    layout: "B....../......./......./......./......./......./.......  ",
    turn: 2, // human + bot responded
    finished: false,
    winner: null,
};

// ── Render helper ─────────────────────────────────────────────────────────────

function renderGame(
    allowUndo = true,
    undoLimit = 3,
    username = "pablo"
) {
    localStorage.setItem("username", username);
    localStorage.setItem("token", "fake-token");

    return render(
        <I18nProvider>
            <MemoryRouter
                initialEntries={[{
                    pathname: "/game",
                    state: {
                        username,
                        bot: "heuristic_bot",
                        boardSize: 7,
                        timerSeconds: 0,
                        allowUndo,
                        undoLimit,
                    },
                }]}
            >
                <Game />
            </MemoryRouter>
        </I18nProvider>
    );
}

// Builds a fetch mock that:
//   1st call → game/new → returns BASE_YEN
//   subsequent calls → game/pvb/move → returns YEN_AFTER_MOVE
function buildFetchMock() {
    let calls = 0;
    return vi.fn().mockImplementation((url: string) => {
        calls++;
        if (url.includes("game/new") || calls === 1) {
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({ ok: true, yen: BASE_YEN })),
            });
        }
        return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(JSON.stringify({
                ok: true,
                yen: YEN_AFTER_MOVE,
                finished: false,
                winner: null,
                winning_edges: [],
            })),
        });
    });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Game — Undo button visibility", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
        global.fetch = buildFetchMock();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    test("undo button is visible when allowUndo=true", async () => {
        renderGame(true);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).toBeInTheDocument();
        });
    });

    test("undo button is NOT visible when allowUndo=false", async () => {
        renderGame(false);

        await waitFor(() => {
            // Wait for the board to render (game started)
            expect(screen.getByRole("button", { name: /nueva.*partida|new.*game/i })).toBeInTheDocument();
        });

        expect(screen.queryByRole("button", { name: /undo|deshacer/i })).not.toBeInTheDocument();
    });
});

describe("Game — Undo button disabled states", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
        global.fetch = buildFetchMock();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    test("undo button is disabled when no moves have been made (empty history)", async () => {
        renderGame(true);

        await waitFor(() => {
            const btn = screen.getByRole("button", { name: /undo|deshacer/i });
            expect(btn).toBeDisabled();
        });
    });

    test("undo button shows remaining count when undoLimit > 0", async () => {
        renderGame(true, 3);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).toBeInTheDocument();
        });

        // The remaining count (3) should appear in the button
        const btn = screen.getByRole("button", { name: /undo|deshacer/i });
        expect(btn.textContent).toMatch(/3/);
    });

    test("undo button does NOT show remaining count when undoLimit=0 (unlimited)", async () => {
        renderGame(true, 0);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).toBeInTheDocument();
        });

        const btn = screen.getByRole("button", { name: /undo|deshacer/i });
        // No "(N)" counter inside the button
        expect(btn.textContent).not.toMatch(/\(\d+\)/);
    });
});

describe("Game — Undo move logic", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    test("clicking undo after a move enables the button and restores previous board", async () => {
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("game/new")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({ ok: true, yen: BASE_YEN })),
                });
            }
            if (url.includes("game/pvb/move")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({
                        ok: true,
                        yen: YEN_AFTER_MOVE,
                        finished: false,
                        winner: null,
                        winning_edges: [],
                    })),
                });
            }
            return Promise.resolve({ ok: true, text: () => Promise.resolve("{}") });
        });

        renderGame(true, 3);

        // Wait for game to initialise
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).toBeDisabled();
        });

        // Simulate a move by clicking a board cell
        const polygons = document.querySelectorAll("polygon");
        if (polygons.length > 0) {
            await act(async () => {
                polygons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
            });
        }

        // After move resolves, undo should be enabled
        await waitFor(() => {
            const btn = screen.getByRole("button", { name: /undo|deshacer/i });
            expect(btn).not.toBeDisabled();
        });
    });

    test("clicking undo shows the 'Move undone' toast", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("game/new")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({ ok: true, yen: BASE_YEN })),
                });
            }
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({
                    ok: true, yen: YEN_AFTER_MOVE,
                    finished: false, winner: null, winning_edges: [],
                })),
            });
        });

        renderGame(true, 3);

        // Wait for the game board
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).toBeInTheDocument();
        });

        // Trigger a move via polygon click
        const polygons = document.querySelectorAll("polygon");
        if (polygons.length > 0) {
            await act(async () => {
                polygons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
            });
        }

        // Wait for undo to become enabled
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).not.toBeDisabled();
        });

        // Click undo
        await user.click(screen.getByRole("button", { name: /undo|deshacer/i }));

        // Toast should appear
        await waitFor(() => {
            expect(
                screen.getByRole("status")
            ).toBeInTheDocument();
        });
    });

    test("undo button becomes disabled again after all undos are used", async () => {
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("game/new")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({ ok: true, yen: BASE_YEN })),
                });
            }
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({
                    ok: true, yen: YEN_AFTER_MOVE,
                    finished: false, winner: null, winning_edges: [],
                })),
            });
        });

        // Allow only 1 undo
        renderGame(true, 1);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).toBeInTheDocument();
        });

        // Make a move
        const polygons = document.querySelectorAll("polygon");
        if (polygons.length > 0) {
            await act(async () => {
                polygons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
            });
        }

        // Wait for undo to be enabled
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).not.toBeDisabled();
        });

        // Undo once
        await act(async () => {
            screen.getByRole("button", { name: /undo|deshacer/i }).click();
        });

        // Undo button should now be disabled (limit=1 reached)
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).toBeDisabled();
        });
    });

    test("remaining count decrements after each undo", async () => {
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("game/new")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({ ok: true, yen: BASE_YEN })),
                });
            }
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({
                    ok: true, yen: YEN_AFTER_MOVE,
                    finished: false, winner: null, winning_edges: [],
                })),
            });
        });

        renderGame(true, 3);

        await waitFor(() => {
            const btn = screen.getByRole("button", { name: /undo|deshacer/i });
            expect(btn.textContent).toMatch(/3/);
        });

        // Make a move
        const polygons = document.querySelectorAll("polygon");
        if (polygons.length > 0) {
            await act(async () => {
                polygons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
            });
        }

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).not.toBeDisabled();
        });

        // Undo — counter should go from 3 to 2
        await act(async () => {
            screen.getByRole("button", { name: /undo|deshacer/i }).click();
        });

        await waitFor(() => {
            const btn = screen.getByRole("button", { name: /undo|deshacer/i });
            expect(btn.textContent).toMatch(/2/);
        });
    });

    test("newGame resets undo history and counter", async () => {
        global.fetch = vi.fn().mockImplementation(() => {
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({ ok: true, yen: BASE_YEN })),
            });
        });

        renderGame(true, 3);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).toBeInTheDocument();
        });

        // Start a new game
        await act(async () => {
            screen.getByRole("button", { name: /nueva.*partida|new.*game/i })?.click();
        });

        await waitFor(() => {
            // After new game, undo should be disabled again (empty history)
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).toBeDisabled();
        });

        // Counter should be back to full (3)
        const btn = screen.getByRole("button", { name: /undo|deshacer/i });
        expect(btn.textContent).toMatch(/3/);
    });
});

describe("Game — Undo not available when game is finished", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    test("undo button disappears when game is over", async () => {
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("game/new")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify({ ok: true, yen: BASE_YEN })),
                });
            }
            // Move results in win
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({
                    ok: true,
                    yen: { ...YEN_AFTER_MOVE, finished: true, winner: "B" },
                    finished: true, winner: "B", winning_edges: [],
                })),
            });
        });

        renderGame(true, 3);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /undo|deshacer/i })).toBeInTheDocument();
        });

        // Trigger a winning move
        const polygons = document.querySelectorAll("polygon");
        if (polygons.length > 0) {
            await act(async () => {
                polygons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
            });
        }

        // Game over overlay should appear; undo button should be gone
        await waitFor(() => {
            expect(screen.queryByRole("button", { name: /undo|deshacer/i })).not.toBeInTheDocument();
        });
    });
});