import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import SelectDifficulty from "./SelectDifficulty";
import { I18nProvider } from "./i18n/I18nProvider";

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

    test("selects a difficulty and navigates to game with bot id", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        const easyButton = screen.getByRole("button", { name: /Fácil|Easy/i });
        await user.click(easyButton);

        const playButton = screen.getByRole("button", { name: /Jugar|Play/i });
        expect(playButton).not.toBeDisabled();

        await user.click(playButton);

        expect(localStorage.getItem("selectedBot")).toBe("heuristic_bot");
        expect(mockNavigate).toHaveBeenCalledWith("/game", {
            state: { username: "Pablo", bot: "heuristic_bot" },
        });
    });

    test("selects extreme difficulty and navigates correctly", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        const extremeButton = screen.getByRole("button", { name: /Extremo|Extreme/i });
        await user.click(extremeButton);

        const playButton = screen.getByRole("button", { name: /Jugar|Play/i });
        await user.click(playButton);

        expect(localStorage.getItem("selectedBot")).toBe("monte_carlo_extreme");
        expect(mockNavigate).toHaveBeenCalledWith("/game", {
            state: { username: "Pablo", bot: "monte_carlo_extreme" },
        });
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
});