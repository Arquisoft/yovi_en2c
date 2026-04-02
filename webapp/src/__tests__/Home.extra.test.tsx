// Tests adicionales para Home.tsx — pégalos al final de Home.test.tsx
// Cubren: botón "Select Difficulty" y el caso catch del fetch de verificación

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom";
import Home from "../Home";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderHome(
  usernameFromState?: string,
  usernameInStorage?: string,
  tokenInStorage = "fake-token"
) {
  localStorage.clear();
  if (usernameInStorage) localStorage.setItem("username", usernameInStorage);
  if (tokenInStorage) localStorage.setItem("token", tokenInStorage);

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  } as Response);

  return render(
    <I18nProvider>
      <MemoryRouter
        initialEntries={[{
          pathname: "/home",
          state: usernameFromState ? { username: usernameFromState } : undefined,
        }]}
      >
        <Home />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("Home — cobertura adicional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ─── Botón "Seleccionar dificultad" ──────────────────────────────────────

  test("navigates to select-difficulty when button is clicked", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    // Esperar a que el componente cargue (verificación de sesión)
    await screen.findByRole("button", { name: /Partida rapida|Start quick game/i });

    const diffButton = screen.getByRole("button", { name: /Seleccionar dificultad|Select difficulty/i });
    await user.click(diffButton);

    expect(mockNavigate).toHaveBeenCalledWith("/select-difficulty");
  });

  // ─── Fetch lanza excepción (catch) → redirige a "/" ──────────────────────

  test("redirects to root when fetch throws an error", async () => {
    localStorage.setItem("username", "Pablo");
    localStorage.setItem("token", "fake-token");

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[{ pathname: "/home", state: { username: "Pablo" } }]}>
          <Home />
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  // ─── Fetch responde !ok → redirige a "/" ─────────────────────────────────

  test("redirects to root when token verification fails", async () => {
    localStorage.setItem("username", "Pablo");
    localStorage.setItem("token", "bad-token");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[{ pathname: "/home", state: { username: "Pablo" } }]}>
          <Home />
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    expect(localStorage.getItem("username")).toBeNull();
  });
});
