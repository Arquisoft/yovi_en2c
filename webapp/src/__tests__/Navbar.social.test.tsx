// ─────────────────────────────────────────────────────────────────────────────
// Navbar.social.test.tsx
// Añade estos tests al final de Navbar.stats.test.tsx,
// o pégalos en un archivo separado con el mismo setup.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import Navbar from "../Navbar";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

function renderNavbar(initialPath = "/home", username: string | null = "Pablo") {
    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={[initialPath]}>
                <Navbar username={username} onLogout={vi.fn()} />
            </MemoryRouter>
        </I18nProvider>
    );
}

describe("Navbar — Social button", () => {
    beforeEach(() => { vi.clearAllMocks(); });
    afterEach(() => { vi.clearAllMocks(); });

    test("renders the Social button", () => {
        renderNavbar();
        expect(
            screen.getByRole("button", { name: /^Social$/i })
        ).toBeInTheDocument();
    });

    test("navigates to /social when Social button is clicked", async () => {
        const user = userEvent.setup();
        renderNavbar();
        await user.click(screen.getByRole("button", { name: /^Social$/i }));
        expect(mockNavigate).toHaveBeenCalledWith("/social");
    });

    test("marks Social button as current page when pathname is /social", () => {
        renderNavbar("/social");
        expect(
            screen.getByRole("button", { name: /^Social$/i })
        ).toHaveAttribute("aria-current", "page");
    });

    test("does not mark Social button as current page when on /home", () => {
        renderNavbar("/home");
        expect(
            screen.getByRole("button", { name: /^Social$/i })
        ).not.toHaveAttribute("aria-current");
    });

    test("does not mark Social button as current page when on /statistics", () => {
        renderNavbar("/statistics");
        expect(
            screen.getByRole("button", { name: /^Social$/i })
        ).not.toHaveAttribute("aria-current");
    });
});
