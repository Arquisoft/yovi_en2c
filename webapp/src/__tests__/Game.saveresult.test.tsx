
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Game from "../Game";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function renderGame(
    username = "Pablo",
    bot = "minimax_bot",
    boardSize = 7
) {
    localStorage.clear();
    localStorage.setItem("username", username);

    return render(
        <I18nProvider>
            <MemoryRouter
                initialEntries={[{
                    pathname: "/game",
                    state: { username, bot, boardSize },
                }]}
            >
                <Game />
            </MemoryRouter>
        </I18nProvider>
    );
}

function mockFetchNewGame(size = 7) {
    return {
        ok: true,
        text: async () => JSON.stringify({
            ok: true,
            yen: {
                size,
                players: ["B", "R"],
                layout: Array(size).fill(".".repeat(size)).join("/"),
            },
        }),
    } as Response;
}

function mockFetchMoveFinished(winner: string, size = 7) {
    return {
        ok: true,
        text: async () => JSON.stringify({
            ok: true,
            finished: true,
            winner,
            winning_edges: [[[0, 0], [1, 0]]],
            yen: {
                size,
                players: ["B", "R"],
                layout: Array(size).fill(".".repeat(size)).join("/"),
            },
        }),
    } as Response;
}

function mockFetchMoveContinues(size = 7) {
    return {
        ok: true,
        text: async () => JSON.stringify({
            ok: true,
            finished: false,
            yen: {
                size,
                players: ["B", "R"],
                layout: Array(size).fill(".".repeat(size)).join("/"),
            },
        }),
    } as Response;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Game — Issue #59: saveGameResult y nuevos campos", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mockNavigate.mockReset();
        global.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as any;
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ─── boardSize desde location.state ──────────────────────────────────────

    test("sends boardSize from state to POST /game/new", async () => {
        global.fetch = vi.fn().mockResolvedValueOnce(mockFetchNewGame(9));

        renderGame("Pablo", "minimax_bot", 9);

        await act(async () => {
            screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringMatching(/\/game\/new$/),
                expect.objectContaining({
                    body: JSON.stringify({ size: 9 }),
                })
            );
        });
    });

    test("sends default boardSize 7 when not in state", async () => {
        localStorage.setItem("username", "Pablo");

        global.fetch = vi.fn().mockResolvedValueOnce(mockFetchNewGame(7));

        render(
            <I18nProvider>
                <MemoryRouter
                    initialEntries={[{
                        pathname: "/game",
                        state: { username: "Pablo", bot: "minimax_bot" },
                    }]}
                >
                    <Game />
                </MemoryRouter>
            </I18nProvider>
        );

        await act(async () => {
            screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringMatching(/\/game\/new$/),
                expect.objectContaining({
                    body: JSON.stringify({ size: 7 }),
                })
            );
        });
    });

    // ─── saveGameResult al ganar ──────────────────────────────────────────────

    test("calls POST /gameresult with correct fields when player wins", async () => {
        // fetch call 1: new game, call 2: move (win), call 3: saveGameResult
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockFetchNewGame(7))
            .mockResolvedValueOnce(mockFetchMoveFinished("B", 7))
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ success: true }),
            } as Response);

        renderGame("Pablo", "minimax_bot", 7);

        await act(async () => {
            screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
        });

        await waitFor(() => {
            expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
        });

        const circles = document.querySelectorAll("circle");
        await act(async () => {
            circles[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        await act(async () => {
            screen.getByRole("button", { name: /Enviar jugada|Send move/i }).click();
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        const gameResultCall = (global.fetch as any).mock.calls[2];
        expect(gameResultCall[0]).toMatch(/\/gameresult$/);

        const body = JSON.parse(gameResultCall[1].body);
        expect(body).toMatchObject({
            username: "Pablo",
            opponent: "minimax_bot",
            result: "win",
            boardSize: 7,
            gameMode: "pvb",
        });
        expect(typeof body.score).toBe("number");
        expect(body.score).toBeGreaterThanOrEqual(1);
    });

    // ─── saveGameResult al perder ─────────────────────────────────────────────

    test("calls POST /gameresult with result loss when bot wins", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockFetchNewGame(7))
            .mockResolvedValueOnce(mockFetchMoveFinished("R", 7)) // R = bot wins
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ success: true }),
            } as Response);

        renderGame("Pablo", "minimax_bot", 7);

        await act(async () => {
            screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
        });

        await waitFor(() => {
            expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
        });

        const circles = document.querySelectorAll("circle");
        await act(async () => {
            circles[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        await act(async () => {
            screen.getByRole("button", { name: /Enviar jugada|Send move/i }).click();
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        const gameResultCall = (global.fetch as any).mock.calls[2];
        const body = JSON.parse(gameResultCall[1].body);
        expect(body.result).toBe("loss");
        expect(body.gameMode).toBe("pvb");
        expect(body.boardSize).toBe(7);
    });

    // ─── saveGameResult NO se llama en draw ───────────────────────────────────

    test("does NOT call POST /gameresult when game ends in draw", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockFetchNewGame(7))
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    ok: true,
                    finished: true,
                    winner: null, // null = draw
                    winning_edges: [],
                    yen: {
                        size: 7,
                        players: ["B", "R"],
                        layout: Array(7).fill(".".repeat(7)).join("/"),
                    },
                }),
            } as Response);

        renderGame("Pablo", "minimax_bot", 7);

        await act(async () => {
            screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
        });

        await waitFor(() => {
            expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
        });

        const circles = document.querySelectorAll("circle");
        await act(async () => {
            circles[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        await act(async () => {
            screen.getByRole("button", { name: /Enviar jugada|Send move/i }).click();
        });

        await waitFor(() => {
            expect(screen.getByText(/Empate|Draw/i)).toBeInTheDocument();
        });

        // Solo 2 llamadas (newGame + sendMove), NO una tercera para gameresult
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // ─── saveGameResult falla silenciosamente ─────────────────────────────────

    test("game overlay still shows when saveGameResult fails silently", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockFetchNewGame(7))
            .mockResolvedValueOnce(mockFetchMoveFinished("B", 7))
            .mockRejectedValueOnce(new Error("Network error saving result")); // fallo silencioso

        renderGame("Pablo", "minimax_bot", 7);

        await act(async () => {
            screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
        });

        await waitFor(() => {
            expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
        });

        const circles = document.querySelectorAll("circle");
        await act(async () => {
            circles[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        await act(async () => {
            screen.getByRole("button", { name: /Enviar jugada|Send move/i }).click();
        });

        // El overlay de victoria debe aparecer igualmente
        await waitFor(() => {
            expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument();
        });
    });

    // ─── moveCount se resetea al nueva partida ────────────────────────────────

    test("resets moveCount to 0 when new game is started", async () => {
        global.fetch = vi.fn()
            // Primera partida: new game + move que no termina
            .mockResolvedValueOnce(mockFetchNewGame(7))
            .mockResolvedValueOnce(mockFetchMoveContinues(7))
            // Segunda partida: new game + move que gana (score debe ser 1, no 2)
            .mockResolvedValueOnce(mockFetchNewGame(7))
            .mockResolvedValueOnce(mockFetchMoveFinished("B", 7))
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ success: true }),
            } as Response);

        renderGame("Pablo", "minimax_bot", 7);

        // Primera partida: iniciar y hacer un movimiento
        await act(async () => {
            screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
        });

        await waitFor(() => {
            expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
        });

        await act(async () => {
            document.querySelectorAll("circle")[0].dispatchEvent(
                new MouseEvent("click", { bubbles: true })
            );
        });
        await act(async () => {
            screen.getByRole("button", { name: /Enviar jugada|Send move/i }).click();
        });

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

        // Segunda partida: nueva partida (resetea counter)
        await act(async () => {
            screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
        });

        await waitFor(() => {
            expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
        });

        await act(async () => {
            document.querySelectorAll("circle")[0].dispatchEvent(
                new MouseEvent("click", { bubbles: true })
            );
        });
        await act(async () => {
            screen.getByRole("button", { name: /Enviar jugada|Send move/i }).click();
        });

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(5));

        // El score en la llamada a gameresult debe ser 1 (reset del counter)
        const gameResultCall = (global.fetch as any).mock.calls[4];
        const body = JSON.parse(gameResultCall[1].body);
        expect(body.score).toBe(1);
    });

    // ─── boardSize se pasa correctamente en los campos guardados ─────────────

    test("sends correct boardSize 11 in gameresult when custom size was selected", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce(mockFetchNewGame(11))
            .mockResolvedValueOnce(mockFetchMoveFinished("B", 11))
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ success: true }),
            } as Response);

        renderGame("Pablo", "minimax_bot", 11);

        await act(async () => {
            screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringMatching(/\/game\/new$/),
                expect.objectContaining({ body: JSON.stringify({ size: 11 }) })
            );
        });

        await waitFor(() => {
            expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
        });

        await act(async () => {
            document.querySelectorAll("circle")[0].dispatchEvent(
                new MouseEvent("click", { bubbles: true })
            );
        });
        await act(async () => {
            screen.getByRole("button", { name: /Enviar jugada|Send move/i }).click();
        });

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));

        const gameResultCall = (global.fetch as any).mock.calls[2];
        const body = JSON.parse(gameResultCall[1].body);
        expect(body.boardSize).toBe(11);
    });
});
