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

describe("SelectDifficulty — Pie Rule (local mode)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Renderizado del toggle de Pie Rule ─────────────────────────────────
    test("pie rule card is not visible in bot mode", () => {
        renderSelectDifficulty();
        // Por defecto el modo es "bot"
        expect(screen.queryByRole("switch", { name: /pie rule/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/pie rule/i)).not.toBeInTheDocument();
    });

    test("pie rule card appears after switching to local mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /local/i }));

        expect(screen.getByRole("switch", { name: /pie rule/i })).toBeInTheDocument();
        expect(screen.getByText(/pie rule/i)).toBeInTheDocument();
    });

    // ── Estado del toggle ───────────────────────────────────────────────────
    test("pie rule toggle is OFF by default", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        const toggle = screen.getByRole("switch", { name: /pie rule/i });
        expect(toggle).toHaveAttribute("aria-checked", "false");
    });

    test("clicking pie rule toggle turns it ON", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        const toggle = screen.getByRole("switch", { name: /pie rule/i });
        await user.click(toggle);

        expect(toggle).toHaveAttribute("aria-checked", "true");
    });

    test("clicking pie rule toggle twice returns it to OFF", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /local/i }));

        const toggle = screen.getByRole("switch", { name: /pie rule/i });
        await user.click(toggle);
        await user.click(toggle);

        expect(toggle).toHaveAttribute("aria-checked", "false");
    });

    // ── Navegación con pieRule ─────────────────────────────────────────────
    async function configureLocalGame(user: ReturnType<typeof userEvent.setup>) {
        // Cambiar a modo local
        await user.click(screen.getByRole("button", { name: /local/i }));
        // (Opcional) dar nombre a player2
        const player2Input = screen.getByPlaceholderText(/nombre jugador 2|player 2 name/i);
        await user.clear(player2Input);
        await user.type(player2Input, "Amiga");
        // Seleccionar quién empieza (por defecto player1)
        // No es necesario tocar el timer ni board size, vienen por defecto.
    }

    test("navigates with pieRule=false when toggle is off", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await configureLocalGame(user);

        // Asegurar que pieRule sigue desactivado (por defecto)
        const toggle = screen.getByRole("switch", { name: /pie rule/i });
        expect(toggle).toHaveAttribute("aria-checked", "false");

        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ pieRule: false }),
                })
            );
        });
    });

    test("navigates with pieRule=true when toggle is on", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await configureLocalGame(user);

        const toggle = screen.getByRole("switch", { name: /pie rule/i });
        await user.click(toggle);
        expect(toggle).toHaveAttribute("aria-checked", "true");

        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ pieRule: true }),
                })
            );
        });
    });

    // ── Pie rule convive con otras opciones locales ─────────────────────────
    test("pie rule setting does not affect other local options", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await configureLocalGame(user);

        // Activar pie rule
        await user.click(screen.getByRole("switch", { name: /pie rule/i }));
        // Cambiar quién empieza a "random"
        await user.click(screen.getByRole("button", { name: /aleatorio|random/i }));
        // Cambiar tamaño de tablero a 9
        await user.click(screen.getByRole("button", { name: "9" }));

        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({
                        pieRule: true,
                        boardSize: 9,
                        firstPlayer: expect.stringMatching(/player[12]/), // random resuelto
                        mode: "local",
                    }),
                })
            );
        });
    });
});