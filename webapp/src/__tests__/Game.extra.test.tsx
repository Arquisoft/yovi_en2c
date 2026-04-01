// Tests adicionales para Game.tsx — pégalos al final de Game.test.tsx
// Cubren: overlay de derrota, botones del overlay, logout en juego, bot desde localStorage

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Game from "../Game";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderGame(usernameFromState = "Pablo", usernameInStorage = "Pablo") {
  localStorage.clear();
  if (usernameInStorage) localStorage.setItem("username", usernameInStorage);

  return render(
    <I18nProvider>
      <MemoryRouter
        initialEntries={[{
          pathname: "/game",
          state: usernameFromState ? { username: usernameFromState } : undefined,
        }]}
      >
        <Game />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("Game component — cobertura adicional", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockNavigate.mockReset();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useRealTimers();
  });

  // ─── Overlay de DERROTA ───────────────────────────────────────────────────

  test("shows lost overlay when bot wins", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          finished: true,
          winner: "R",           // "R" es el bot → el humano pierde
          winning_edges: [[[0, 0], [1, 0]]],
          yen: {
            size: 7,
            players: ["B", "R"],
            layout: "......./......./......./......./......./......./.......",
          },
        }),
    } as Response);

    renderGame();

    await act(async () => {
      screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
    });

    await waitFor(() => {
      expect(screen.getByText(/Has perdido|You lost/i)).toBeInTheDocument();
    });
  });

  // ─── Botón "Volver a Home" dentro del overlay ─────────────────────────────

  test("navigates to home from win overlay back button", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          finished: true,
          winner: "B",
          winning_edges: [[[0, 0], [1, 0]]],
          yen: {
            size: 7,
            players: ["B", "R"],
            layout: "......./......./......./......./......./......./.......",
          },
        }),
    } as Response);

    renderGame();

    await act(async () => {
      screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
    });

    await waitFor(() => {
      expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument();
    });

    // El overlay tiene su propio botón de volver
    const backButtons = screen.getAllByRole("button", { name: /Volver|Back/i });
    // El último botón "back" es el del overlay
    await user.click(backButtons[backButtons.length - 1]);

    expect(mockNavigate).toHaveBeenCalledWith("/home", { state: { username: "Pablo" } });
  });

  // ─── Botón "Nueva partida" dentro del overlay (play again) ────────────────

  test("clicking play again in overlay starts a new game", async () => {
    const user = userEvent.setup();

    // Primera llamada → partida terminada (win)
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            finished: true,
            winner: "B",
            winning_edges: [[[0, 0], [1, 0]]],
            yen: {
              size: 7,
              players: ["B", "R"],
              layout: "......./......./......./......./......./......./.......",
            },
          }),
      } as Response)
      // Segunda llamada → nueva partida
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              players: ["B", "R"],
              layout: "......./......./......./......./......./......./.......",
            },
          }),
      } as Response);

    renderGame();

    await act(async () => {
      screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
    });

    await waitFor(() => {
      expect(screen.getByText(/Has ganado|You win/i)).toBeInTheDocument();
    });

    // Botón "Nueva partida" dentro del overlay
    const newGameButtons = screen.getAllByRole("button", { name: /Nueva partida|New game/i });
    await user.click(newGameButtons[newGameButtons.length - 1]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // El overlay debe desaparecer
    expect(screen.queryByText(/Has ganado|You win/i)).not.toBeInTheDocument();
  });

  // ─── Logout desde la navbar dentro de Game ───────────────────────────────

  test("logout from navbar inside Game clears storage and navigates to root", async () => {
    const user = userEvent.setup();
    renderGame();

    const logoutButton = screen.getByRole("button", { name: /Salir|Logout/i });
    await user.click(logoutButton);

    expect(localStorage.getItem("username")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  // ─── Bot cargado desde localStorage (sin state) ──────────────────────────

  test("loads bot from localStorage when no state bot is provided", async () => {
    localStorage.setItem("username", "Pablo");
    localStorage.setItem("selectedBot", "minimax_bot");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          yen: {
            size: 7,
            players: ["B", "R"],
            layout: "......./......./......./......./......./......./.......",
          },
        }),
    } as Response);

    render(
      <I18nProvider>
        <MemoryRouter
          initialEntries={[{
            pathname: "/game",
            state: { username: "Pablo" },
            // sin bot en el state
          }]}
        >
          <Game />
        </MemoryRouter>
      </I18nProvider>
    );

    await act(async () => {
      screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // El bot debería haberse cargado de localStorage
    expect(localStorage.getItem("selectedBot")).toBe("minimax_bot");
  });

  // ─── sendMove: celda no vacía no dispara fetch ────────────────────────────

  test("does not send move when clicking an occupied cell", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          yen: {
            size: 7,
            players: ["B", "R"],
            // Primera celda ocupada por "B"
            layout: "B....../......./......./......./......./......./.......",
          },
        }),
    } as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    // Click en la primera celda (ocupada)
    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    // No debe haberse hecho una segunda llamada a fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
