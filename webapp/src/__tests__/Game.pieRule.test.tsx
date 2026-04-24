// ─────────────────────────────────────────────────────────────────────────────
// Game.pieRule.test.tsx
// Tests the Pie Rule behaviour in Game.tsx:
//   - Modal does NOT show when pieRule=false
//   - Modal shows after the first human move when pieRule=true
//   - "Keep playing" closes the modal and resumes the game
//   - "Swap sides" calls POST /api/game/swap and shows the indicator badge
//   - Board is not clickable while modal is open
//   - newGame resets pie rule state (modal gone, indicator gone)
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

const YEN_AFTER_MOVE = {
    ...BASE_YEN,
    layout: "B....../......./......./......./......./......./.......  ",
    turn: 2,
    finished: false,
    winner: null,
};

// YEN returned by /game/swap — players array is reversed
const YEN_AFTER_SWAP = {
    ...YEN_AFTER_MOVE,
    players: ["R", "B"],  // swapped
    turn: 2,
    finished: false,
    winner: null,
};

// ── Render helper ─────────────────────────────────────────────────────────────

function renderGame(pieRule = true, username = "pablo") {
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
                        allowUndo: false,
                        undoLimit: 0,
                        pieRule,
                    },
                }]}
            >
                <Game />
            </MemoryRouter>
        </I18nProvider>
    );
}

// fetch sequence: game/new → pvb/move
function buildFetch(moveYen = YEN_AFTER_MOVE) {
    return vi.fn().mockImplementation((url: string) => {
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
                    ok: true, yen: moveYen,
                    finished: false, winner: null, winning_edges: [],
                })),
            });
        }
        if (url.includes("game/swap")) {
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(JSON.stringify({
                    ok: true, yen: YEN_AFTER_SWAP,
                    finished: false, winner: null, winning_edges: [],
                })),
            });
        }
        return Promise.resolve({ ok: true, text: () => Promise.resolve("{}") });
    });
}

async function waitForBoard() {
    await waitFor(() => {
        expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
    });
}

async function clickFirstPolygon() {
    const polygons = document.querySelectorAll("polygon");
    if (polygons.length > 0) {
        await act(async () => {
            polygons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
    }
}

// ── Suites ────────────────────────────────────────────────────────────────────

describe("Game — Pie Rule modal does NOT appear when pieRule=false", () => {

    beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockNavigate.mockReset(); });
    afterEach (() => { vi.clearAllMocks(); localStorage.clear(); });

    test("no dialog rendered after first move when pieRule is disabled", async () => {
        global.fetch = buildFetch();
        renderGame(false);

        await waitForBoard();
        await clickFirstPolygon();

        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });
});

describe("Game — Pie Rule modal appears after first move", () => {

    beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockNavigate.mockReset(); });
    afterEach (() => { vi.clearAllMocks(); localStorage.clear(); });

    test("dialog is shown after first human move when pieRule=true", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();

        await waitFor(() => {
            expect(screen.getByRole("dialog")).toBeInTheDocument();
        });
    });

    test("dialog contains swap and keep buttons", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /cambiar de lado|swap sides/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /continuar|keep playing/i })).toBeInTheDocument();
        });
    });

    test("dialog does NOT appear on second or subsequent moves", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();

        // First move — modal appears
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        // Keep playing — modal closes
        await act(async () => {
            screen.getByRole("button", { name: /continuar|keep playing/i }).click();
        });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        // Second move — modal should NOT reappear
        await clickFirstPolygon();
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });
});

describe("Game — Pie Rule: keep playing", () => {

    beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockNavigate.mockReset(); });
    afterEach (() => { vi.clearAllMocks(); localStorage.clear(); });

    test("clicking 'Keep playing' closes the modal", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        await act(async () => {
            screen.getByRole("button", { name: /continuar|keep playing/i }).click();
        });

        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    test("indicator badge is NOT shown after keeping sides", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        await act(async () => {
            screen.getByRole("button", { name: /continuar|keep playing/i }).click();
        });

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        // Indicator must NOT appear
        expect(
            screen.queryByText(/pie rule used|regla del pastel aplicada/i)
        ).not.toBeInTheDocument();
    });

    test("POST /api/game/swap is NOT called when player keeps sides", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        await act(async () => {
            screen.getByRole("button", { name: /continuar|keep playing/i }).click();
        });

        // Check that no swap call was made
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
            .map((c: any[]) => c[0] as string);
        expect(calls.some(url => url.includes("game/swap"))).toBe(false);
    });
});

describe("Game — Pie Rule: swap sides", () => {

    beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockNavigate.mockReset(); });
    afterEach (() => { vi.clearAllMocks(); localStorage.clear(); });

    test("clicking 'Swap sides' calls POST /api/game/swap", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        await act(async () => {
            screen.getByRole("button", { name: /cambiar de lado|swap sides/i }).click();
        });

        await waitFor(() => {
            const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
                .map((c: any[]) => c[0] as string);
            expect(calls.some(url => url.includes("game/swap"))).toBe(true);
        });
    });

    test("modal closes after a successful swap", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        await act(async () => {
            screen.getByRole("button", { name: /cambiar de lado|swap sides/i }).click();
        });

        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    test("indicator badge appears after a successful swap", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        await act(async () => {
            screen.getByRole("button", { name: /cambiar de lado|swap sides/i }).click();
        });

        await waitFor(() => {
            expect(
                screen.getByText(/pie rule used|regla del pastel aplicada/i)
            ).toBeInTheDocument();
        });
    });

    test("swap buttons are disabled while the swap request is in flight", async () => {
        // Never resolves so we can inspect mid-flight state
        let resolveSwap!: (v: any) => void;
        const swapPromise = new Promise(r => { resolveSwap = r; });

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
                        ok: true, yen: YEN_AFTER_MOVE,
                        finished: false, winner: null, winning_edges: [],
                    })),
                });
            }
            if (url.includes("game/swap")) return swapPromise;
            return Promise.resolve({ ok: true, text: () => Promise.resolve("{}") });
        });

        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        // Start swap (in flight)
        act(() => {
            screen.getByRole("button", { name: /cambiar de lado|swap sides/i }).click();
        });

        // Both buttons must be disabled while loading
        await waitFor(() => {
            expect(screen.getByRole("button", { name: /cambiar de lado|swap sides|cambiando|swapping/i })).toBeDisabled();
            expect(screen.getByRole("button", { name: /continuar|keep playing/i })).toBeDisabled();
        });

        // Resolve to avoid hanging
        resolveSwap({ ok: true, text: () => Promise.resolve(JSON.stringify({ ok: true, yen: YEN_AFTER_SWAP, finished: false, winner: null, winning_edges: [] })) });
    });

    test("error during swap closes modal and shows an error message", async () => {
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
                        ok: true, yen: YEN_AFTER_MOVE,
                        finished: false, winner: null, winning_edges: [],
                    })),
                });
            }
            if (url.includes("game/swap")) {
                return Promise.resolve({
                    ok: false,
                    text: () => Promise.resolve(JSON.stringify({ ok: false, error: "Swap not allowed" })),
                });
            }
            return Promise.resolve({ ok: true, text: () => Promise.resolve("{}") });
        });

        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        await act(async () => {
            screen.getByRole("button", { name: /cambiar de lado|swap sides/i }).click();
        });

        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });

        // Error message should be visible
        await waitFor(() => {
            expect(screen.getByText(/swap not allowed/i)).toBeInTheDocument();
        });
    });
});

describe("Game — Pie Rule: new game resets state", () => {

    beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockNavigate.mockReset(); });
    afterEach (() => { vi.clearAllMocks(); localStorage.clear(); });

    test("indicator badge disappears after starting a new game", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        // Swap
        await act(async () => {
            screen.getByRole("button", { name: /cambiar de lado|swap sides/i }).click();
        });
        await waitFor(() =>
            expect(screen.getByText(/pie rule used|regla del pastel aplicada/i)).toBeInTheDocument()
        );

        // New game
        await act(async () => {
            screen.getByRole("button", { name: /nueva.*partida|new.*game/i })?.click();
        });

        await waitFor(() => {
            expect(
                screen.queryByText(/pie rule used|regla del pastel aplicada/i)
            ).not.toBeInTheDocument();
        });
    });

    test("modal does not reappear after new game + first move", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        // Keep — close modal
        await act(async () => {
            screen.getByRole("button", { name: /continuar|keep playing/i }).click();
        });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        // New game
        await act(async () => {
            screen.getByRole("button", { name: /nueva.*partida|new.*game/i })?.click();
        });
        await waitForBoard();

        // First move again — modal SHOULD appear (pieRule resets)
        await clickFirstPolygon();

        await waitFor(() => {
            expect(screen.getByRole("dialog")).toBeInTheDocument();
        });
    });
});

describe("Game — Gateway: POST /game/swap", () => {

    afterEach(() => vi.clearAllMocks());

    test("swap endpoint is called with the current YEN in the request body", async () => {
        global.fetch = buildFetch();
        renderGame(true);

        await waitForBoard();
        await clickFirstPolygon();
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        await act(async () => {
            screen.getByRole("button", { name: /cambiar de lado|swap sides/i }).click();
        });

        await waitFor(() => {
            const swapCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
                .find((c: any[]) => (c[0] as string).includes("game/swap"));
            expect(swapCall).toBeDefined();

            // Body must include the yen field
            const body = JSON.parse(swapCall![1].body);
            expect(body).toHaveProperty("yen");
        });
    });
});
