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
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
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

    // ─── Tests existentes (sin cambios) ──────────────────────────────────────

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

        const logoutButton = screen.getByRole("button", { name: /Salir|Logout/i });
        await user.click(logoutButton);

        expect(localStorage.getItem("username")).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    test("navbar displays username", () => {
        renderSelectDifficulty();
        expect(screen.getByText(/Pablo/i)).toBeInTheDocument();
    });

    test("selects a difficulty and navigates to game with bot id and default board size", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        const easyButton = screen.getByRole("button", { name: /Fácil|Easy/i });
        await user.click(easyButton);

        const playButton = screen.getByRole("button", { name: /Jugar|Play/i });
        expect(playButton).not.toBeDisabled();

        await user.click(playButton);

        expect(localStorage.getItem("selectedBot")).toBe("heuristic_bot");
        expect(mockNavigate).toHaveBeenCalledWith("/game", {
            state: { username: "Pablo", bot: "heuristic_bot", boardSize: 7 },
        });
    });

    // ─── MODIFICADO — selects extreme difficulty and navigates correctly ──────
    // Antes: state { username, bot }
    // Ahora: state { username, bot, boardSize }
    // ─────────────────────────────────────────────────────────────────────────
    test("selects extreme difficulty and navigates correctly", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        const extremeButton = screen.getByRole("button", { name: /Extremo|Extreme/i });
        await user.click(extremeButton);

        const playButton = screen.getByRole("button", { name: /Jugar|Play/i });
        await user.click(playButton);

        expect(localStorage.getItem("selectedBot")).toBe("monte_carlo_extreme");
        expect(mockNavigate).toHaveBeenCalledWith("/game", {
            state: { username: "Pablo", bot: "monte_carlo_extreme", boardSize: 7 },
        });
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

        const btn7 = screen.getByRole("button", { name: /^7$/ });
        expect(btn7).toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^5$/ })).not.toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^9$/ })).not.toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^11$/ })).not.toHaveClass("btn--primary");
    });

    test("clicking preset size 5 marks it as active and clears custom input", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        const input = screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i);
        await user.type(input, "13");
        expect(input).toHaveValue(13);

        await user.click(screen.getByRole("button", { name: /^5$/ }));

        expect(screen.getByRole("button", { name: /^5$/ })).toHaveClass("btn--primary");
        expect(input).toHaveValue(null);
    });

    test("clicking preset size 11 marks it as active", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /^11$/ }));

        expect(screen.getByRole("button", { name: /^11$/ })).toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^7$/ })).not.toHaveClass("btn--primary");
    });

    test("typing in custom input deselects all preset buttons", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        const input = screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i);
        await user.type(input, "8");

        expect(screen.getByRole("button", { name: /^7$/ })).not.toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^5$/ })).not.toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^9$/ })).not.toHaveClass("btn--primary");
        expect(screen.getByRole("button", { name: /^11$/ })).not.toHaveClass("btn--primary");
    });

    test("navigates with custom board size when typed in input", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Fácil|Easy/i }));

        const input = screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i);
        await user.type(input, "9");

        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", {
            state: { username: "Pablo", bot: "heuristic_bot", boardSize: 9 },
        });
    });

    test("navigates with preset board size 11 when selected", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Fácil|Easy/i }));
        await user.click(screen.getByRole("button", { name: /^11$/ }));
        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", {
            state: { username: "Pablo", bot: "heuristic_bot", boardSize: 11 },
        });
    });

    test("shows small board warning when size is less than 5", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        const input = screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i);
        await user.type(input, "3");

        expect(
            screen.getByText(/tablero es muy pequeño|Board too small/i)
        ).toBeInTheDocument();
    });

    test("shows large board warning when size is greater than 11", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        const input = screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i);
        await user.type(input, "15");

        expect(
            screen.getByText(/tableros grandes|Large boards/i)
        ).toBeInTheDocument();
    });

    test("does not show warning when size is within recommended range", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        const input = screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i);
        await user.type(input, "8");

        expect(screen.queryByText(/tablero es muy pequeño|Board too small/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/tableros grandes|Large boards/i)).not.toBeInTheDocument();
    });

    test("does not show warning for preset size 7 (default)", () => {
        renderSelectDifficulty();

        expect(screen.queryByText(/tablero es muy pequeño|Board too small/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/tableros grandes|Large boards/i)).not.toBeInTheDocument();
    });

    test("play button is disabled until difficulty is selected", () => {
        renderSelectDifficulty();

        const playButton = screen.getByRole("button", { name: /Jugar|Play/i });
        expect(playButton).toBeDisabled();
    });

    test("play button is enabled after selecting difficulty regardless of board size", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Medio|Medium/i }));

        expect(screen.getByRole("button", { name: /Jugar|Play/i })).not.toBeDisabled();
    });

    test("warning is still shown but game can still start with large board", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: /Fácil|Easy/i }));

        const input = screen.getByPlaceholderText(/Tamaño personalizado|Custom size/i);
        await user.type(input, "20");

        expect(screen.getByText(/tableros grandes|Large boards/i)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /Jugar|Play/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/game", {
            state: { username: "Pablo", bot: "heuristic_bot", boardSize: 20 },
        });
    });
});