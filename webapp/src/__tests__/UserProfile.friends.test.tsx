// ─────────────────────────────────────────────────────────────────────────────
// UserProfile.friends.test.tsx
// Tests for the friends system additions in UserProfile:
//   - FriendRequestsCard (only visible to owner)
//   - FriendsListCard (only visible to owner)
//   - Send Friend Request button (only visible to visitors)
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import UserProfile from "../UserProfile";
import { I18nProvider } from "../i18n/I18nProvider";

// ── Router mock ───────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderProfile(
    profileUsername = "testuser",
    currentUser = "testuser",
    token = "fake-token"
) {
    localStorage.clear();
    if (currentUser) localStorage.setItem("username", currentUser);
    if (token)       localStorage.setItem("token", token);

    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={[`/profile/${profileUsername}`]}>
                <Routes>
                    <Route path="/profile/:username" element={<UserProfile />} />
                </Routes>
            </MemoryRouter>
        </I18nProvider>
    );
}

// Profile factory — merges overrides so each test can focus on one field
function makeProfile(overrides: Record<string, unknown> = {}) {
    return {
        username:          "testuser",
        realName:          "Test User",
        bio:               "I love board games",
        location:          { city: "Oviedo", country: "Spain" },
        preferredLanguage: "en",
        joinDate:          "2024-01-01T00:00:00.000Z",
        stats:             { totalGames: 5, wins: 3, losses: 2, winRate: 60 },
        recentMatches:     [],
        friends:           [] as string[],
        friendRequests:    [] as string[],
        ...overrides,
    };
}

function mockFetch(profile = makeProfile()) {
    global.fetch = vi.fn().mockResolvedValueOnce({
        json: async () => ({ success: true, profile }),
    } as Response);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("UserProfile — Friends system", () => {
    beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockNavigate.mockReset(); });
    afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

    // ── FriendRequestsCard: visibility ────────────────────────────────────────

    test("friend requests card is visible to the profile owner", async () => {
        mockFetch(makeProfile({ friendRequests: ["jorge_r"] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => {
            expect(
                screen.getByText(/Incoming friend requests|Solicitudes de amistad/i)
            ).toBeInTheDocument();
        });
    });

    test("friend requests card is NOT visible to a visitor", async () => {
        mockFetch(makeProfile({ friendRequests: ["jorge_r"] }));
        renderProfile("testuser", "otheruser");

        await screen.findByRole("heading", { name: /testuser/i });

        expect(
            screen.queryByText(/Incoming friend requests|Solicitudes de amistad/i)
        ).not.toBeInTheDocument();
    });

    // ── FriendRequestsCard: empty state ───────────────────────────────────────

    test("shows empty state when there are no pending requests", async () => {
        mockFetch(makeProfile({ friendRequests: [] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => {
            expect(
                screen.getByText(/Incoming friend requests|Solicitudes de amistad/i)
            ).toBeInTheDocument();
        });

        expect(
            screen.getByText(/No pending requests|Sin solicitudes pendientes/i)
        ).toBeInTheDocument();
    });

    // ── FriendRequestsCard: renders senders ───────────────────────────────────

    test("renders each pending request sender's username", async () => {
        mockFetch(makeProfile({ friendRequests: ["jorge_r", "lucia_c"] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => {
            expect(screen.getByText("jorge_r")).toBeInTheDocument();
            expect(screen.getByText("lucia_c")).toBeInTheDocument();
        });
    });

    test("renders Accept button for each pending request", async () => {
        mockFetch(makeProfile({ friendRequests: ["jorge_r", "lucia_c"] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => {
            expect(
                screen.getAllByRole("button", { name: /Accept|Aceptar/i }).length
            ).toBe(2);
        });
    });

    test("renders the badge count matching the number of pending requests", async () => {
        mockFetch(makeProfile({ friendRequests: ["u1", "u2", "u3"] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => {
            expect(screen.getByText("3")).toBeInTheDocument();
        });
    });

    // ── FriendRequestsCard: accept flow ───────────────────────────────────────

    test("clicking Accept calls /api/friends/accept/:username with JWT", async () => {
        const user = userEvent.setup();

        // First fetch: load profile. Second: accept request. Third: refetch.
        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                json: async () => ({
                    success: true,
                    profile: makeProfile({ friendRequests: ["jorge_r"] }),
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, message: "Now friends" }),
            } as Response)
            .mockResolvedValueOnce({
                json: async () => ({
                    success: true,
                    profile: makeProfile({ friends: ["jorge_r"], friendRequests: [] }),
                }),
            } as Response);

        renderProfile("testuser", "testuser", "my-token");

        await waitFor(() => screen.getByText("jorge_r"));

        await user.click(screen.getByRole("button", { name: /Accept|Aceptar/i }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/friends/accept/jorge_r",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
                })
            );
        });
    });

    test("after accepting a request the profile is refetched", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                json: async () => ({
                    success: true,
                    profile: makeProfile({ friendRequests: ["jorge_r"] }),
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            } as Response)
            .mockResolvedValueOnce({
                json: async () => ({
                    success: true,
                    profile: makeProfile({ friends: ["jorge_r"], friendRequests: [] }),
                }),
            } as Response);

        renderProfile("testuser", "testuser");
        await waitFor(() => screen.getByText("jorge_r"));
        await user.click(screen.getByRole("button", { name: /Accept|Aceptar/i }));

        // Should have fetched 3 times total
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
    });

    test("shows per-row error message when accept request fails", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                json: async () => ({
                    success: true,
                    profile: makeProfile({ friendRequests: ["jorge_r"] }),
                }),
            } as Response)
            .mockResolvedValueOnce({
                ok: false,
                json: async () => ({ success: false, error: "Request not found" }),
            } as Response);

        renderProfile("testuser", "testuser");
        await waitFor(() => screen.getByText("jorge_r"));
        await user.click(screen.getByRole("button", { name: /Accept|Aceptar/i }));

        await waitFor(() => {
            expect(screen.getByText(/Request not found|error/i)).toBeInTheDocument();
        });
    });

    // ── FriendsListCard: visibility ───────────────────────────────────────────

    test("friends list card is visible to the profile owner", async () => {
        mockFetch(makeProfile({ friends: ["maria99"] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => {
            expect(screen.getByText(/^Friends$/i)).toBeInTheDocument();
        });
    });

    test("friends list card is NOT visible to a visitor", async () => {
        mockFetch(makeProfile({ friends: ["maria99"] }));
        renderProfile("testuser", "otheruser");

        await screen.findByRole("heading", { name: /testuser/i });

        // "Friends" heading should not appear for visitors
        expect(
            screen.queryByRole("heading", { name: /^Friends$/i })
        ).not.toBeInTheDocument();
    });

    // ── FriendsListCard: empty state ──────────────────────────────────────────

    test("shows empty friends message when list is empty", async () => {
        mockFetch(makeProfile({ friends: [] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => screen.getByText(/^Friends$/i));

        expect(
            screen.getByText(/No friends yet|Aún no tienes amigos/i)
        ).toBeInTheDocument();
    });

    // ── FriendsListCard: renders friends ──────────────────────────────────────

    test("renders each friend's username in the list", async () => {
        mockFetch(makeProfile({ friends: ["maria99", "pedro_e", "sofia_o"] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => {
            expect(screen.getByText("maria99")).toBeInTheDocument();
            expect(screen.getByText("pedro_e")).toBeInTheDocument();
            expect(screen.getByText("sofia_o")).toBeInTheDocument();
        });
    });

    test("renders View Profile button for each friend", async () => {
        mockFetch(makeProfile({ friends: ["maria99", "pedro_e"] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => {
            expect(
                screen.getAllByRole("button", { name: /View profile|Ver perfil/i }).length
            ).toBeGreaterThanOrEqual(2);
        });
    });

    test("renders the friends count badge", async () => {
        mockFetch(makeProfile({ friends: ["a", "b", "c"] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => {
            expect(screen.getByText("3")).toBeInTheDocument();
        });
    });

    test("clicking View Profile for a friend navigates to their profile", async () => {
        const user = userEvent.setup();
        mockFetch(makeProfile({ friends: ["maria99"] }));
        renderProfile("testuser", "testuser");

        await waitFor(() => screen.getByText("maria99"));

        await user.click(
            screen.getAllByRole("button", { name: /View profile|Ver perfil/i })[0]
        );

        expect(mockNavigate).toHaveBeenCalledWith("/profile/maria99");
    });

    // ── Send Friend Request button ────────────────────────────────────────────

    test("Send Friend Request button is visible when visiting another user's profile", async () => {
        mockFetch(makeProfile({ friends: [] }));
        renderProfile("testuser", "otheruser");

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: /Send friend request|Enviar solicitud/i })
            ).toBeInTheDocument();
        });
    });

    test("Send Friend Request button is NOT visible on own profile", async () => {
        mockFetch();
        renderProfile("testuser", "testuser");

        await screen.findByRole("heading", { name: /testuser/i });

        expect(
            screen.queryByRole("button", { name: /Send friend request|Enviar solicitud/i })
        ).not.toBeInTheDocument();
    });

    test("shows Already Friends badge when visitor is already friends with the profile owner", async () => {
        // The profile's friends array contains the currentUser
        mockFetch(makeProfile({ friends: ["otheruser"] }));
        renderProfile("testuser", "otheruser");

        await waitFor(() => {
            expect(
                screen.getByText(/Already friends|Ya sois amigos/i)
            ).toBeInTheDocument();
        });
    });

    test("clicking Send Friend Request calls /api/friends/request/:username with JWT", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                json: async () => ({ success: true, profile: makeProfile({ friends: [] }) }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, message: "Request sent" }),
            } as Response);

        renderProfile("testuser", "otheruser", "visitor-token");

        await waitFor(() =>
            screen.getByRole("button", { name: /Send friend request|Enviar solicitud/i })
        );

        await user.click(
            screen.getByRole("button", { name: /Send friend request|Enviar solicitud/i })
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/friends/request/testuser",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({ Authorization: "Bearer visitor-token" }),
                })
            );
        });
    });

    test("button shows sent state after successful friend request", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                json: async () => ({ success: true, profile: makeProfile({ friends: [] }) }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            } as Response);

        renderProfile("testuser", "otheruser");
        await waitFor(() =>
            screen.getByRole("button", { name: /Send friend request|Enviar solicitud/i })
        );
        await user.click(
            screen.getByRole("button", { name: /Send friend request|Enviar solicitud/i })
        );

        await waitFor(() => {
            expect(
                screen.getByText(/Request sent|Solicitud enviada/i)
            ).toBeInTheDocument();
        });
    });

    test("button shows already state on 409 response", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                json: async () => ({ success: true, profile: makeProfile({ friends: [] }) }),
            } as Response)
            .mockResolvedValueOnce({
                ok: false,
                status: 409,
                json: async () => ({ success: false, error: "Already friends" }),
            } as Response);

        renderProfile("testuser", "otheruser");
        await waitFor(() =>
            screen.getByRole("button", { name: /Send friend request|Enviar solicitud/i })
        );
        await user.click(
            screen.getByRole("button", { name: /Send friend request|Enviar solicitud/i })
        );

        await waitFor(() => {
            expect(
                screen.getByText(/Already friends|Ya sois amigos/i)
            ).toBeInTheDocument();
        });
    });

    test("button shows error state when request fails", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                json: async () => ({ success: true, profile: makeProfile({ friends: [] }) }),
            } as Response)
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ success: false, error: "Server error" }),
            } as Response);

        renderProfile("testuser", "otheruser");
        await waitFor(() =>
            screen.getByRole("button", { name: /Send friend request|Enviar solicitud/i })
        );
        await user.click(
            screen.getByRole("button", { name: /Send friend request|Enviar solicitud/i })
        );

        await waitFor(() => {
            expect(screen.getByText(/⚠/)).toBeInTheDocument();
        });
    });
});
