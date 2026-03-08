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

function renderHome(usernameFromState?: string, usernameInStorage?: string) {
  localStorage.clear();

  if (usernameInStorage) {
    localStorage.setItem("username", usernameInStorage);
  }

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
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("renders home content with username from location state", () => {
    renderHome("Pablo");

    expect(screen.getAllByRole("img", { name: /GameY/i })).toHaveLength(2);
    expect(screen.getByText(/Hola Pablo|Hello Pablo/i)).toBeInTheDocument();
    expect(screen.getByText(/Juega al juego Y|Play the Game of Y/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Empezar partida|Start game/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cambiar usuario|Change user/i })
    ).toBeInTheDocument();
  });

  test("renders home content with username from localStorage", () => {
    renderHome(undefined, "Laura");

    expect(screen.getByText(/Hola Laura|Hello Laura/i)).toBeInTheDocument();
  });

  test("prefers username from location state over localStorage", () => {
    renderHome("Pablo", "Laura");

    expect(screen.getByText(/Hola Pablo|Hello Pablo/i)).toBeInTheDocument();
    expect(screen.queryByText(/Hola Laura|Hello Laura/i)).not.toBeInTheDocument();
  });

  test("redirects to root when username is missing", async () => {
    renderHome();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  test("navigates to game when start button is clicked", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await user.click(
      screen.getByRole("button", { name: /Empezar partida|Start game/i })
    );

    expect(mockNavigate).toHaveBeenCalledWith("/game", {
      state: { username: "Pablo" },
    });
  });

  test("logs out and navigates to root when change user button is clicked", async () => {
    const user = userEvent.setup();
    renderHome(undefined, "Pablo");

    await user.click(
      screen.getByRole("button", { name: /Cambiar usuario|Change user/i })
    );

    expect(localStorage.getItem("username")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  test("logs out from navbar and navigates to root", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await user.click(
      screen.getByRole("button", { name: /Salir|Logout/i })
    );

    expect(localStorage.getItem("username")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  test("renders all information cards", () => {
    renderHome("Pablo");

    expect(
      screen.getByText(/Modo rápido|Quick mode/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Futuro|Future/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Distintos bots|Different bots/i)
    ).toBeInTheDocument();
  });
});