import { render, screen, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Stats from "../Stats";
import { I18nProvider } from "../i18n/I18nProvider";
import userEvent from "@testing-library/user-event";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

function renderStats(usernameFromState = "Pablo", usernameInStorage = "Pablo") {
    localStorage.clear();

    if (usernameInStorage) {
        localStorage.setItem("username", usernameInStorage);
    }

    return render(
        <I18nProvider>
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: "/stats",
                        state: usernameFromState ? { username: usernameFromState } : undefined,
                    },
                ]}
            >
                <Stats />
            </MemoryRouter>
        </I18nProvider>
    );
}

describe("Stats component", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });


    test("fetches and displays stats correctly", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                success: true,
                username: "Pablo",
                stats: { wins: 3, losses: 1 },
                total: 4,
                games: [],
            }),
        } as Response);

        renderStats();

        await waitFor(() => {
            expect(screen.getByText("4")).toBeInTheDocument(); // total played
            expect(screen.getByText("3")).toBeInTheDocument(); // wins
            expect(screen.getByText("1")).toBeInTheDocument(); // losses
            expect(screen.getByText("75%")).toBeInTheDocument(); // win rate
        });
    });

    test("shows error when API returns error", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                success: false,
                error: "Failed to load history",
            }),
        } as Response);

        renderStats();

        expect(await screen.findByText(/Failed to load history/i)).toBeInTheDocument();
    });

    test("shows network error on fetch failure", async () => {
        globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

        renderStats();

        expect(await screen.findByText(/Network error/i)).toBeInTheDocument();
    });

    test("renders empty state when no games", async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                success: true,
                username: "Pablo",
                stats: { wins: 0, losses: 0 },
                total: 0,
                games: [],
            }),
        } as Response);

        renderStats();

        expect(await screen.findByText(/No games played yet/i)).toBeInTheDocument();
    });


    test("redirects to root when username is missing", async () => {
        renderStats("", "");

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
    });

    test("logout clears storage and navigates", async () => {
        const user = userEvent.setup();

        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                success: true,
                username: "Pablo",
                stats: { wins: 1, losses: 0 },
                total: 1,
                games: [],
            }),
        } as Response);

        renderStats();

        // assuming Navbar has logout button text "Logout"
        const logoutBtn = await screen.findByText(/logout/i);
        await user.click(logoutBtn);

        expect(localStorage.getItem("username")).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
});