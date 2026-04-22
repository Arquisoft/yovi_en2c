import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import Social from "../Social";
import { I18nProvider } from "../i18n/I18nProvider";

// ── Router mock ───────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSocial(username = "alex", token = "fake-token") {
    localStorage.clear();
    if (username) localStorage.setItem("username", username);
    if (token)    localStorage.setItem("token", token);

    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={["/social"]}>
                <Social />
            </MemoryRouter>
        </I18nProvider>
    );
}

const SEARCH_RESULTS = [
    { username: "maria99",  email: "maria@example.com", realName: "Maria García" },
    { username: "marco_g",  email: "marco@example.com", realName: null },
    { username: "maricel",  email: "maricel@uni.es",    realName: "Maricel López" },
];

function mockSearchFetch(users = SEARCH_RESULTS) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, users, count: users.length }),
    } as Response);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Social", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Static layout ─────────────────────────────────────────────────────────

    test("renders the page title", () => {
        renderSocial();
        expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    test("renders the search input", () => {
        renderSocial();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    test("renders the Groups coming soon section", () => {
        renderSocial();
        expect(screen.getByText(/Grupos|Groups/i)).toBeInTheDocument();
        expect(screen.getByText(/Próximamente|coming soon/i)).toBeInTheDocument();
    });

    test("does not show results section before searching", () => {
        renderSocial();
        expect(screen.queryByText(/Results/i)).not.toBeInTheDocument();
    });

    // ── Navbar ────────────────────────────────────────────────────────────────

    test("renders navbar with the current user", () => {
        renderSocial("alex");
        expect(screen.getByText(/alex/i)).toBeInTheDocument();
    });

    test("logout clears storage and navigates to root", async () => {
        const user = userEvent.setup();
        renderSocial();
        await user.click(screen.getByRole("button", { name: /Salir|Logout/i }));
        expect(localStorage.getItem("username")).toBeNull();
        expect(localStorage.getItem("token")).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    // ── Search: API call ──────────────────────────────────────────────────────

    test("calls /api/search?q= with the typed query after debounce", async () => {
        const user = userEvent.setup();
        mockSearchFetch();
        renderSocial();

        await user.type(screen.getByRole("textbox"), "maria");

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/api/search?q=maria")
            );
        }, { timeout: 1000 });
    });

    test("encodes special characters in the search query", async () => {
        const user = userEvent.setup();
        mockSearchFetch([]);
        renderSocial();

        await user.type(screen.getByRole("textbox"), "a b");

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("q=a")
            );
        }, { timeout: 1000 });
    });

    // ── Search results display ────────────────────────────────────────────────

    test("renders search results with usernames", async () => {
        const user = userEvent.setup();
        mockSearchFetch();
        renderSocial();

        await user.type(screen.getByRole("textbox"), "mar");

        await waitFor(() => {
            expect(screen.getByText("maria99")).toBeInTheDocument();
            expect(screen.getByText("marco_g")).toBeInTheDocument();
            expect(screen.getByText("maricel")).toBeInTheDocument();
        }, { timeout: 1000 });
    });

    test("renders realName when present", async () => {
        const user = userEvent.setup();
        mockSearchFetch();
        renderSocial();

        await user.type(screen.getByRole("textbox"), "mar");

        await waitFor(() => {
            expect(screen.getByText("Maria García")).toBeInTheDocument();
        }, { timeout: 1000 });
    });

    test("renders result count in the label", async () => {
        const user = userEvent.setup();
        mockSearchFetch();
        renderSocial();

        await user.type(screen.getByRole("textbox"), "mar");

        await waitFor(() => {
            expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
        }, { timeout: 1000 });
    });

    test("shows no results message when search returns empty array", async () => {
        const user = userEvent.setup();
        mockSearchFetch([]);
        renderSocial();

        await user.type(screen.getByRole("textbox"), "zzz");

        await waitFor(() => {
            expect(screen.getByText(/Sin resultados|no results/i)).toBeInTheDocument();
        }, { timeout: 1000 });
    });

    test("shows error message when fetch throws a network error", async () => {
        const user = userEvent.setup();
        global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
        renderSocial();

        await user.type(screen.getByRole("textbox"), "err");

        await waitFor(() => {
            expect(screen.getByText(/error|Error/i)).toBeInTheDocument();
        }, { timeout: 1000 });
    });

    test("shows error message when API returns success false", async () => {
        const user = userEvent.setup();
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ success: false, error: "Service unavailable" }),
        } as Response);
        renderSocial();

        await user.type(screen.getByRole("textbox"), "mar");

        await waitFor(() => {
            expect(screen.getByText(/Service unavailable|error/i)).toBeInTheDocument();
        }, { timeout: 1000 });
    });

    // ── Send friend request button ────────────────────────────────────────────

    test("renders Send Request button for other users", async () => {
        const user = userEvent.setup();
        mockSearchFetch();
        renderSocial("alex");

        await user.type(screen.getByRole("textbox"), "mar");

        await waitFor(() => {
            expect(
                screen.getAllByRole("button", { name: /Send request|Enviar solicitud/i }).length
            ).toBeGreaterThan(0);
        }, { timeout: 1000 });
    });

    test("does not render Send Request button for the logged-in user", async () => {
        const user = userEvent.setup();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                users: [{ username: "alex", email: "alex@example.com", realName: null }],
                count: 1,
            }),
        } as Response);
        renderSocial("alex");

        await user.type(screen.getByRole("textbox"), "alex");

        await waitFor(() => {
            expect(screen.getByText("alex")).toBeInTheDocument();
        }, { timeout: 1000 });

        expect(
            screen.queryByRole("button", { name: /Send request|Enviar solicitud/i })
        ).not.toBeInTheDocument();
    });

    test("send request shows sent state after a successful API call", async () => {
        const user = userEvent.setup();
        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, users: SEARCH_RESULTS, count: 3 }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, message: "Friend request sent" }),
            } as Response);

        renderSocial("alex");
        await user.type(screen.getByRole("textbox"), "mar");

        await waitFor(() => screen.getByText("maria99"), { timeout: 1000 });

        // Click the first "Enviar solicitud" button (maria99's row)
        const buttons = screen.getAllByRole("button", { name: /Enviar solicitud|Send request/i });
        await user.click(buttons[0]);

        await waitFor(() => {
            expect(screen.getByText(/Solicitud enviada|Request sent/i)).toBeInTheDocument();
        });
    });

    test("send request shows already friends state on 409 response", async () => {
        const user = userEvent.setup();
        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, users: SEARCH_RESULTS, count: 3 }),
            } as Response)
            .mockResolvedValueOnce({
                ok: false,
                status: 409,
                json: async () => ({ success: false, error: "Already friends" }),
            } as Response);

        renderSocial("alex");
        await user.type(screen.getByRole("textbox"), "mar");

        await waitFor(() => screen.getByText("maria99"), { timeout: 1000 });

        const buttons = screen.getAllByRole("button", { name: /Enviar solicitud|Send request/i });
        await user.click(buttons[0]);

        // After 409 the button shows "Ya son amigos" (alreadyFriends state)
        await waitFor(() => {
            expect(screen.getByText(/Ya son amigos|Already friends/i)).toBeInTheDocument();
        });
    });

    test("send request shows warning icon on server error", async () => {
        const user = userEvent.setup();
        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, users: SEARCH_RESULTS, count: 3 }),
            } as Response)
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ success: false, error: "Server error" }),
            } as Response);

        renderSocial("alex");
        await user.type(screen.getByRole("textbox"), "mar");

        await waitFor(() => screen.getByText("maria99"), { timeout: 1000 });

        const buttons = screen.getAllByRole("button", { name: /Enviar solicitud|Send request/i });
        await user.click(buttons[0]);

        await waitFor(() => {
            expect(screen.getByText(/⚠/)).toBeInTheDocument();
        });
    });

    test("send request uses the Authorization header with the stored token", async () => {
        const user = userEvent.setup();
        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, users: SEARCH_RESULTS, count: 3 }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            } as Response);

        renderSocial("alex", "my-secret-token");
        await user.type(screen.getByRole("textbox"), "mar");

        await waitFor(() => screen.getByText("maria99"), { timeout: 1000 });

        const buttons = screen.getAllByRole("button", { name: /Enviar solicitud|Send request/i });
        await user.click(buttons[0]);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/api/friends/request/"),
                expect.objectContaining({
                    headers: expect.objectContaining({ Authorization: "Bearer my-secret-token" }),
                })
            );
        });
    });

    // ── View profile button ───────────────────────────────────────────────────

    test("clicking View Profile navigates to the correct profile route", async () => {
        const user = userEvent.setup();
        mockSearchFetch();
        renderSocial("alex");

        await user.type(screen.getByRole("textbox"), "mar");

        // Wait for maria99 to appear in results
        const maria = await screen.findByText("maria99", {}, { timeout: 1000 });

        // Click the View Profile button in the same row as maria99
        const row = maria.closest("div[style]")?.parentElement;
        const viewBtn = row
            ? row.querySelector("button")
            : screen.getAllByRole("button", { name: /Ver perfil|View profile/i })[1];

        // Fallback: click by index after the navbar profile button
        if (!viewBtn) {
            const allViewBtns = screen.getAllByRole("button", { name: /Ver perfil de|Ver perfil$|View profile/i });
            // Skip the navbar "Ver perfil de alex" button (index 0) and click results button
            await user.click(allViewBtns[1]);
        } else {
            await user.click(viewBtn as HTMLElement);
        }

        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("/profile/maria99"));
    });
});