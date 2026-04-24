// ─────────────────────────────────────────────────────────────────────────────
// SelectDifficulty.undo.test.tsx
// Tests the undo configuration card added to SelectDifficulty.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor, within } from "@testing-library/react";
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
// Los botones de límite de undo viven en .sd-undo-limits.
// "Sin límite" también existe en el preset de timer — scoping con within evita ambigüedad.
function getUndoCard() {
    // El card de undo es el único que contiene el switch role=switch
    return screen.getByRole("switch").closest(".card") as HTMLElement;
}

function getUndoLimitBtn(value: number | "unlimited") {
    const card = getUndoCard();
    if (value === "unlimited") {
        return within(card).getByRole("button", { name: /sin l[íi]mite|unlimited/i });
    }
    return within(card).getByRole("button", {
        name: new RegExp(`^${value}$|${value}\s*(movimiento|move)`, "i"),
    });
}

function queryUndoLimitBtn(value: number | "unlimited") {
    const card = getUndoCard();
    if (value === "unlimited") {
        return within(card).queryByRole("button", { name: /sin l[íi]mite|unlimited/i });
    }
    return within(card).queryByRole("button", {
        name: new RegExp(`^${value}$|${value}\s*(movimiento|move)`, "i"),
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
        // Múltiples elementos contienen "deshacer" — buscamos el h2 del card
        const titles = screen.getAllByText(/deshacer|undo/i);
        expect(titles.length).toBeGreaterThan(0);
        expect(titles.some(el => el.tagName === "H2")).toBe(true);
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

    test("disabling the toggle hides the limit selector again", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await user.click(screen.getByRole("switch")); // ON
        await user.click(screen.getByRole("switch")); // OFF

        expect(queryUndoLimitBtn("unlimited")).not.toBeInTheDocument();
    });

    // ── Limit selection ───────────────────────────────────────────────────────

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