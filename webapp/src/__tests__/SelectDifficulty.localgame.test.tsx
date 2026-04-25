// ─────────────────────────────────────────────────────────────────────────────
// SelectDifficulty.localgame.test.tsx
// Tests the Local Game mode in SelectDifficulty:
//  - Mode switching
//  - Player 2 name input
//  - First player selector (player1 / player2 / random)
//  - Navigation state: mode:"local", player1Name, player2Name, firstPlayer
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from "@testing-library/react";
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

/** Clicks the "Local" game mode button. */
async function switchToLocalMode(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByText(/local/i));
}

/** Clicks the Play/Start button. */
async function clickStart(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /jugar|start|play/i }));
}

/** Returns the navigation state passed to mockNavigate on the first call. */
function getNavigatedState(): Record<string, unknown> {
    return (mockNavigate.mock.calls[0][1] as { state: Record<string, unknown> }).state;
}

// ── Suite: Mode switching ─────────────────────────────────────────────────────

describe("SelectDifficulty — mode switching", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    test("bot mode button has primary class by default", () => {
        renderSelectDifficulty();
        const botBtn = screen.getAllByRole("button").find(b =>
            /vs bot|contra bot/i.test(b.textContent ?? "")
        );
        expect(botBtn).toHaveClass("btn--primary");
    });

    test("local mode button does not have primary class by default", () => {
        renderSelectDifficulty();
        const localBtn = screen.getAllByRole("button").find(b =>
            /^local$/i.test(b.textContent?.trim() ?? "")
        );
        expect(localBtn).not.toHaveClass("btn--primary");
    });

    test("clicking local gives it the primary class and removes it from bot", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        const localBtn = screen.getAllByRole("button").find(b =>
            /^local$/i.test(b.textContent?.trim() ?? "")
        );
        const botBtn = screen.getAllByRole("button").find(b =>
            /vs bot|contra bot/i.test(b.textContent ?? "")
        );
        expect(localBtn).toHaveClass("btn--primary");
        expect(botBtn).not.toHaveClass("btn--primary");
    });

    test("switching to local shows player 2 name input", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        expect(screen.getByPlaceholderText(/jugador 2|player 2/i)).toBeInTheDocument();
    });

    test("switching to local shows first player selector", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        // At least one of the first-player buttons should be visible
        const buttons = screen.getAllByRole("button");
        const hasFirstPlayer = buttons.some(b =>
            /aleatorio|random|jugador 2|player 2/i.test(b.textContent ?? "")
        );
        expect(hasFirstPlayer).toBe(true);
    });

    test("switching back to bot hides player 2 name input", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();

        await switchToLocalMode(user);
        await user.click(screen.getByText(/vs bot|contra bot/i));

        expect(screen.queryByPlaceholderText(/jugador 2|player 2/i)).not.toBeInTheDocument();
    });
});

// ── Suite: Player 2 name ──────────────────────────────────────────────────────

describe("SelectDifficulty — player 2 name", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    test("player 2 name input is empty by default", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        expect(screen.getByPlaceholderText(/jugador 2|player 2/i)).toHaveValue("");
    });

    test("typing a player 2 name updates the input value", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        const input = screen.getByPlaceholderText(/jugador 2|player 2/i);
        await user.type(input, "Alice");
        expect(input).toHaveValue("Alice");
    });

    test("navigates with typed player2Name", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        await user.type(screen.getByPlaceholderText(/jugador 2|player 2/i), "Alice");
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().player2Name).toBe("Alice");
    });

    test("navigates with default 'Player 2' when name is empty", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().player2Name).toBe("Player 2");
    });

    test("navigates with default 'Player 2' when name is only whitespace", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        await user.type(screen.getByPlaceholderText(/jugador 2|player 2/i), "   ");
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().player2Name).toBe("Player 2");
    });

    test("player1Name in navigation state equals the logged-in username", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().player1Name).toBe("pablo");
    });

    test("player2Name respects maxLength of 24 characters", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty();
        await switchToLocalMode(user);

        const input = screen.getByPlaceholderText(/jugador 2|player 2/i) as HTMLInputElement;
        expect(input.maxLength).toBe(24);
    });
});

// ── Suite: First player selector ──────────────────────────────────────────────

describe("SelectDifficulty — first player selector", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    test("player1 (current user) is selected as first player by default", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        // The button containing the username and "(Player 1 / Jugador 1)" label should be primary
        const buttons = screen.getAllByRole("button");
        const player1Btn = buttons.find(b =>
            /pablo/i.test(b.textContent ?? "") &&
            /jugador 1|player 1/i.test(b.textContent ?? "")
        );
        expect(player1Btn).toHaveClass("btn--primary");
    });

    test("clicking player2 button marks it as active", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        const player2Btn = screen.getAllByRole("button").find(b =>
            /jugador 2|player 2/i.test(b.textContent ?? "") &&
            !b.matches("input")
        );
        if (!player2Btn) throw new Error("Player 2 first-player button not found");
        await user.click(player2Btn);

        expect(player2Btn).toHaveClass("btn--primary");
    });

    test("clicking random button marks it as active", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        const randomBtn = screen.getAllByRole("button").find(b =>
            /aleatorio|random/i.test(b.textContent ?? "")
        );
        if (!randomBtn) throw new Error("Random button not found");
        await user.click(randomBtn);

        expect(randomBtn).toHaveClass("btn--primary");
    });

    test("navigates with firstPlayer: 'player1' when player1 is selected", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().firstPlayer).toBe("player1");
    });

    test("navigates with firstPlayer: 'player2' when player2 is selected", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        const player2Btn = screen.getAllByRole("button").find(b =>
            /jugador 2|player 2/i.test(b.textContent ?? "") &&
            b.tagName === "BUTTON"
        );
        if (!player2Btn) throw new Error("Player 2 first-player button not found");
        await user.click(player2Btn);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().firstPlayer).toBe("player2");
    });

    test("navigates with firstPlayer 'player1' or 'player2' when random is selected", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        const randomBtn = screen.getAllByRole("button").find(b =>
            /aleatorio|random/i.test(b.textContent ?? "")
        );
        if (!randomBtn) throw new Error("Random button not found");
        await user.click(randomBtn);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        const fp = getNavigatedState().firstPlayer;
        expect(["player1", "player2"]).toContain(fp);
    });
});

// ── Suite: Local mode navigation ──────────────────────────────────────────────

describe("SelectDifficulty — local mode navigation state", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockNavigate.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    test("navigates to /game with mode:'local'", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/game", expect.objectContaining({
                state: expect.objectContaining({ mode: "local" }),
            }));
        });
    });

    test("navigation state does NOT contain 'bot' key in local mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState()).not.toHaveProperty("bot");
    });

    test("navigates with default boardSize 7 in local mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().boardSize).toBe(7);
    });

    test("navigates with default timerSeconds 0 in local mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().timerSeconds).toBe(0);
    });

    test("navigates with custom boardSize in local mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        await user.click(screen.getByRole("button", { name: /^9$/ }));
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().boardSize).toBe(9);
    });

    test("navigates with timer 30s in local mode", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        await user.click(screen.getByRole("button", { name: /^30s$/ }));
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().timerSeconds).toBe(30);
    });

    test("navigates with username as player1Name", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        expect(getNavigatedState().player1Name).toBe("pablo");
    });

    test("play button is enabled in local mode without selecting a bot", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);

        expect(screen.getByRole("button", { name: /jugar|start|play/i })).not.toBeDisabled();
    });

    test("play button in bot mode stays disabled when switching to local then back", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");

        // Initially disabled (no bot selected)
        expect(screen.getByRole("button", { name: /jugar|start|play/i })).toBeDisabled();

        await switchToLocalMode(user);
        // Enabled in local mode
        expect(screen.getByRole("button", { name: /jugar|start|play/i })).not.toBeDisabled();

        // Back to bot — still no bot selected, so disabled again
        await user.click(screen.getByText(/vs bot|contra bot/i));
        expect(screen.getByRole("button", { name: /jugar|start|play/i })).toBeDisabled();
    });

    test("local mode navigation includes allowUndo and undoLimit", async () => {
        const user = userEvent.setup();
        renderSelectDifficulty("pablo");
        await switchToLocalMode(user);
        await clickStart(user);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
        const state = getNavigatedState();
        expect(state).toHaveProperty("allowUndo");
        expect(state).toHaveProperty("undoLimit");
    });
});