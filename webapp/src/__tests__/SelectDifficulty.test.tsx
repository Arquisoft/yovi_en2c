import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import SelectDifficulty from "../SelectDifficulty";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

function renderSelectDifficulty(usernameInStorage = "Pablo") {
    localStorage.clear();
    if (usernameInStorage) {
        localStorage.setItem("username", usernameInStorage);
        localStorage.setItem("token", "fake-token");
    }
    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={["/select-difficulty"]}>
                <SelectDifficulty />
            </MemoryRouter>
        </I18nProvider>
    );
}

describe("SelectDifficulty", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Auth & existing tests (unchanged) ────────────────────────────────────

    test("redirects to root when no username in localStorage", async () => {
        renderSelectDifficulty("");
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
    });

    test("renders difficulty options", () => {
        renderSelectDifficulty();
        expect(screen.getByText(/Fácil|Easy/i)).toBeInTheDocument();
        expect(screen.getByText(/Medio|Medium/i)).toBeInTheDocument();
        expect(screen.getByText(/Difícil|Hard/i)).toBeInTheDocument();
        expect(screen.getByText(/Experto|Expert/i)).toBeInTheDocument();
        expect(screen.getByText(/Extremo|Extreme/i)).toBeInTheDocument();
    });

    test("logout button works", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /Salir|Logout/i }));
        expect(localStorage.getItem("username")).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    test("navbar displays username", () => {
        renderSelectDifficulty();
        expect(screen.getByText(/Pablo/i)).toBeInTheDocument();
    });

    // ── MODIFIED — now includes timerSeconds: 0 (default no-limit) ──────────
    test("selects a difficulty and navigates to game with default timer (no limit)", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Fácil|Easy/i }));
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(localStorage.getItem("selectedBot")).toBe("heuristic_bot");
        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ username: "Pablo", bot: "heuristic_bot", boardSize: 7, timerSeconds: 0 }),
        }));
    });

    test("selects extreme difficulty and navigates correctly", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Extremo|Extreme/i }));
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(localStorage.getItem("selectedBot")).toBe("monte_carlo_extreme");
        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ username: "Pablo", bot: "monte_carlo_extreme", boardSize: 7, timerSeconds: 0 }),
        }));
    });

    test("renders board size section with preset buttons and custom input", () => {
        renderSelectDifficulty();
        expect(screen.getByRole("button", { name: /^5$/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^7$/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^9$/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^11$/ })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i)).toBeInTheDocument();
    });

    test("preset button 7 is active by default", () => {
        renderSelectDifficulty();
        expect(screen.getByRole("button", { name: /^7$/ })).toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^5$/ })).not.toHaveClass("btn--primary");
    });

    test("clicking preset size 5 marks it as active and clears custom input", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        const input = screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i);
        await user.type(input, "13");
        await user.click(screen.getByRole("button", { name: /^5$/ }));
        expect(screen.getByRole("button", { name: /^5$/ })).toHaveClass("btn--primary");
        expect(input).toHaveValue(null);
    });

    test("navigates with custom board size", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Fácil|Easy/i }));
        await user.type(screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i), "9");
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ username: "Pablo", bot: "heuristic_bot", boardSize: 9, timerSeconds: 0 }),
        }));
    });

    test("shows small board warning when size < 5", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.type(screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i), "3");
        expect(screen.getByText(/tablero es muy pequeño|Board too small/i)).toBeInTheDocument();
    });

    test("shows large board warning when size > 11", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.type(screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i), "15");
        expect(screen.getByText(/tableros grandes|Large boards/i)).toBeInTheDocument();
    });

    test("play button is disabled until difficulty is selected", () => {
        renderSelectDifficulty();
        expect(screen.getByRole("button", { name: /Jugar|Play/i })).toBeDisabled();
    });

    test("play button enabled after selecting difficulty", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await user.click(screen.getByRole("button", { name: /Medio|Medium/i }));
        expect(screen.getByRole("button", { name: /Jugar|Play/i })).not.toBeDisabled();
    });

    // ── TIMER TESTS ───────────────────────────────────────────────────────────

    test("renders timer section with preset buttons and custom input", () => {
        renderSelectDifficulty();
        expect(screen.getByText(/Tiempo por turno|Turn Timer/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Sin límite|No limit/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^15s$/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^30s$/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^60s$/ })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i)).toBeInTheDocument();
    });

    test("no limit button is active by default", () => {
        renderSelectDifficulty();
        expect(screen.getByRole("button", { name: /Sin límite|No limit/i })).toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^15s$/ })).not.toHaveClass("btn--primary");
    });

    test("clicking 30s timer marks it as active", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /^30s$/ }));

        expect(screen.getByRole("button", { name: /^30s$/ })).toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /Sin límite|No limit/i })).not.toHaveClass("btn--primary");
    });

    test("selecting preset timer 15s navigates with timerSeconds: 15", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Fácil|Easy/i }));
        await user.click(screen.getByRole("button", { name: /^15s$/ }));
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ username: "Pablo", bot: "heuristic_bot", boardSize: 7, timerSeconds: 15 }),
        }));
    });

    test("selecting preset timer 60s navigates with timerSeconds: 60", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Fácil|Easy/i }));
        await user.click(screen.getByRole("button", { name: /^60s$/ }));
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ username: "Pablo", bot: "heuristic_bot", boardSize: 7, timerSeconds: 60 }),
        }));
    });

    test("typing custom timer deselects all preset timer buttons", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.type(screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i), "45");

        expect(screen.getByRole("button", { name: /Sin límite|No limit/i })).not.toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^15s$/ })).not.toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^30s$/ })).not.toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^60s$/ })).not.toHaveClass("btn--primary");
    });

    test("typing custom timer 45 navigates with timerSeconds: 45", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Fácil|Easy/i }));
        await user.type(screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i), "45");
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ username: "Pablo", bot: "heuristic_bot", boardSize: 7, timerSeconds: 45 }),
        }));
    });

    test("clicking preset timer clears custom timer input", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        const timerInput = screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i);
        await user.type(timerInput, "45");
        await user.click(screen.getByRole("button", { name: /^30s$/ }));

        expect(timerInput).toHaveValue(null);
        expect(screen.getByRole("button", { name: /^30s$/ })).toHaveClass("btn--primary");
    });

    test("shows short timer warning when custom value < 5", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.type(screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i), "3");

        expect(screen.getByText(/tiempo mínimo|Minimum recommended time/i)).toBeInTheDocument();
    });

    test("shows long timer warning when custom value > 300", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.type(screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i), "400");

        expect(screen.getByText(/tiempo máximo|Maximum recommended time/i)).toBeInTheDocument();
    });

    test("no timer warning when custom value is within range", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.type(screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i), "60");

        expect(screen.queryByText(/tiempo mínimo|Minimum recommended time/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/tiempo máximo|Maximum recommended time/i)).not.toBeInTheDocument();
    });

    test("no timer warning for default no-limit selection", () => {
        renderSelectDifficulty();
        expect(screen.queryByText(/tiempo mínimo|Minimum recommended time/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/tiempo máximo|Maximum recommended time/i)).not.toBeInTheDocument();
    });

    test("navigates with both custom board size and custom timer", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Fácil|Easy/i }));
        await user.type(screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i), "9");
        await user.type(screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i), "20");
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ username: "Pablo", bot: "heuristic_bot", boardSize: 9, timerSeconds: 20 }),
        }));
    });
});