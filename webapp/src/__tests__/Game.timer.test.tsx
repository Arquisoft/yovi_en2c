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

function mockNewGame(size = 7) {
    return {
        ok: true,
        text: async () => JSON.stringify({
            ok: true,
            yen: { size, players: ["B", "R"], layout: emptyBoardLayout(size) },
        }),
    } as Response;
}

function mockMoveFinished(winner: string | null = "R", size = 7) {
    return {
        ok: true,
        text: async () => JSON.stringify({
            ok: true, finished: true, winner,
            winning_edges: winner ? [[[0, 0], [1, 0]]] : [],
            yen: { size, players: ["B", "R"], layout: emptyBoardLayout(size) },
        }),
    } as Response;
}

function mockMoveContinues(size = 7) {
    return {
        ok: true,
        text: async () => JSON.stringify({
            ok: true, finished: false,
            yen: { size, players: ["B", "R"], layout: emptyBoardLayout(size) },
        }),
    } as Response;
}

function mockSaveResult() {
    return { ok: true, text: async () => JSON.stringify({ success: true }) } as Response;
}

function renderGameWithTimer(timerSeconds = 30, username = "Pablo") {
    localStorage.clear();
    localStorage.setItem("username", username);
    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={[{
                pathname: "/game",
                state: { username, bot: "heuristic_bot", boardSize: 7, timerSeconds },
            } as any]}>
                <Game />
            </MemoryRouter>
        </I18nProvider>
    );
}

function renderGameNoTimer(username = "Pablo") {
    localStorage.clear();
    localStorage.setItem("username", username);
    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={[{
                pathname: "/game",
                state: { username, bot: "heuristic_bot", boardSize: 7, timerSeconds: 0 },
            } as any]}>
                <Game />
            </MemoryRouter>
        </I18nProvider>
    );
}

async function waitForBoard() {
    await waitFor(
        () => expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0),
        { timeout: 4000 }
    );
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Game — Turn Timer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockReset();
        global.ResizeObserver = class {
            observe() {} unobserve() {} disconnect() {}
        } as any;
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Timer not shown when disabled ─────────────────────────────────────────

    test("timer panel is NOT rendered when timerSeconds is 0", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameNoTimer();
        await waitForBoard();

        expect(screen.queryByText(/Tu turno|Your turn/i)).not.toBeInTheDocument();
        expect(screen.queryByText("🤖")).not.toBeInTheDocument();
    });

    // ── Timer shown when enabled ──────────────────────────────────────────────

    test("timer panel IS rendered when timerSeconds > 0", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);
        await waitForBoard();

        expect(screen.getByText(/Tu turno|Your turn/i)).toBeInTheDocument();
    });

    test("shows 'Your turn' label when it is the player turn", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);
        await waitForBoard();

        expect(screen.getByText(/Tu turno|Your turn/i)).toBeInTheDocument();
    });

    // ── Timer shows initial value ─────────────────────────────────────────────

    test("timer shows initial timerSeconds value on render", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);
        await waitForBoard();

        expect(screen.getByText("30")).toBeInTheDocument();
    });

    test("timer shows correct value for 15 second timer", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(15);
        await waitForBoard();

        expect(screen.getByText("15")).toBeInTheDocument();
    });

    test("timer shows correct value for 60 second timer", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(60);
        await waitForBoard();

        expect(screen.getByText("60")).toBeInTheDocument();
    });

    // ── Bot thinking shows bot timer ──────────────────────────────────────────

    test("shows bot thinking label while move is in flight", async () => {
        let resolveFetch!: (v: any) => void;
        const pendingFetch = new Promise<Response>((res) => { resolveFetch = res; });

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockReturnValueOnce(pendingFetch);

        renderGameWithTimer(30);
        await waitForBoard();

        document.querySelectorAll("polygon")[0]
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));

        await waitFor(() => {
            expect(screen.getByText(/pensando|thinking/i)).toBeInTheDocument();
        });

        resolveFetch(mockMoveContinues());
    });

    test("BotTimer renders robot emoji while bot is thinking", async () => {
        let resolveFetch!: (v: any) => void;
        const pendingFetch = new Promise<Response>((res) => { resolveFetch = res; });

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockReturnValueOnce(pendingFetch);

        renderGameWithTimer(30);
        await waitForBoard();

        document.querySelectorAll("polygon")[0]
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));

        await waitFor(() => {
            expect(screen.getByText("🤖")).toBeInTheDocument();
        });

        resolveFetch(mockMoveContinues());
    });

    test("'Your turn' label disappears while bot is thinking", async () => {
        let resolveFetch!: (v: any) => void;
        const pendingFetch = new Promise<Response>((res) => { resolveFetch = res; });

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockReturnValueOnce(pendingFetch);

        renderGameWithTimer(30);
        await waitForBoard();

        expect(screen.getByText(/Tu turno|Your turn/i)).toBeInTheDocument();

        document.querySelectorAll("polygon")[0]
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));

        await waitFor(() => {
            expect(screen.queryByText(/Tu turno|Your turn/i)).not.toBeInTheDocument();
        });

        resolveFetch(mockMoveContinues());
    });

    test("'Your turn' label returns after bot responds", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockMoveContinues());

        renderGameWithTimer(30);
        await waitForBoard();

        await user.click(document.querySelectorAll("polygon")[0]);

        await waitFor(() => {
            expect(screen.getByText(/Tu turno|Your turn/i)).toBeInTheDocument();
        });
    });

    // ── Timer resets after move ───────────────────────────────────────────────

    test("timer resets to full timerSeconds value after a successful move", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockMoveContinues());

        renderGameWithTimer(30);
        await waitForBoard();

        await user.click(document.querySelectorAll("polygon")[0]);

        // After bot responds the timer resets to 30
        await waitFor(() => {
            expect(screen.getByText("30")).toBeInTheDocument();
        });
    });

    // ── Timer hidden after game over ──────────────────────────────────────────

    test("timer panel is hidden after normal game over", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockMoveFinished("R"))
            .mockResolvedValue(mockSaveResult());

        renderGameWithTimer(30);
        await waitForBoard();

        await user.click(document.querySelectorAll("polygon")[0]);

        await waitFor(() => {
            expect(screen.getByText(/Has perdido|You lost/i)).toBeInTheDocument();
        });

        expect(screen.queryByText(/Tu turno|Your turn/i)).not.toBeInTheDocument();
    });

    // ── New game resets timer ─────────────────────────────────────────────────

    test("starting a new game shows the timer panel again", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockMoveFinished("R"))
            .mockResolvedValue(mockNewGame());

        renderGameWithTimer(30);
        await waitForBoard();

        await user.click(document.querySelectorAll("polygon")[0]);

        await waitFor(() => {
            expect(screen.getByText(/Has perdido|You lost/i)).toBeInTheDocument();
        });

        await user.click(screen.getAllByRole("button", { name: /Nueva partida|New game/i })[0]);

        await waitFor(() => {
            expect(screen.getByText(/Tu turno|Your turn/i)).toBeInTheDocument();
        });

        expect(screen.getByText("30")).toBeInTheDocument();
    });

    // ── Timeout overlay shown ─────────────────────────────────────────────────
    // We test the timeout overlay by rendering with timerSeconds=1
    // and waiting for the real 1-second interval to fire.

    test("shows timeout game-over overlay when timer reaches 0", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(1);
        await waitForBoard();

        await waitFor(
            () => expect(screen.getByText(/Se acabó el tiempo|Time's up/i)).toBeInTheDocument(),
            { timeout: 4000 }
        );
    }, 8000);

    test("shows ⏰ emoji in game-over overlay on timeout", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(1);
        await waitForBoard();

        await waitFor(
            () => expect(screen.getByText("⏰")).toBeInTheDocument(),
            { timeout: 4000 }
        );
    }, 8000);

    test("shows timeout description in overlay", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(1);
        await waitForBoard();

        await waitFor(
            () => expect(screen.getByText(/No realizaste|didn't make a move/i)).toBeInTheDocument(),
            { timeout: 4000 }
        );
    }, 8000);

    test("saves game result with endReason timeout on timeout defeat", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValue(mockSaveResult());

        renderGameWithTimer(1);
        await waitForBoard();

        await waitFor(
            () => expect(screen.getByText(/Se acabó el tiempo|Time's up/i)).toBeInTheDocument(),
            { timeout: 4000 }
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(2);
        }, { timeout: 4000 });

        const body = JSON.parse((global.fetch as any).mock.calls[1][1].body);
        expect(body.result).toBe("loss");
        expect(body.endReason).toBe("timeout");
        expect(body.gameMode).toBe("pvb");
    }, 10000);

    // ── Timeout does not fire when game already over ──────────────────────────

    test("timeout does not override an already-finished game", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockMoveFinished("B"))
            .mockResolvedValue(mockSaveResult());

        renderGameWithTimer(30);
        await waitForBoard();

        await user.click(document.querySelectorAll("polygon")[0]);

        await waitFor(() => {
            expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument();
        });

        // Timer panel should not be visible (game is over)
        expect(screen.queryByText(/Tu turno|Your turn/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Se acabó el tiempo|Time's up/i)).not.toBeInTheDocument();
    });

    // ── SVG color: green when > 50% ───────────────────────────────────────────

    test("timer SVG progress circle uses green color when > 50% time left", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);
        await waitForBoard();

        await waitFor(() => {
            const circles = document.querySelectorAll("circle[stroke]");
            const greenCircle = Array.from(circles).find(
                (c) => c.getAttribute("stroke") === "var(--ok)"
            );
            expect(greenCircle).toBeTruthy();
        });
    });

    // ── SVG color: red when <= 25% ────────────────────────────────────────────
    // Use timerSeconds=1 and wait for real timeout to push it to 0 (ratio=0 → red)

    test("timer SVG progress circle uses danger color when time is nearly up", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(1);
        await waitForBoard();

        // Wait until the danger circle appears (ratio goes to 0%)
        await waitFor(() => {
            const circles = document.querySelectorAll("circle[stroke]");
            const dangerCircle = Array.from(circles).find(
                (c) => c.getAttribute("stroke") === "var(--danger)"
            );
            expect(dangerCircle).toBeTruthy();
        }, { timeout: 4000 });
    }, 8000);
});