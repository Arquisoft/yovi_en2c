import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import UserProfile from "../UserProfile";
import { I18nProvider } from "../i18n/I18nProvider";


const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderProfile(username = "testuser", currentUser = "otheruser", token = "fake-token") {
    localStorage.clear();
    if (currentUser) localStorage.setItem("username", currentUser);
    if (token)       localStorage.setItem("token", token);

    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={[`/profile/${username}`]}>
                <Routes>
                    <Route path="/profile/:username" element={<UserProfile />} />
                </Routes>
            </MemoryRouter>
        </I18nProvider>
    );
}

const FULL_PROFILE: {
    username: string;
    realName: string | null;
    bio: string | null;
    location: { city?: string; country?: string };
    preferredLanguage: string;
    joinDate: string;
    stats: { totalGames: number; wins: number; losses: number; winRate: number };
    recentMatches: { opponent: string; result: "win" | "loss"; boardSize: number; gameMode: "pvb" | "pvp"; date: string }[];
} = {
    username: "testuser",
    realName: "Test User",
    bio: "I love board games",
    location: { city: "Oviedo", country: "Spain" },
    preferredLanguage: "en",
    joinDate: "2024-01-01T00:00:00.000Z",
    stats: { totalGames: 10, wins: 7, losses: 3, winRate: 70 },
    recentMatches: [
        { opponent: "minimax_bot", result: "win",  boardSize: 7,  gameMode: "pvb", date: "2026-04-01T10:00:00Z" },
        { opponent: "carlos",      result: "loss", boardSize: 11, gameMode: "pvp", date: "2026-04-02T10:00:00Z" },
    ],
};

const MINIMAL_PROFILE: typeof FULL_PROFILE = {
    username: "minimaluser",
    realName: null,
    bio: null,
    location: {},
    preferredLanguage: "es",
    joinDate: "2024-06-01T00:00:00.000Z",
    stats: { totalGames: 0, wins: 0, losses: 0, winRate: 0 },
    recentMatches: [],
};

function mockFetch(profile = FULL_PROFILE, success = true) {
    global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => ({ success, profile, error: success ? undefined : "User not found" }),
    } as Response);
}

function mockFetchError() {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("UserProfile", () => {
    beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockNavigate.mockReset(); });
    afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

    // ── Loading state ─────────────────────────────────────────────────────────

    test("shows loading indicator while fetching", () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
        renderProfile();
        expect(screen.getAllByText(/Cargando|Loading/i).length).toBeGreaterThanOrEqual(1);
    });

    // ── API call ──────────────────────────────────────────────────────────────

    test("calls /api/profile/:username on mount", async () => {
        mockFetch();
        renderProfile("testuser");
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith("/api/profile/testuser");
        });
    });

    // ── Error states ──────────────────────────────────────────────────────────

    test("shows error message when API returns success false", async () => {
        mockFetch(FULL_PROFILE, false);
        renderProfile();
        expect(await screen.findByText(/User not found/i)).toBeInTheDocument();
    });

    test("shows generic error when API returns success false with no error message", async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            json: async () => ({ success: false }),
        } as Response);
        renderProfile();
        expect(await screen.findByText(/Error al cargar el perfil|Failed to load profile/i)).toBeInTheDocument();
    });

    test("shows network error message when fetch throws", async () => {
        mockFetchError();
        renderProfile();
        expect(await screen.findByText(/Error de red|Network error/i)).toBeInTheDocument();
    });

    test("back button navigates -1 on error state", async () => {
        const user = userEvent.setup();
        mockFetch(FULL_PROFILE, false);
        renderProfile();
        await screen.findByText(/User not found/i);
        await user.click(screen.getByRole("button", { name: /Volver|Back/i }));
        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    // ── Profile display ───────────────────────────────────────────────────────

    test("renders username as heading", async () => {
        mockFetch();
        renderProfile();
        expect(await screen.findByRole("heading", { name: /testuser/i })).toBeInTheDocument();
    });

    test("renders avatar with initials", async () => {
        mockFetch();
        renderProfile();
        await screen.findByRole("heading", { name: /testuser/i });
        expect(screen.getByText("TE")).toBeInTheDocument();
    });

    test("renders realName when present", async () => {
        mockFetch();
        renderProfile();
        expect(await screen.findByText("Test User")).toBeInTheDocument();
    });

    test("does not render realName when null", async () => {
        mockFetch(MINIMAL_PROFILE);
        renderProfile("minimaluser");
        await screen.findByRole("heading", { name: /minimaluser/i });
        expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    });

    test("renders bio when present", async () => {
        mockFetch();
        renderProfile();
        expect(await screen.findByText(/"I love board games"/i)).toBeInTheDocument();
    });

    test("does not render bio when null", async () => {
        mockFetch(MINIMAL_PROFILE);
        renderProfile("minimaluser");
        await screen.findByRole("heading", { name: /minimaluser/i });
        expect(screen.queryByText(/I love board games/i)).not.toBeInTheDocument();
    });

    test("renders city and country when present", async () => {
        mockFetch();
        renderProfile();
        expect(await screen.findByText(/Oviedo, Spain/i)).toBeInTheDocument();
    });

    test("does not render location when empty", async () => {
        mockFetch(MINIMAL_PROFILE);
        renderProfile("minimaluser");
        await screen.findByRole("heading", { name: /minimaluser/i });
        expect(screen.queryByText(/📍/)).not.toBeInTheDocument();
    });

    test("renders English when preferredLanguage is en", async () => {
        mockFetch();
        renderProfile();
        expect(await screen.findByText(/🌐 English/i)).toBeInTheDocument();
    });

    test("renders Español when preferredLanguage is es", async () => {
        mockFetch(MINIMAL_PROFILE);
        renderProfile("minimaluser");
        expect(await screen.findByText(/🌐 Español/i)).toBeInTheDocument();
    });

    test("renders join date", async () => {
        mockFetch();
        renderProfile();
        await screen.findByRole("heading", { name: /testuser/i });
        expect(screen.getByText(/📅/)).toBeInTheDocument();
    });

    // ── Stats cards ───────────────────────────────────────────────────────────

    test("renders stats cards with correct values", async () => {
        mockFetch();
        renderProfile();
        await screen.findByRole("heading", { name: /testuser/i });
        expect(screen.getByText("10")).toBeInTheDocument();
        expect(screen.getByText("7")).toBeInTheDocument();
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("70%")).toBeInTheDocument();
    });

    // ── Friends placeholder ───────────────────────────────────────────────────

    test("renders friends placeholder", async () => {
        mockFetch();
        renderProfile();
        await screen.findByRole("heading", { name: /testuser/i });
        expect(screen.getByText(/próximamente|coming soon/i)).toBeInTheDocument();
    });

    // ── Recent matches ────────────────────────────────────────────────────────

    test("renders recent matches table when matches exist", async () => {
        mockFetch();
        renderProfile();
        await screen.findByRole("heading", { name: /testuser/i });
        expect(screen.getByText("minimax_bot")).toBeInTheDocument();
        expect(screen.getByText("carlos")).toBeInTheDocument();
        expect(screen.getByText("7×7")).toBeInTheDocument();
        expect(screen.getByText("11×11")).toBeInTheDocument();
    });

    test("renders win and loss pills in recent matches", async () => {
        mockFetch();
        renderProfile();
        await screen.findByText("minimax_bot");
        expect(screen.getByText(/^(Victoria|Win)$/i)).toBeInTheDocument();
        expect(screen.getByText(/^(Derrota|Loss)$/i)).toBeInTheDocument();
    });

    test("does not render recent matches table when empty", async () => {
        mockFetch(MINIMAL_PROFILE);
        renderProfile("minimaluser");
        await screen.findByRole("heading", { name: /minimaluser/i });
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    // ── Back button ───────────────────────────────────────────────────────────

    test("back button calls navigate(-1)", async () => {
        const user = userEvent.setup();
        mockFetch();
        renderProfile();
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Volver al inicio|Back to home/i }));
        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    // ── Logout ────────────────────────────────────────────────────────────────

    test("logout clears storage and navigates to root", async () => {
        const user = userEvent.setup();
        mockFetch();
        renderProfile();
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Salir|Logout/i }));
        expect(localStorage.getItem("username")).toBeNull();
        expect(localStorage.getItem("token")).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    // ── Edit button visibility ────────────────────────────────────────────────

    test("edit button is visible when current user is the profile owner", async () => {
        mockFetch();
        renderProfile("testuser", "testuser"); // owner viewing own profile
        await screen.findByRole("heading", { name: /testuser/i });
        expect(screen.getByRole("button", { name: /Editar perfil|Edit profile/i })).toBeInTheDocument();
    });

    test("edit button is NOT visible when viewing another user's profile", async () => {
        mockFetch();
        renderProfile("testuser", "otheruser"); // different user
        await screen.findByRole("heading", { name: /testuser/i });
        expect(screen.queryByRole("button", { name: /Editar perfil|Edit profile/i })).not.toBeInTheDocument();
    });

    // ── Edit modal: open ──────────────────────────────────────────────────────

    test("clicking edit button opens the modal", async () => {
        const user = userEvent.setup();
        mockFetch();
        renderProfile("testuser", "testuser");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        expect(screen.getByRole("heading", { name: /Editar perfil|Edit profile/i })).toBeInTheDocument();
    });

    test("modal pre-fills fields with current profile data", async () => {
        const user = userEvent.setup();
        mockFetch();
        renderProfile("testuser", "testuser");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
        expect(screen.getByDisplayValue("I love board games")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Oviedo")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Spain")).toBeInTheDocument();
    });

    // ── Edit modal: close ─────────────────────────────────────────────────────

    test("clicking ✕ closes the modal", async () => {
        const user = userEvent.setup();
        mockFetch();
        renderProfile("testuser", "testuser");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        await user.click(screen.getByText("✕"));
        expect(screen.queryByRole("heading", { name: /Editar perfil|Edit profile/i })).not.toBeInTheDocument();
    });

    test("clicking Cancel closes the modal", async () => {
        const user = userEvent.setup();
        mockFetch();
        renderProfile("testuser", "testuser");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        await user.click(screen.getByRole("button", { name: /Cancelar|Cancel/i }));
        expect(screen.queryByRole("heading", { name: /Editar perfil|Edit profile/i })).not.toBeInTheDocument();
    });

    // ── Edit modal: field changes ─────────────────────────────────────────────

    test("typing in realName field updates the input", async () => {
        const user = userEvent.setup();
        mockFetch();
        renderProfile("testuser", "testuser");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        const input = screen.getByDisplayValue("Test User");
        await user.clear(input);
        await user.type(input, "New Name");
        expect(screen.getByDisplayValue("New Name")).toBeInTheDocument();
    });

    test("typing in bio textarea updates the field", async () => {
        const user = userEvent.setup();
        mockFetch();
        renderProfile("testuser", "testuser");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        const textarea = screen.getByDisplayValue("I love board games");
        await user.clear(textarea);
        await user.type(textarea, "New bio text");
        expect(screen.getByDisplayValue("New bio text")).toBeInTheDocument();
    });

    test("changing language select updates the field", async () => {
        const user = userEvent.setup();
        mockFetch();
        renderProfile("testuser", "testuser");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        await user.selectOptions(screen.getByRole("combobox"), "es");
        expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("es");
    });

    // ── Edit modal: save success ──────────────────────────────────────────────

    test("saving successfully closes modal and refetches profile", async () => {
        const user = userEvent.setup();
        // First fetch: load profile. Second: PATCH save. Third: refetch after save.
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ json: async () => ({ success: true, profile: FULL_PROFILE }) } as Response)
            .mockResolvedValueOnce({ json: async () => ({ success: true }) } as Response)
            .mockResolvedValueOnce({ json: async () => ({ success: true, profile: { ...FULL_PROFILE, realName: "Updated" } }) } as Response);

        renderProfile("testuser", "testuser");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        await user.click(screen.getByRole("button", { name: /Guardar|Save/i }));

        await waitFor(() => {
            expect(screen.queryByRole("heading", { name: /Editar perfil|Edit profile/i })).not.toBeInTheDocument();
        });
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    test("PATCH is called with correct URL and Authorization header", async () => {
        const user = userEvent.setup();
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ json: async () => ({ success: true, profile: FULL_PROFILE }) } as Response)
            .mockResolvedValueOnce({ json: async () => ({ success: true }) } as Response)
            .mockResolvedValueOnce({ json: async () => ({ success: true, profile: FULL_PROFILE }) } as Response);

        renderProfile("testuser", "testuser", "my-token");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        await user.click(screen.getByRole("button", { name: /Guardar|Save/i }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/profile/testuser",
                expect.objectContaining({
                    method: "PATCH",
                    headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
                })
            );
        });
    });

    // ── Edit modal: save error ────────────────────────────────────────────────

    test("shows error when PATCH returns success false", async () => {
        const user = userEvent.setup();
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ json: async () => ({ success: true, profile: FULL_PROFILE }) } as Response)
            .mockResolvedValueOnce({ json: async () => ({ success: false, error: "Validation failed" }) } as Response);

        renderProfile("testuser", "testuser");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        await user.click(screen.getByRole("button", { name: /Guardar|Save/i }));

        expect(await screen.findByText(/Validation failed/i)).toBeInTheDocument();
    });

    test("shows network error when PATCH fetch throws", async () => {
        const user = userEvent.setup();
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ json: async () => ({ success: true, profile: FULL_PROFILE }) } as Response)
            .mockRejectedValueOnce(new Error("Network error"));

        renderProfile("testuser", "testuser");
        await screen.findByRole("heading", { name: /testuser/i });
        await user.click(screen.getByRole("button", { name: /Editar perfil|Edit profile/i }));
        await user.click(screen.getByRole("button", { name: /Guardar|Save/i }));

        expect(await screen.findByText(/Error de red|Network error/i)).toBeInTheDocument();
    });
});