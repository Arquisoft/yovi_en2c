// ─────────────────────────────────────────────────────────────────────────────
// SelectDifficulty.pieRule.test.tsx
// Tests the Pie Rule toggle card in SelectDifficulty.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import SelectDifficulty from "../SelectDifficulty";
import { I18nProvider } from "../i18n/I18nProvider";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helper ────────────────────────────────────────────────────────────────────

function renderSD(username = "pablo") {
    localStorage.setItem("username", username);
    return render(
        <I18nProvider>
            <MemoryRouter>
                <SelectDifficulty />
            </MemoryRouter>
        </I18nProvider>
    );
}

// Pick the first difficulty button
async function selectFirstDifficulty(user: ReturnType<typeof userEvent.setup>) {
    const btns = screen.getAllByRole("button").filter(
        b => /f[áa]cil|easy|medio|medium|dif[íi]cil|hard|experto|expert|extremo|extreme/i
            .test(b.textContent ?? "")
    );
    if (btns.length > 0) await user.click(btns[0]);
}

async function clickStart(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("SelectDifficulty — Pie Rule card", () => {

    beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockNavigate.mockReset(); });
    afterEach (() => { vi.clearAllMocks(); localStorage.clear(); });

    // ── Rendering ─────────────────────────────────────────────────────────────

    test("renders the Pie Rule card title", () => {
        renderSD();
        expect(screen.getByText(/pie rule|regla del pastel/i)).toBeInTheDocument();
    });

    test("renders the Pie Rule toggle switch", () => {
        renderSD();
        // There are two switches (undo + pie rule) — pick the one for pie rule
        const switches = screen.getAllByRole("switch");
        expect(switches.length).toBeGreaterThanOrEqual(2);
    });

    test("Pie Rule toggle is OFF by default", () => {
        renderSD();
        const toggle = screen.getByTestId("pie-rule-toggle");
        expect(toggle).toHaveAttribute("aria-checked", "false");
    });

    test("hint pill is NOT visible when toggle is off", () => {
        renderSD();
        expect(
            screen.queryByText(/después del primer movimiento|after the first move/i)
        ).not.toBeInTheDocument();
    });

    // ── Toggle interaction ────────────────────────────────────────────────────

    test("clicking the Pie Rule toggle sets aria-checked to true", async () => {
        const user = userEvent.setup();
        renderSD();

        await user.click(screen.getByTestId("pie-rule-toggle"));

        expect(screen.getByTestId("pie-rule-toggle")).toHaveAttribute("aria-checked", "true");
    });

    test("clicking the toggle twice returns it to OFF", async () => {
        const user = userEvent.setup();
        renderSD();

        await user.click(screen.getByTestId("pie-rule-toggle"));
        await user.click(screen.getByTestId("pie-rule-toggle"));

        expect(screen.getByTestId("pie-rule-toggle")).toHaveAttribute("aria-checked", "false");
    });

    test("enabling the toggle shows the hint pill", async () => {
        const user = userEvent.setup();
        renderSD();

        await user.click(screen.getByTestId("pie-rule-toggle"));

        expect(
            screen.getByText(/después del primer movimiento|after the first move/i)
        ).toBeInTheDocument();
    });

    test("disabling the toggle hides the hint pill again", async () => {
        const user = userEvent.setup();
        renderSD();

        await user.click(screen.getByTestId("pie-rule-toggle")); // ON
        await user.click(screen.getByTestId("pie-rule-toggle")); // OFF

        expect(
            screen.queryByText(/después del primer movimiento|after the first move/i)
        ).not.toBeInTheDocument();
    });

    // ── Navigation state ──────────────────────────────────────────────────────

    test("navigates with pieRule=false when toggle is off", async () => {
        const user = userEvent.setup();
        renderSD();

        await selectFirstDifficulty(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ pieRule: false }),
                })
            );
        });
    });

    test("navigates with pieRule=true when toggle is on", async () => {
        const user = userEvent.setup();
        renderSD();

        await user.click(screen.getByTestId("pie-rule-toggle"));
        await selectFirstDifficulty(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ pieRule: true }),
                })
            );
        });
    });

    // ── Compatibility with other settings ─────────────────────────────────────

    test("Pie Rule does not interfere with board size selection", async () => {
        const user = userEvent.setup();
        renderSD();

        await user.click(screen.getByRole("button", { name: "9" }));
        await user.click(screen.getByTestId("pie-rule-toggle"));
        await selectFirstDifficulty(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ boardSize: 9, pieRule: true }),
                })
            );
        });
    });

    test("Pie Rule does not interfere with timer selection", async () => {
        const user = userEvent.setup();
        renderSD();

        await user.click(screen.getByRole("button", { name: "30s" }));
        await user.click(screen.getByTestId("pie-rule-toggle"));
        await selectFirstDifficulty(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ timerSeconds: 30, pieRule: true }),
                })
            );
        });
    });

    test("Pie Rule and Undo can both be enabled simultaneously", async () => {
        const user = userEvent.setup();
        renderSD();

        // Enable undo
        const undoToggle = screen.getAllByRole("switch")[0]; // first switch = undo
        await user.click(undoToggle);

        // Enable Pie Rule
        await user.click(screen.getByTestId("pie-rule-toggle"));

        await selectFirstDifficulty(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ allowUndo: true, pieRule: true }),
                })
            );
        });
    });
});
