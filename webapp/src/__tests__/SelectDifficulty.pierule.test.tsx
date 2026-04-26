// ─────────────────────────────────────────────────────────────────────────────
// SelectDifficulty.pierule.test.tsx
// Tests the Pie Rule card in SelectDifficulty.
//
// The Pie Rule card is ONLY visible when gameMode === "local".
// It renders a toggle (role="switch") with aria-label matching "pierule".
// When enabled, pieRule: true is passed in navigation state.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
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

function renderSelectDifficulty(username = "pablo") {
    localStorage.clear();
    localStorage.setItem("username", username);
    return render(
        <I18nProvider>
            <MemoryRouter>
                <SelectDifficulty />
            </MemoryRouter>
        </I18nProvider>
    );
}

/** Switches to local mode by clicking the "Local" game mode button. */
async function switchToLocalMode(user: ReturnType<typeof userEvent.setup>) {
    const localBtn = screen.getAllByRole("button").find(b =>
        /^local$/i.test(b.textContent?.trim() ?? "")
    );
    if (!localBtn) throw new Error("Local mode button not found");
    await user.click(localBtn);
}

/**
 * Returns the Pie Rule card by finding the switch whose aria-label mentions
 * "pierule" and traversing up to the nearest .card ancestor.
 */
function getPieRuleCard(): HTMLElement {
    const switches = screen.getAllByRole("switch");
    // El toggle de undo tiene aria-label "Permitir deshacer"; el de pie rule es el otro
    const pieSwitch = switches.find(sw =>
        !/deshacer|undo/i.test(sw.getAttribute("aria-label") ?? "")
    );
    if (!pieSwitch) throw new Error("Pie Rule switch not found");
    return pieSwitch.closest(".card") as HTMLElement;
}

/** Returns the Pie Rule toggle switch element. */
function getPieRuleToggle(): HTMLElement {
    const switches = screen.getAllByRole("switch");
    // El toggle de undo tiene aria-label "Permitir deshacer"; el de pie rule es el otro
    const pieSwitch = switches.find(sw =>
        !/deshacer|undo/i.test(sw.getAttribute("aria-label") ?? "")
    );
    if (!pieSwitch) throw new Error("Pie Rule switch not found");
    return pieSwitch as HTMLElement;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("SelectDifficulty — Pie Rule card", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Visibility ────────────────────────────────────────────────────────────

    test("pie rule card is NOT visible in bot mode (default)", () => {
        renderSelectDifficulty();
        // In bot mode only the undo switch exists; no pierule switch
        const switches = screen.getAllByRole("switch");
        const hasPieSwitch = switches.some(sw =>
            /pierule|pie.?rule/i.test(sw.getAttribute("aria-label") ?? "")
        );
        expect(hasPieSwitch).toBe(false);
    });

    test("pie rule card IS visible when local mode is selected", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await switchToLocalMode(user);

        expect(getPieRuleCard()).toBeInTheDocument();
    });

    test("pie rule card disappears when switching back to bot mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await switchToLocalMode(user);
        // Verify it appeared
        expect(getPieRuleCard()).toBeInTheDocument();

        // Switch back to bot mode
        await user.click(screen.getByText(/vs bot|contra bot/i));

        const switches = screen.getAllByRole("switch");
        const hasPieSwitch = switches.some(sw =>
            /pierule|pie.?rule/i.test(sw.getAttribute("aria-label") ?? "")
        );
        expect(hasPieSwitch).toBe(false);
    });

    // ── Card content ──────────────────────────────────────────────────────────

    test("pie rule card renders a title", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        const card = getPieRuleCard();
        expect(within(card).getByRole("heading")).toBeInTheDocument();
    });

    test("pie rule card renders a description paragraph", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        const card = getPieRuleCard();
        // The card should have at least one <p> with description text
        expect(card.querySelector("p")).not.toBeNull();
    });

    // ── Default state ─────────────────────────────────────────────────────────

    test("pie rule toggle is OFF by default", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        expect(getPieRuleToggle()).toHaveAttribute("aria-checked", "false");
    });

    // ── Toggle interaction ────────────────────────────────────────────────────

    test("clicking the toggle sets aria-checked to true", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        await user.click(getPieRuleToggle());

        expect(getPieRuleToggle()).toHaveAttribute("aria-checked", "true");
    });

    test("clicking the toggle twice returns it to OFF", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        await user.click(getPieRuleToggle());
        await user.click(getPieRuleToggle());

        expect(getPieRuleToggle()).toHaveAttribute("aria-checked", "false");
    });

    test("toggling pie rule does not affect undo switch state", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        // The undo switch (first switch) should stay unchecked
        const undoSwitch = screen.getAllByRole("switch").find(sw =>
            /deshacer|undo/i.test(sw.getAttribute("aria-label") ?? "")
        );

        await user.click(getPieRuleToggle());

        expect(undoSwitch).toHaveAttribute("aria-checked", "false");
    });

    // ── Navigation state ──────────────────────────────────────────────────────

    test("navigates with pieRule: false when toggle is off (default)", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ pieRule: false }),
                })
            );
        });
    });

    test("navigates with pieRule: true when toggle is on", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        await user.click(getPieRuleToggle());
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ pieRule: true }),
                })
            );
        });
    });

    test("pieRule: false is sent after toggling on then off", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        await user.click(getPieRuleToggle()); // ON
        await user.click(getPieRuleToggle()); // OFF
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ pieRule: false }),
                })
            );
        });
    });

    // ── Compatibility with other settings ─────────────────────────────────────

    test("pie rule does not interfere with board size selection", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        await user.click(screen.getByRole("button", { name: /^9$/ }));
        await user.click(getPieRuleToggle());
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ boardSize: 9, pieRule: true }),
                })
            );
        });
    });

    test("pie rule does not interfere with timer selection", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        await user.click(screen.getByRole("button", { name: /^30s$/ }));
        await user.click(getPieRuleToggle());
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ timerSeconds: 30, pieRule: true }),
                })
            );
        });
    });

    test("pie rule and undo can both be enabled simultaneously", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        // Enable undo (first switch = undo toggle)
        const undoSwitch = screen.getAllByRole("switch").find(sw =>
            /deshacer|undo/i.test(sw.getAttribute("aria-label") ?? "")
        ) as HTMLElement;
        await user.click(undoSwitch);

        // Enable pie rule
        await user.click(getPieRuleToggle());
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ allowUndo: true, pieRule: true }),
                })
            );
        });
    });

    // ── Pie rule is NOT sent in bot mode ──────────────────────────────────────

    test("navigation state in bot mode does NOT contain pieRule key", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByText(/Fácil|Easy/i));
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });

        const calledState = (mockNavigate.mock.calls[0][1] as { state: Record<string, unknown> }).state;
        expect(calledState).not.toHaveProperty("pieRule");
    });
});