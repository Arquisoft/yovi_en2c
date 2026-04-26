// ─────────────────────────────────────────────────────────────────────────────
// SelectDifficulty.localstate.test.tsx
// Tests que el componente SelectDifficulty lee el state de navegación
// y preselecciona el modo local si viene bot: "local" desde Home.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen } from "@testing-library/react";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Renderiza llegando desde Home con bot: "local" en el state (flujo normal). */
function renderFromHome(username = "pablo") {
    localStorage.clear();
    localStorage.setItem("username", username);
    return render(
        <I18nProvider>
            <MemoryRouter
                initialEntries={[{
                    pathname: "/select-difficulty",
                    state: { username, bot: "local", boardSize: 7, localGame: true },
                }]}
            >
                <SelectDifficulty />
            </MemoryRouter>
        </I18nProvider>
    );
}

/** Renderiza llegando sin state (acceso directo a la URL). */
function renderDirect(username = "pablo") {
    localStorage.clear();
    localStorage.setItem("username", username);
    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={["/select-difficulty"]}>
                <SelectDifficulty />
            </MemoryRouter>
        </I18nProvider>
    );
}

/** Renderiza llegando con state de bot normal (no local). */
function renderFromBotFlow(username = "pablo") {
    localStorage.clear();
    localStorage.setItem("username", username);
    return render(
        <I18nProvider>
            <MemoryRouter
                initialEntries={[{
                    pathname: "/select-difficulty",
                    state: { username },
                }]}
            >
                <SelectDifficulty />
            </MemoryRouter>
        </I18nProvider>
    );
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("SelectDifficulty — preselección de modo desde state de navegación", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Flujo desde Home con bot: "local" ─────────────────────────────────────

    test("el botón Local tiene la clase primaria al llegar desde Home", () => {
        renderFromHome();

        const localBtn = screen.getAllByRole("button").find(b =>
            /^local$/i.test(b.textContent?.trim() ?? "")
        );
        expect(localBtn).toHaveClass("btn--primary");
    });

    test("el botón Bot NO tiene la clase primaria al llegar desde Home", () => {
        renderFromHome();

        const botBtn = screen.getAllByRole("button").find(b =>
            /vs bot|contra bot/i.test(b.textContent ?? "")
        );
        expect(botBtn).not.toHaveClass("btn--primary");
    });

    test("el input de nombre del jugador 2 es visible al llegar desde Home", () => {
        renderFromHome();
        expect(screen.getByPlaceholderText(/jugador 2|player 2/i)).toBeInTheDocument();
    });

    test("los botones de dificultad NO son visibles al llegar desde Home", () => {
        renderFromHome();
        expect(screen.queryByText(/Fácil|Easy/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Extremo|Extreme/i)).not.toBeInTheDocument();
    });

    test("el selector de primer jugador es visible al llegar desde Home", () => {
        renderFromHome();
        const buttons = screen.getAllByRole("button");
        const hasFirstPlayerSelector = buttons.some(b =>
            /aleatorio|random|jugador 2|player 2/i.test(b.textContent ?? "")
        );
        expect(hasFirstPlayerSelector).toBe(true);
    });

    test("la card de Pie Rule es visible al llegar desde Home", () => {
        renderFromHome();
        const switches = screen.getAllByRole("switch");
        const hasPieSwitch = switches.some(sw =>
            /pierule|pie.?rule/i.test(sw.getAttribute("aria-label") ?? "")
        );
        expect(hasPieSwitch).toBe(true);
    });

    test("el botón Jugar está habilitado al llegar desde Home sin seleccionar bot", () => {
        renderFromHome();
        expect(screen.getByRole("button", { name: /jugar|start|play/i })).not.toBeDisabled();
    });

    // ── Flujo directo (sin state) ─────────────────────────────────────────────

    test("arranca en modo bot si no hay state de navegación", () => {
        renderDirect();

        const botBtn = screen.getAllByRole("button").find(b =>
            /vs bot|contra bot/i.test(b.textContent ?? "")
        );
        expect(botBtn).toHaveClass("btn--primary");
    });

    test("arranca en modo bot si el state no tiene bot: 'local'", () => {
        renderFromBotFlow();

        const botBtn = screen.getAllByRole("button").find(b =>
            /vs bot|contra bot/i.test(b.textContent ?? "")
        );
        expect(botBtn).toHaveClass("btn--primary");
    });

    test("los botones de dificultad SÍ son visibles en acceso directo (modo bot)", () => {
        renderDirect();
        expect(screen.getByText(/Fácil|Easy/i)).toBeInTheDocument();
        expect(screen.getByText(/Extremo|Extreme/i)).toBeInTheDocument();
    });

    // ── El modo se puede cambiar manualmente después ───────────────────────────

    test("llegando en modo local, se puede cambiar a bot manualmente", async () => {
        const user = userEvent.setup();
        renderFromHome();

        await user.click(screen.getByText(/vs bot|contra bot/i));

        const botBtn = screen.getAllByRole("button").find(b =>
            /vs bot|contra bot/i.test(b.textContent ?? "")
        );
        expect(botBtn).toHaveClass("btn--primary");
        expect(screen.getByText(/Fácil|Easy/i)).toBeInTheDocument();
    });

    test("llegando en modo bot directo, se puede cambiar a local manualmente", async () => {
        const user = userEvent.setup();
        renderDirect();

        await user.click(screen.getByText(/^local$/i));

        const localBtn = screen.getAllByRole("button").find(b =>
            /^local$/i.test(b.textContent?.trim() ?? "")
        );
        expect(localBtn).toHaveClass("btn--primary");
        expect(screen.getByPlaceholderText(/jugador 2|player 2/i)).toBeInTheDocument();
    });
});
