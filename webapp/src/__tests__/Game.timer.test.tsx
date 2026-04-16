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

// Renders with timer enabled. Uses selective fake timers so Promises still resolve.
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
        // Only fake setInterval/clearInterval — leaves Promise/queueMicrotask intact
        // so fetch mocks still resolve normally.
        vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
        vi.clearAllMocks();
        mockNavigate.mockReset();
        global.ResizeObserver = class {
            observe() {} unobserve() {} disconnect() {}
        } as any;
    });

    afterEach(() => {
        vi.useRealTimers();
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

    // ── Countdown decrements ──────────────────────────────────────────────────

    test("timer counts down from timerSeconds", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);
        await waitForBoard();

        // At start the label shows 30
        expect(screen.getByText("30")).toBeInTheDocument();

        act(() => { vi.advanceTimersByTime(5000); });

        await waitFor(() => {
            expect(screen.getByText("25")).toBeInTheDocument();
        });
    });

    // ── Timeout triggers defeat ───────────────────────────────────────────────

    test("shows timeout game-over overlay when timer reaches 0", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(5);
        await waitForBoard();

        act(() => { vi.advanceTimersByTime(6000); });

        await waitFor(() => {
            expect(screen.getByText(/Se acabó el tiempo|Time's up/i)).toBeInTheDocument();
        });
    });

    test("shows ⏰ emoji in game-over overlay on timeout", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(5);
        await waitForBoard();

        act(() => { vi.advanceTimersByTime(6000); });

        await waitFor(() => {
            expect(screen.getByText("⏰")).toBeInTheDocument();
        });
    });

    test("shows timeout description in overlay", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(5);
        await waitForBoard();

        act(() => { vi.advanceTimersByTime(6000); });

        await waitFor(() => {
            expect(screen.getByText(/No realizaste|didn't make a move/i)).toBeInTheDocument();
        });
    });

    // ── Timeout saves result with endReason ───────────────────────────────────

    test("saves game result with endReason timeout on timeout defeat", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValue(mockSaveResult());

        renderGameWithTimer(5);
        await waitForBoard();

        act(() => { vi.advanceTimersByTime(6000); });

        await waitFor(() => {
            expect(screen.getByText(/Se acabó el tiempo|Time's up/i)).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        const body = JSON.parse((global.fetch as any).mock.calls[1][1].body);
        expect(body.result).toBe("loss");
        expect(body.endReason).toBe("timeout");
        expect(body.gameMode).toBe("pvb");
    });

    // ── Timer hidden after game over ──────────────────────────────────────────

    test("timer panel is hidden after normal game over", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

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

    // ── Timer resets after move ───────────────────────────────────────────────

    test("timer resets to full value after a successful move", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValue(mockMoveContinues());

        renderGameWithTimer(30);
        await waitForBoard();

        // Advance 10s
        act(() => { vi.advanceTimersByTime(10000); });

        await waitFor(() => {
            expect(screen.getByText("20")).toBeInTheDocument();
        });

        // Make a move — timer resets to 30 after bot responds
        await user.click(document.querySelectorAll("polygon")[0]);

        await waitFor(() => {
            expect(screen.getByText("30")).toBeInTheDocument();
        });
    });

    // ── New game resets timer ─────────────────────────────────────────────────

    test("starting a new game resets the timer", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);
        await waitForBoard();

        act(() => { vi.advanceTimersByTime(15000); });

        await waitFor(() => {
            expect(screen.getByText("15")).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

        await waitFor(() => {
            expect(screen.getByText("30")).toBeInTheDocument();
        });
    });

    // ── Timeout does not fire when game already over ──────────────────────────

    test("timeout does not override an already-finished game", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockMoveFinished("B"))
            .mockResolvedValue(mockSaveResult());

        renderGameWithTimer(5);
        await waitForBoard();

        await user.click(document.querySelectorAll("polygon")[0]);

        await waitFor(() => {
            expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument();
        });

        // Advance past timer — win overlay must remain
        act(() => { vi.advanceTimersByTime(10000); });

        expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument();
        expect(screen.queryByText(/Se acabó el tiempo|Time's up/i)).not.toBeInTheDocument();
    });

    // ── SVG color: green when > 50% ───────────────────────────────────────────

    test("timer SVG progress circle uses green color when > 50% time left", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);
        await waitForBoard();

        // At 30/30 = 100% the progress circle is green
        await waitFor(() => {
            const circles = document.querySelectorAll("circle[stroke]");
            const greenCircle = Array.from(circles).find(
                (c) => c.getAttribute("stroke") === "var(--ok)"
            );
            expect(greenCircle).toBeTruthy();
        });
    });

    // ── SVG color: red when <= 25% ────────────────────────────────────────────

    test("timer SVG progress circle uses danger color when <= 25% time left", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);
        await waitForBoard();

        // 23s elapsed → 7s left = 23% → red
        act(() => { vi.advanceTimersByTime(23000); });

        await waitFor(() => {
            const circles = document.querySelectorAll("circle[stroke]");
            const dangerCircle = Array.from(circles).find(
                (c) => c.getAttribute("stroke") === "var(--danger)"
            );
            expect(dangerCircle).toBeTruthy();
        });
    });
});