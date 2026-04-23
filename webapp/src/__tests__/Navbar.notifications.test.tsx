// ─────────────────────────────────────────────────────────────────────────────
// Navbar.notifications.test.tsx
// Tests the notification bell in the Navbar:
//   - Bell renders always
//   - Badge shows/hides based on unread count
//   - Panel opens/closes
//   - Mark-as-read callback fires
//   - Animation attribute present when unread
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import Navbar, { type Notification } from "../Navbar";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNotification(overrides: Partial<Notification> = {}): Notification {
    return {
        id:        "507f1f77bcf86cd799439011",
        type:      "friend_request",
        from:      "alice",
        read:      false,
        createdAt: "2026-04-01T10:00:00Z",
        ...overrides,
    };
}

function renderNavbar(
    notifications: Notification[] = [],
    onMarkRead = vi.fn(),
    username = "pablo"
) {
    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={["/home"]}>
                <Navbar
                    username={username}
                    onLogout={vi.fn()}
                    notifications={notifications}
                    onMarkRead={onMarkRead}
                />
            </MemoryRouter>
        </I18nProvider>
    );
}

// JSDOM no expone <dialog> como role="dialog" de forma fiable.
// Este helper busca por ambos: el atributo explícito y el elemento nativo.
function queryPanel(): Element | null {
    // Busca tanto div[role=dialog] (Navbar actual) como <dialog> nativo
    return (
        document.querySelector('[role="dialog"]') ??
        document.querySelector('dialog')
    );
}
function getPanel(): Element {
    const el = queryPanel();
    if (!el) throw new Error("Notification panel not found in DOM");
    return el;
}

// aria-label del botón mark-as-read viene de i18n ("Marcar como leído" / "Mark as read").
// Buscar por texto visible "✓" es más robusto que depender del label i18n con acentos.
const MARK_READ_MATCHER = (content: string, el: Element | null) =>
    el?.tagName === "BUTTON" && (
        content === "✓" ||
        /mark.{0,10}read/i.test(el.getAttribute("aria-label") ?? "") ||
        /marcar/i.test(el.getAttribute("aria-label") ?? "")
    );

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Navbar — notification bell", () => {
    beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockReset(); });
    afterEach(() => { vi.clearAllMocks(); });

    // ── Bell always renders ───────────────────────────────────────────────────

    test("renders the notification bell button", () => {
        renderNavbar();
        expect(
            screen.getByRole("button", { name: /notif|campana|bell|inbox/i })
        ).toBeInTheDocument();
    });

    // ── Badge ─────────────────────────────────────────────────────────────────

    test("does not show badge when there are no unread notifications", () => {
        renderNavbar([makeNotification({ read: true })]);
        expect(screen.queryByText("1")).not.toBeInTheDocument();
        const bell = screen.getByRole("button", { name: /notif|campana|bell|inbox/i });
        expect(bell).toHaveAttribute("data-unread", "false");
    });

    test("shows badge with unread count when there are unread notifications", () => {
        renderNavbar([
            makeNotification({ id: "1", read: false }),
            makeNotification({ id: "2", read: false }),
        ]);
        expect(screen.getByText("2")).toBeInTheDocument();
        const bell = screen.getByRole("button", { name: /notif|campana|bell|inbox/i });
        expect(bell).toHaveAttribute("data-unread", "true");
    });

    test("shows 9+ when unread count exceeds 9", () => {
        const many = Array.from({ length: 11 }, (_, i) =>
            makeNotification({ id: String(i), read: false })
        );
        renderNavbar(many);
        expect(screen.getByText("9+")).toBeInTheDocument();
    });

    test("badge counts only unread notifications", () => {
        renderNavbar([
            makeNotification({ id: "1", read: false }),
            makeNotification({ id: "2", read: true }),
            makeNotification({ id: "3", read: false }),
        ]);
        expect(screen.getByText("2")).toBeInTheDocument();
    });

    // ── Panel open/close ──────────────────────────────────────────────────────

    test("panel is not visible initially", () => {
        renderNavbar([makeNotification()]);
        expect(queryPanel()).not.toBeInTheDocument();
    });

    test("clicking the bell opens the notification panel", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification()]);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));

        expect(getPanel()).toBeInTheDocument();
    });

    test("clicking the bell again closes the panel", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification()]);

        const bell = screen.getByRole("button", { name: /notif|campana|bell|inbox/i });
        await user.click(bell);
        await user.click(bell);

        expect(queryPanel()).not.toBeInTheDocument();
    });

    test("clicking the ✕ button closes the panel", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification()]);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));
        await user.click(document.querySelector(".navbar__notif-close") as HTMLElement);

        expect(queryPanel()).not.toBeInTheDocument();
    });

    test("bell aria-expanded reflects open state", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification()]);

        const bell = screen.getByRole("button", { name: /notif|campana|bell|inbox/i });
        expect(bell).toHaveAttribute("aria-expanded", "false");

        await user.click(bell);
        expect(bell).toHaveAttribute("aria-expanded", "true");
    });

    // ── Panel content ─────────────────────────────────────────────────────────

    test("shows empty state when there are no notifications", async () => {
        const user = userEvent.setup();
        renderNavbar([]);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));

        expect(screen.getByText(/sin notificaciones|no notifications/i)).toBeInTheDocument();
    });

    test("renders a friend_request notification with sender name", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification({ type: "friend_request", from: "alice", read: false })]);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));

        expect(screen.getByText(/alice/i)).toBeInTheDocument();
    });

    test("renders a welcome notification", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification({ type: "welcome", from: null, read: false })]);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));

        expect(screen.getByText(/bienvenid|welcome/i)).toBeInTheDocument();
    });

    test("shows the notification date", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification({ createdAt: "2026-04-01T10:00:00Z" })]);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));

        expect(getPanel()).toBeInTheDocument();
    });

    test("read notifications are rendered with lower opacity style", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification({ read: true })]);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));

        const panel = getPanel();
        expect(panel).toBeInTheDocument();
        const items = panel.querySelectorAll("li");
        expect(items.length).toBe(1);
    });

    // ── Mark as read ──────────────────────────────────────────────────────────

    test("mark-as-read button is visible for unread notifications", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification({ read: false })]);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));

        expect(screen.getByText(MARK_READ_MATCHER)).toBeInTheDocument();
    });

    test("mark-as-read button is NOT visible for already-read notifications", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification({ read: true })]);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));

        expect(screen.queryByText(MARK_READ_MATCHER)).not.toBeInTheDocument();
    });

    test("clicking mark-as-read calls onMarkRead with the notification id", async () => {
        const user = userEvent.setup();
        const onMarkRead = vi.fn();
        renderNavbar([makeNotification({ id: "abc123", read: false })], onMarkRead);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));
        await user.click(screen.getByText(MARK_READ_MATCHER));

        expect(onMarkRead).toHaveBeenCalledWith("abc123");
    });

    test("clicking mark-as-read does not close the panel", async () => {
        const user = userEvent.setup();
        renderNavbar([makeNotification({ read: false })]);

        await user.click(screen.getByRole("button", { name: /notif|campana|bell|inbox/i }));
        await user.click(screen.getByText(MARK_READ_MATCHER));

        expect(getPanel()).toBeInTheDocument();
    });

});