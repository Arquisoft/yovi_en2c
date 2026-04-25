import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import SelectDifficulty from "../SelectDifficulty";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

function renderSelectDifficulty(username = "pablo") {
    localStorage.setItem("username", username);
    return render(
        <I18nProvider>
            <MemoryRouter>
                <SelectDifficulty />
            </MemoryRouter>
        </I18nProvider>
    );
}

describe("SelectDifficulty — Local multiplayer mode", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Switching to local mode ────────────────────────────────────────────
    test("renders local-specific cards after switching to local", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        // Al principio no deben estar los campos locales
        expect(screen.queryByText(/nombre jugador 2|player 2 name/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/qui[ée]n empieza|who starts first/i)).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /local/i }));

        expect(screen.getByText(/nombre jugador 2|player 2 name/i)).toBeInTheDocument();
        expect(screen.getByText(/qui[ée]n empieza|who starts first/i)).toBeInTheDocument();
        expect(screen.getByRole("switch", { name: /pie rule/i })).toBeInTheDocument();
    });

    test("bot-specific difficulty selector disappears in local mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        expect(screen.getByText(/dificultad|difficulty/i)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /local/i }));

        expect(screen.queryByText(/dificultad|difficulty/i)).not.toBeInTheDocument();
    });

    // ── Player 2 name input ────────────────────────────────────────────────
    test("player2 name input accepts text and default is empty", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        const input = screen.getByPlaceholderText(/nombre jugador 2|player 2 name/i);
        expect(input).toHaveValue("");
        await user.type(input, "Carlos");
        expect(input).toHaveValue("Carlos");
    });

    // ── First player selection ─────────────────────────────────────────────
    test("first player options: player1, player2, random", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        expect(screen.getByRole("button", { name: /pablo \(jugador 1|player 1\)/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /jugador 2|player 2/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /aleatorio|random/i })).toBeInTheDocument();
    });

    test("player1 is selected by default", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        const btnPlayer1 = screen.getByRole("button", { name: /pablo \(jugador 1|player 1\)/i });
        expect(btnPlayer1).toHaveClass("btn--primary");
    });

    test("selecting player2 changes active style", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        const btnPlayer2 = screen.getByRole("button", { name: /jugador 2|player 2/i });
        await user.click(btnPlayer2);
        expect(btnPlayer2).toHaveClass("btn--primary");
    });

    test("selecting random changes active style", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        const btnRandom = screen.getByRole("button", { name: /aleatorio|random/i });
        await user.click(btnRandom);
        expect(btnRandom).toHaveClass("btn--primary");
    });

    // ── Start navigation with local mode ───────────────────────────────────
    test("start game in local mode navigates with correct state (default values)", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({
                        username: "pablo",
                        mode: "local",
                        player1Name: "pablo",
                        player2Name: "Player 2",     // valor por defecto si está vacío
                        boardSize: 7,
                        timerSeconds: 0,
                        allowUndo: false,
                        undoLimit: 0,
                        pieRule: false,
                        firstPlayer: "player1",
                    }),
                })
            );
        });
    });

    test("start game with custom player2 name", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        const player2Input = screen.getByPlaceholderText(/nombre jugador 2|player 2 name/i);
        await user.type(player2Input, "Ana");

        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ player2Name: "Ana" }),
                })
            );
        });
    });

    test("start game with firstPlayer = player2", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        await user.click(screen.getByRole("button", { name: /jugador 2|player 2/i }));

        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ firstPlayer: "player2" }),
                })
            );
        });
    });

    test("firstPlayer = random resolves to either player1 or player2 (not 'random')", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        await user.click(screen.getByRole("button", { name: /aleatorio|random/i }));

        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            const call = mockNavigate.mock.calls[0];
            const state = call[1].state;
            expect(state.firstPlayer).not.toBe("random");
            expect(state.firstPlayer).toMatch(/player[12]/);
        });
    });

    test("local mode respects board size and timer selections", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        // Cambiar tamaño a 9
        await user.click(screen.getByRole("button", { name: "9" }));
        // Cambiar timer a 30s
        await user.click(screen.getByRole("button", { name: "30s" }));

        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ boardSize: 9, timerSeconds: 30 }),
                })
            );
        });
    });

    test("local mode can enable undo and set undo limit", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        // Activar undo
        const undoToggle = screen.getByRole("switch", { name: /permitir deshacer|allow undo/i });
        await user.click(undoToggle);
        // Seleccionar límite 2
        await user.click(screen.getByRole("button", { name: "2" }));

        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ allowUndo: true, undoLimit: 2 }),
                })
            );
        });
    });
});