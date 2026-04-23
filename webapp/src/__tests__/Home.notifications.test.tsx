// ─────────────────────────────────────────────────────────────────────────────
// Home.notifications.test.tsx
// Tests that Home fetches notifications after session verification
// and that mark-as-read works optimistically.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import Home from "../Home";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderHome(username = "pablo", token = "fake-token") {
    localStorage.clear();
    localStorage.setItem("username", username);
    localStorage.setItem("token", token);

    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={[{ pathname: "/home", state: { username } }]}>
                <Home />
            </MemoryRouter>
        </I18nProvider>
    );
}

const MOCK_NOTIFICATIONS = [
    {
        id: "507f1f77bcf86cd799439011",
        type: "welcome",
        from: null,
        read: false,
        createdAt: "2026-04-01T10:00:00Z",
    },
    {
        id: "507f1f77bcf86cd799439012",
        type: "friend_request",
        from: "alice",
        read: false,
        createdAt: "2026-04-02T10:00:00Z",
    },
];

// Helper to set up fetch mock for both verify + notifications calls
function mockFetchSequence(
    notificationsPayload = MOCK_NOTIFICATIONS,
    notificationsSuccess = true
) {
    global.fetch = vi.fn()
        // 1st call: /api/verify
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
        // 2nd call: /api/notifications
        .mockResolvedValueOnce({
            ok: notificationsSuccess,
            json: async () => notificationsSuccess
                ? { success: true, notifications: notificationsPayload, unreadCount: notificationsPayload.filter(n => !n.read).length }
                : { success: false, error: "Unauthorized" },
        } as Response);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Home — notifications", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Fetching ──────────────────────────────────────────────────────────────

    test("calls GET /api/notifications after session verification", async () => {
        mockFetchSequence();
        renderHome();

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/notifications",
                expect.objectContaining({
                    headers: expect.objectContaining({ Authorization: "Bearer fake-token" }),
                })
            );
        });
    });

    test("does NOT call /api/notifications when session verification fails", async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 } as Response);
        renderHome();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });

        // fetch should only have been called once (the verify call)
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test("shows unread badge on bell after loading unread notifications", async () => {
        mockFetchSequence(MOCK_NOTIFICATIONS);
        renderHome();

        // Bell badge should appear with count 2 (both unread)
        await waitFor(() => {
            expect(screen.getByText("2")).toBeInTheDocument();
        });
    });

    test("badge shows 0 and no badge element when all notifications are read", async () => {
        mockFetchSequence(MOCK_NOTIFICATIONS.map(n => ({ ...n, read: true })));
        renderHome();

        // Wait for home to render
        await screen.findByText(/Hola pablo|Hello pablo/i);

        // Badge should not be present
        expect(screen.queryByText("2")).not.toBeInTheDocument();
        expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    test("handles notification fetch error gracefully without crashing", async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
            .mockRejectedValueOnce(new Error("Network error"));

        renderHome();

        // Home should still render normally
        await screen.findByText(/Hola pablo|Hello pablo/i);
        expect(screen.getByText(/Hola pablo|Hello pablo/i)).toBeInTheDocument();
    });

    test("handles 401 from notifications endpoint gracefully", async () => {
        mockFetchSequence([], false);
        renderHome();

        await screen.findByText(/Hola pablo|Hello pablo/i);
        // No badge
        expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    // ── Mark as read ──────────────────────────────────────────────────────────

    test("clicking mark-as-read calls PATCH /api/notifications/:id/read", async () => {
        const user = userEvent.setup();

        // fetch: verify, notifications, then PATCH
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, notifications: MOCK_NOTIFICATIONS, unreadCount: 2 }),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            } as Response);

        renderHome();

        // Wait for badge to appear
        await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());

        // Open the panel
        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));

        // Click first mark-as-read button
        const markBtns = screen.getAllByRole("button", { name: /mark.*read|marcar.*le[íi]do|✓/i });
        await user.click(markBtns[0]);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/api/notifications/"),
                expect.objectContaining({ method: "PATCH" })
            );
        });
    });

    test("badge count decreases optimistically when notification is marked as read", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, notifications: MOCK_NOTIFICATIONS, unreadCount: 2 }),
            } as Response)
            .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response);

        renderHome();

        await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));

        const markBtns = screen.getAllByRole("button", { name: /mark.*read|marcar.*le[íi]do|✓/i });
        await user.click(markBtns[0]);

        // Badge should update to 1 optimistically
        await waitFor(() => {
            expect(screen.getByText("1")).toBeInTheDocument();
        });
    });

    test("reverts optimistic mark-as-read on PATCH network failure", async () => {
        const user = userEvent.setup();

        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, notifications: [MOCK_NOTIFICATIONS[0]], unreadCount: 1 }),
            } as Response)
            // PATCH fails
            .mockRejectedValueOnce(new Error("Network error"));

        renderHome();

        await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));
        await user.click(screen.getByRole("button", { name: /mark.*read|marcar.*le[íi]do|✓/i }));

        // After revert, badge should return to 1
        await waitFor(() => {
            expect(screen.getByText("1")).toBeInTheDocument();
        });
    });
});
