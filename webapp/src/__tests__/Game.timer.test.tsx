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

function renderGameWithTimer(timerSeconds = 30, username = "Pablo", bot = "heuristic_bot", boardSize = 7) {
    localStorage.clear();
    localStorage.setItem("username", username);

    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={[{
                pathname: "/game",
                state: { username, bot, boardSize, timerSeconds },
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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Game — Turn Timer", () => {
    beforeEach(() => {
        vi.useFakeTimers();
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

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        expect(screen.queryByText(/Tu turno|Your turn/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/pensando|thinking/i)).not.toBeInTheDocument();
    });

    // ── Timer shown when enabled ──────────────────────────────────────────────

    test("timer panel IS rendered when timerSeconds > 0", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        expect(screen.getByText(/Tu turno|Your turn/i)).toBeInTheDocument();
    });

    // ── Timer shows player label ──────────────────────────────────────────────

    test("shows 'Your turn' label when it is player turn", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        expect(screen.getByText(/Tu turno|Your turn/i)).toBeInTheDocument();
    });

    // ── Bot thinking shows bot timer ──────────────────────────────────────────

    test("shows bot thinking label while move is in flight", async () => {
        let resolveFetch!: (v: any) => void;
        const pendingFetch = new Promise((res) => { resolveFetch = res; });

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockReturnValueOnce(pendingFetch);

        renderGameWithTimer(30);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        // Click a cell to trigger move fetch (which stays pending)
        const cells = document.querySelectorAll("polygon");
        await act(async () => {
            cells[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(screen.getByText(/pensando|thinking/i)).toBeInTheDocument();

        // Resolve pending fetch to clean up
        resolveFetch(mockMoveContinues());
    });

    // ── Countdown decrements ─────────────────────────────────────────────────

    test("timer counts down from timerSeconds", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        // The timer SVG label shows the current count
        expect(screen.getByText("30")).toBeInTheDocument();

        act(() => { vi.advanceTimersByTime(5000); });

        expect(screen.getByText("25")).toBeInTheDocument();
    });

    // ── Timeout triggers defeat ───────────────────────────────────────────────

    test("shows timeout game-over overlay when timer reaches 0", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockSaveResult());

        renderGameWithTimer(5);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        // Advance past the full timer
        act(() => { vi.advanceTimersByTime(6000); });

        await waitFor(() => {
            expect(screen.getByText(/Se acabó el tiempo|Time's up/i)).toBeInTheDocument();
        });
    });

    test("shows ⏰ emoji in game-over overlay on timeout", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockSaveResult());

        renderGameWithTimer(5);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        act(() => { vi.advanceTimersByTime(6000); });

        await waitFor(() => {
            expect(screen.getByText("⏰")).toBeInTheDocument();
        });
    });

    test("shows timeout description in overlay", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockSaveResult());

        renderGameWithTimer(5);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        act(() => { vi.advanceTimersByTime(6000); });

        await waitFor(() => {
            expect(screen.getByText(/No realizaste|didn't make a move/i)).toBeInTheDocument();
        });
    });

    // ── Timeout saves result with endReason ───────────────────────────────────

    test("saves game result with endReason timeout on timeout defeat", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockSaveResult());

        renderGameWithTimer(5);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        act(() => { vi.advanceTimersByTime(6000); });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        const saveCall = (global.fetch as any).mock.calls[1];
        const body = JSON.parse(saveCall[1].body);

        expect(body.result).toBe("loss");
        expect(body.endReason).toBe("timeout");
        expect(body.gameMode).toBe("pvb");
    });

    // ── Timer resets after move ───────────────────────────────────────────────

    test("timer resets to full value after a successful move", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockMoveContinues());

        renderGameWithTimer(30);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        // Advance 10 seconds — timer should be at 20
        act(() => { vi.advanceTimersByTime(10000); });
        expect(screen.getByText("20")).toBeInTheDocument();

        // Make a move
        const cells = document.querySelectorAll("polygon");
        await user.click(cells[0]);

        // After bot responds, timer resets to 30
        await waitFor(() => {
            expect(screen.getByText("30")).toBeInTheDocument();
        });
    });

    // ── Timer hidden after game over ──────────────────────────────────────────

    test("timer panel is hidden after normal game over", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockMoveFinished("R"))
            .mockResolvedValueOnce(mockSaveResult());

        renderGameWithTimer(30);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        await user.click(document.querySelectorAll("polygon")[0]);

        await waitFor(() => {
            expect(screen.getByText(/Has perdido|You lost/i)).toBeInTheDocument();
        });

        expect(screen.queryByText(/Tu turno|Your turn/i)).not.toBeInTheDocument();
    });

    // ── New game resets timer ─────────────────────────────────────────────────

    test("starting a new game resets the timer", async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockResolvedValueOnce(mockNewGame());

        renderGameWithTimer(30);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        // Advance 15 seconds
        act(() => { vi.advanceTimersByTime(15000); });
        expect(screen.getByText("15")).toBeInTheDocument();

        // Start new game
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
            .mockResolvedValueOnce(mockMoveFinished("B")) // player wins
            .mockResolvedValueOnce(mockSaveResult());

        renderGameWithTimer(5);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        // Player wins before timer runs out
        await user.click(document.querySelectorAll("polygon")[0]);

        await waitFor(() => {
            expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument();
        });

        // Advance past timer — should still show win, not timeout
        act(() => { vi.advanceTimersByTime(10000); });

        expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument();
        expect(screen.queryByText(/Se acabó el tiempo|Time's up/i)).not.toBeInTheDocument();
    });

    // ── TurnTimer SVG color thresholds ────────────────────────────────────────

    test("timer SVG progress circle uses green color when > 50% time left", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        // At 30/30 = 100%, should be green (var(--ok))
        const circles = document.querySelectorAll("circle[stroke]");
        const progressCircle = Array.from(circles).find(
            (c) => c.getAttribute("stroke") === "var(--ok)"
        );
        expect(progressCircle).toBeTruthy();
    });

    test("timer SVG progress circle uses danger color when <= 25% time left", async () => {
        global.fetch = vi.fn().mockResolvedValue(mockNewGame());
        renderGameWithTimer(30);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        // Advance to 7 seconds left (7/30 ≈ 23%) → should be red
        act(() => { vi.advanceTimersByTime(23000); });

        const circles = document.querySelectorAll("circle[stroke]");
        const dangerCircle = Array.from(circles).find(
            (c) => c.getAttribute("stroke") === "var(--danger)"
        );
        expect(dangerCircle).toBeTruthy();
    });

    // ── BotTimer rendered while busy ──────────────────────────────────────────

    test("BotTimer renders robot emoji while bot is thinking", async () => {
        let resolveFetch!: (v: any) => void;
        const pendingFetch = new Promise((res) => { resolveFetch = res; });

        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockNewGame())
            .mockReturnValueOnce(pendingFetch);

        renderGameWithTimer(30);

        await waitFor(() => {
            expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0);
        });

        const cells = document.querySelectorAll("polygon");
        await act(async () => {
            cells[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(screen.getByText("🤖")).toBeInTheDocument();

        resolveFetch(mockMoveContinues());
    });
});
