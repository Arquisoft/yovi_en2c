import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import SelectDifficulty from "../SelectDifficulty";
import { I18nProvider } from "../i18n/I18nProvider";

// ── Mock ──────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helper ────────────────────────────────────────────────────────────────────

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

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("SelectDifficulty", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Auth ──────────────────────────────────────────────────────────────────

    test("redirects to root when no username in localStorage", async () => {
        renderSelectDifficulty("");
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
    });

    // ── Game mode card ────────────────────────────────────────────────────────

    test("renders game mode selector with bot and local options", () => {
        renderSelectDifficulty();
        expect(screen.getByText(/vs bot|contra bot/i)).toBeInTheDocument();
        expect(screen.getByText(/local/i)).toBeInTheDocument();
    });

    test("bot mode is selected by default", () => {
        renderSelectDifficulty();
        // The bot button should have the primary class active
        const buttons = screen.getAllByRole("button");
        const botBtn = buttons.find(b => /vs bot|contra bot/i.test(b.textContent ?? ""));
        expect(botBtn).toHaveClass("btn--primary");
    });

    test("difficulty buttons are visible in bot mode", () => {
        renderSelectDifficulty();
        expect(screen.getByText(/Fácil|Easy/i)).toBeInTheDocument();
        expect(screen.getByText(/Medio|Medium/i)).toBeInTheDocument();
        expect(screen.getByText(/Difícil|Hard/i)).toBeInTheDocument();
        expect(screen.getByText(/Experto|Expert/i)).toBeInTheDocument();
        expect(screen.getByText(/Extremo|Extreme/i)).toBeInTheDocument();
    });

    test("difficulty buttons are NOT visible in local mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/local/i));

        expect(screen.queryByText(/Fácil|Easy/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Extremo|Extreme/i)).not.toBeInTheDocument();
    });

    // ── Navbar / logout ───────────────────────────────────────────────────────

    test("logout button clears storage and navigates to root", async () => {
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

    // ── Play button: disabled / enabled ───────────────────────────────────────

    test("play button is disabled in bot mode until difficulty is selected", () => {
        renderSelectDifficulty();
        expect(screen.getByRole("button", { name: /Jugar|Play/i })).toBeDisabled();
    });

    test("play button is enabled in local mode without selecting a bot", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/local/i));

        expect(screen.getByRole("button", { name: /Jugar|Play/i })).not.toBeDisabled();
    });

    test("play button is enabled in bot mode after selecting difficulty", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/Medio|Medium/i));

        expect(screen.getByRole("button", { name: /Jugar|Play/i })).not.toBeDisabled();
    });

    // ── Bot mode navigation ───────────────────────────────────────────────────

    test("navigates to /game with mode:bot and default timer when difficulty is selected", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/Fácil|Easy/i));
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(localStorage.getItem("selectedBot")).toBe("heuristic_bot");
        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({
                username: "Pablo",
                bot: "heuristic_bot",
                boardSize: 7,
                timerSeconds: 0,
                mode: "bot",
            }),
        }));
    });

    test("navigates with extreme difficulty", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/Extremo|Extreme/i));
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(localStorage.getItem("selectedBot")).toBe("monte_carlo_extreme");
        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ bot: "monte_carlo_extreme", mode: "bot" }),
        }));
    });

    // ── Board size ────────────────────────────────────────────────────────────

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

    test("navigates with custom board size in bot mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/Fácil|Easy/i));
        await user.type(screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i), "9");
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ boardSize: 9 }),
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

    // ── Turn timer ────────────────────────────────────────────────────────────

    test("renders timer section with preset buttons and custom input", () => {
        renderSelectDifficulty();
        expect(screen.getByText(/Tiempo por turno|Turn Timer/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Sin límite|No limit/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^15s$/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^30s$/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^60s$/ })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i)).toBeInTheDocument();
    });

    test("no limit timer button is active by default", () => {
        renderSelectDifficulty();
        expect(screen.getByRole("button", { name: /Sin límite|No limit/i })).toHaveClass("btn--primary");
    });

    test("selecting preset timer 15s navigates with timerSeconds: 15", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/Fácil|Easy/i));
        await user.click(screen.getByRole("button", { name: /^15s$/ }));
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ timerSeconds: 15 }),
        }));
    });

    test("selecting preset timer 60s navigates with timerSeconds: 60", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/Fácil|Easy/i));
        await user.click(screen.getByRole("button", { name: /^60s$/ }));
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ timerSeconds: 60 }),
        }));
    });

    test("typing custom timer 45 navigates with timerSeconds: 45", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/Fácil|Easy/i));
        await user.type(screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i), "45");
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ timerSeconds: 45 }),
        }));
    });

    test("clicking preset timer clears custom input", async () => {
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

    test("navigates with both custom board size and custom timer in bot mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/Fácil|Easy/i));
        await user.type(screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i), "9");
        await user.type(screen.getByPlaceholderText(/Segundos personalizados|Custom seconds/i), "20");
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ boardSize: 9, timerSeconds: 20, mode: "bot" }),
        }));
    });

    // ── Undo card (compatibility — full suite in SelectDifficulty.undo.test) ──

    test("navigates with allowUndo: false by default in bot mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/Fácil|Easy/i));
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
            state: expect.objectContaining({ allowUndo: false, undoLimit: 0 }),
        }));
    });

    // ── Instructions button ───────────────────────────────────────────────────

    test("instructions button navigates to /instructions", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Instrucciones|Instructions/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/instructions", {
            state: { username: "Pablo" },
        });
    });
});