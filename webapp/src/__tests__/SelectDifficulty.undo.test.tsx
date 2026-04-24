// ─────────────────────────────────────────────────────────────────────────────
// SelectDifficulty.undo.test.tsx
// Tests the undo configuration card added to SelectDifficulty.
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

function renderSelectDifficulty(username = "pablo") {
    localStorage.setItem("username", username);
    return render(
        <I18nProvider>
            <MemoryRouter>
                <SelectDifficulty />
            </MemoryRouter>
        </I18nProvider>
    );
}

// Busca un botón de límite de undo por número o por "unlimited".
// Los botones tienen aria-label explícito: "N movimientos" / "N moves" / "Sin límite" / "Unlimited".
// También acepta match por texto visible para robustez.
function getUndoLimitBtn(value: number | "unlimited") {
    if (value === "unlimited") {
        return screen.getByRole("button", { name: /sin l[íi]mite|unlimited/i });
    }
    return screen.getByRole("button", {
        name: new RegExp(`^${value}$|${value}\\s*(movimiento|move)`, "i"),
    });
}

function queryUndoLimitBtn(value: number | "unlimited") {
    if (value === "unlimited") {
        return screen.queryByRole("button", { name: /sin l[íi]mite|unlimited/i });
    }
    return screen.queryByRole("button", {
        name: new RegExp(`^${value}$|${value}\\s*(movimiento|move)`, "i"),
    });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("SelectDifficulty — undo card", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Rendering ─────────────────────────────────────────────────────────────

    test("renders the undo card title", () => {
        renderSelectDifficulty();
        expect(screen.getByText(/deshacer|undo/i)).toBeInTheDocument();
    });

    test("renders the undo toggle switch", () => {
        renderSelectDifficulty();
        expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    test("undo toggle is OFF by default", () => {
        renderSelectDifficulty();
        expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });

    test("undo limit buttons are NOT visible when toggle is off", () => {
        renderSelectDifficulty();
        expect(queryUndoLimitBtn(1)).not.toBeInTheDocument();
        expect(queryUndoLimitBtn(2)).not.toBeInTheDocument();
        expect(queryUndoLimitBtn(3)).not.toBeInTheDocument();
    });

    // ── Toggle interaction ────────────────────────────────────────────────────

    test("clicking the toggle sets aria-checked to true", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("switch"));

        expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    test("clicking the toggle twice returns it to OFF", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("switch"));
        await user.click(screen.getByRole("switch"));

        expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });

    test("enabling the toggle shows the limit selector", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("switch"));

        expect(getUndoLimitBtn(1)).toBeInTheDocument();
        expect(getUndoLimitBtn(2)).toBeInTheDocument();
        expect(getUndoLimitBtn(3)).toBeInTheDocument();
        expect(getUndoLimitBtn("unlimited")).toBeInTheDocument();
    });

    test("disabling the toggle hides the limit selector again", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("switch")); // ON
        await user.click(screen.getByRole("switch")); // OFF

        expect(queryUndoLimitBtn("unlimited")).not.toBeInTheDocument();
    });

    // ── Limit selection ───────────────────────────────────────────────────────

    test("can select a different undo limit", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("switch"));

        const limitOneBtn = getUndoLimitBtn(1);
        await user.click(limitOneBtn);

        expect(limitOneBtn.className).toMatch(/primary/);
    });

    test("unlimited option can be selected", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("switch"));

        const unlimitedBtn = getUndoLimitBtn("unlimited");
        await user.click(unlimitedBtn);

        expect(unlimitedBtn.className).toMatch(/primary/);
    });

    // ── Navigation state ──────────────────────────────────────────────────────

    // Helper: selecciona la primera dificultad disponible
    async function selectFirstDifficulty(user: ReturnType<typeof userEvent.setup>) {
        const diffBtns = screen.getAllByRole("button").filter(
            b => /f[áa]cil|easy|medio|medium|dif[íi]cil|hard|experto|expert|extremo|extreme/i.test(b.textContent ?? "")
        );
        if (diffBtns.length > 0) await user.click(diffBtns[0]);
    }

    test("navigates with allowUndo=false when undo is disabled", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await selectFirstDifficulty(user);
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ allowUndo: false }),
                })
            );
        });
    });

    test("navigates with allowUndo=true when undo is enabled", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await selectFirstDifficulty(user);
        await user.click(screen.getByRole("switch"));
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ allowUndo: true }),
                })
            );
        });
    });

    test("navigates with undoLimit from selected preset when undo enabled", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await selectFirstDifficulty(user);
        await user.click(screen.getByRole("switch"));
        await user.click(getUndoLimitBtn(2));
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ allowUndo: true, undoLimit: 2 }),
                })
            );
        });
    });

    test("navigates with undoLimit=0 (unlimited) when unlimited is selected", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await selectFirstDifficulty(user);
        await user.click(screen.getByRole("switch"));
        await user.click(getUndoLimitBtn("unlimited"));
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ allowUndo: true, undoLimit: 0 }),
                })
            );
        });
    });

    test("navigates with undoLimit=0 when undo is disabled (limit is irrelevant)", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await selectFirstDifficulty(user);
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ allowUndo: false, undoLimit: 0 }),
                })
            );
        });
    });

    // ── Compatibility with existing settings ──────────────────────────────────

    test("undo card does not interfere with board size selection", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: "9" }));
        await user.click(screen.getByRole("switch"));
        await selectFirstDifficulty(user);
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ boardSize: 9, allowUndo: true }),
                })
            );
        });
    });

    test("undo card does not interfere with timer selection", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("button", { name: "30s" }));
        await user.click(screen.getByRole("switch"));
        await selectFirstDifficulty(user);
        await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                "/game",
                expect.objectContaining({
                    state: expect.objectContaining({ timerSeconds: 30, allowUndo: true }),
                })
            );
        });
    });
});
