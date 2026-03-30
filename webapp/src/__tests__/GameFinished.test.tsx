import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom";
import GameFinished from "../GameFinished";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderGameFinished(
  result?: "win" | "lost" | "draw",
  username = "Pablo"
) {
  if (username) localStorage.setItem("username", username);
  else localStorage.removeItem("username");

  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[{ pathname: "/game/finished", state: result ? { result } : undefined }]}>
        <GameFinished />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("GameFinished", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("renders win message", () => {
    renderGameFinished("win", "Pablo");

    expect(
      screen.getByRole("heading", { name: /Has ganado|You win/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Volver al juego|Back to game/i })
    ).toBeInTheDocument();
  });

  test("renders lost message", () => {
    renderGameFinished("lost", "Pablo");

    expect(
      screen.getByRole("heading", { name: /Has perdido|You lost/i })
    ).toBeInTheDocument();
  });

  test("renders draw message", () => {
    renderGameFinished("draw", "Pablo");

    expect(
      screen.getByRole("heading", { name: /Empate|Draw/i })
    ).toBeInTheDocument();
  });

  test("redirects to root when there is no username", async () => {
    renderGameFinished("win", "");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  test("redirects to game when result is missing", async () => {
    renderGameFinished(undefined, "Pablo");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/game", { replace: true });
    });
  });



  test("logs out from navbar and navigates to root", async () => {
    const user = userEvent.setup();
    renderGameFinished("win", "Pablo");

    await user.click(
      screen.getByRole("button", { name: /Salir|Logout/i })
    );

    expect(localStorage.getItem("username")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  test("renders navbar with username", () => {
    renderGameFinished("win", "Pablo");

    expect(screen.getByText(/Pablo/i)).toBeInTheDocument();
  });
});