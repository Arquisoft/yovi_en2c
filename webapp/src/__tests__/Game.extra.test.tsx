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

function renderGame(usernameFromState = "Pablo", usernameInStorage = "Pablo") {
    localStorage.clear();
    if (usernameInStorage) localStorage.setItem("username", usernameInStorage);

    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={[{
                pathname: "/game",
                state: usernameFromState
                    ? { username: usernameFromState, timerSeconds: 0 }
                    : undefined,
            } as any]}>
                <Game />
            </MemoryRouter>
        </I18nProvider>
    );
}

function emptyBoardLayout(size = 7) {
    return Array.from({ length: size }, (_, row) => ".".repeat(size - row)).join("/");
}

describe("Game component — extra coverage", () => {
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

    test("shows lost overlay when bot wins", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    ok: true,
                    yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    ok: true, finished: true, winner: "R",
                    winning_edges: [[[0, 0], [1, 0]]],
                    yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
                }),
            } as Response)
            .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ success: true }) } as Response);

        renderGame();

        await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });
        await user.click(document.querySelectorAll("polygon")[0]);
        await waitFor(() => { expect(screen.getByText(/Has perdido|You lost/i)).toBeInTheDocument(); });
    });

    test("navigates to home from overlay back button", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    ok: true,
                    yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
                }),
            } as Response)
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

        const backButtons = screen.getAllByRole("button", { name: /Volver al inicio|Back to home/i });
        await user.click(backButtons[backButtons.length - 1]);

        expect(mockNavigate).toHaveBeenCalledWith("/home", { state: { username: "Pablo" } });
    });

    test("clicking play again in overlay starts a new game", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    ok: true, yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    ok: true, finished: true, winner: "B",
                    winning_edges: [[[0, 0], [1, 0]]],
                    yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
                }),
            } as Response)
            .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ success: true }) } as Response)
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    ok: true, yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
                }),
            } as Response);

        renderGame();

        await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });
        await user.click(document.querySelectorAll("polygon")[0]);
        await waitFor(() => { expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument(); });

        const playAgainButtons = screen.getAllByRole("button", { name: /Nueva partida|New game/i });
        await user.click(playAgainButtons[playAgainButtons.length - 1]);

        await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(4); });
        expect(screen.queryByText(/Has ganado|You win/i)).not.toBeInTheDocument();
    });

    test("logout from navbar inside Game clears storage and navigates to root", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({
                ok: true, yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
            }),
        } as Response);

        renderGame();

        await user.click(screen.getByRole("button", { name: /Salir|Logout/i }));

        expect(localStorage.getItem("username")).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    test("loads bot from localStorage when no state bot is provided", async () => {
        const user = userEvent.setup();

        localStorage.setItem("username", "Pablo");
        localStorage.setItem("selectedBot", "minimax_bot");

        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    ok: true, yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    ok: true, finished: false,
                    yen: { size: 7, players: ["B", "R"], layout: emptyBoardLayout(7) },
                }),
            } as Response);

        render(
            <I18nProvider>
                <MemoryRouter initialEntries={[{
                    pathname: "/game",
                    state: { username: "Pablo", timerSeconds: 0 },
                } as any]}>
                    <Game />
                </MemoryRouter>
            </I18nProvider>
        );

        await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });
        await user.click(document.querySelectorAll("polygon")[0]);
        await waitFor(() => { expect(global.fetch).toHaveBeenCalledTimes(2); });

        const body = JSON.parse((global.fetch as any).mock.calls[1][1].body);
        expect(body.bot).toBe("minimax_bot");
    });

    test("does not send move when clicking an occupied cell", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({
                ok: true,
                yen: { size: 7, players: ["B", "R"], layout: "B....../....../...../..../.../../." },
            }),
        } as Response);

        renderGame();

        await waitFor(() => { expect(document.querySelectorAll("polygon").length).toBeGreaterThan(0); });
        await user.click(document.querySelectorAll("polygon")[0]);

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});