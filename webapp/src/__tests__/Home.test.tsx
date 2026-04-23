import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, test, vi, it } from "vitest";
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

  if (usernameInStorage) {
    localStorage.setItem("username", usernameInStorage);
  }

  if (tokenInStorage) {
    localStorage.setItem("token", tokenInStorage);
  }

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      message: "Token valid",
      user: {
        username: usernameFromState ?? usernameInStorage ?? "Pablo",
      },
    }),
  } as Response);

  return render(
    <I18nProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/home",
            state: usernameFromState ? { username: usernameFromState } : undefined,
          },
        ]}
      >
        <Home />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("Home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("renders home content with username from location state", async () => {
    renderHome("Pablo");

    expect(await screen.findByText(/Hola Pablo|Hello Pablo/i)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /GameY/i })).toHaveLength(2);
    expect(screen.getByText(/Juega al juego Y|Play the Game of Y/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Partida rapida|Start quick game/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cambiar usuario|Change user/i })
    ).toBeInTheDocument();
  });

  test("renders home content with username from localStorage", async () => {
    renderHome(undefined, "Laura");

    expect(await screen.findByText(/Hola Laura|Hello Laura/i)).toBeInTheDocument();
  });

  test("prefers username from location state over localStorage", async () => {
    renderHome("Pablo", "Laura");

    expect(await screen.findByText(/Hola Pablo|Hello Pablo/i)).toBeInTheDocument();
    expect(screen.queryByText(/Hola Laura|Hello Laura/i)).not.toBeInTheDocument();
  });

  test("redirects to root when username is missing", async () => {
    localStorage.clear();
    global.fetch = vi.fn();

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[{ pathname: "/home" }]}>
          <Home />
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  test("navigates to game with default board size when start button is clicked", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await screen.findByRole("button", { name: /Partida rapida|Start quick game/i });

    await user.click(
      screen.getByRole("button", { name: /Partida rapida|Start quick game/i })
    );

    expect(mockNavigate).toHaveBeenCalledWith("/game", {
      state: { username: "Pablo", bot: "minimax_bot", boardSize: 7 },
    });
  });

  test("logs out and navigates to root when change user button is clicked", async () => {
    const user = userEvent.setup();
    renderHome(undefined, "Pablo");

    await screen.findByRole("button", { name: /Cambiar usuario|Change user/i });

    await user.click(
      screen.getByRole("button", { name: /Cambiar usuario|Change user/i })
    );

    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  test("logs out from navbar and navigates to root", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await screen.findByRole("button", { name: /Salir|Logout/i });

    await user.click(
      screen.getByRole("button", { name: /Salir|Logout/i })
    );

    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("renders the three home cards", async () => {
    renderHome("Pablo");

    expect(
      await screen.findByRole("heading", { name: /Instrucciones|Instructions/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Multijugador|Multiplayer/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Distintos bots|Different bots/i })
    ).toBeInTheDocument();
  });

  it("navigates to instructions from the first card", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    const instructionsButton = await screen.findByRole("button", {
      name: /Instrucciones|Instructions/i,
    });

    await user.click(instructionsButton);

    expect(mockNavigate).toHaveBeenCalledWith("/instructions", {
      state: { username: "Pablo" },
    });
  });
});