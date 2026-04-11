import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import Instructions from "../Instructions";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../Navbar", () => ({
  default: ({ username }: { username?: string | null }) => (
    <div data-testid="navbar">Navbar - {username}</div>
  ),
}));

function renderInstructions(username = "Pablo") {
  if (username) {
    localStorage.setItem("username", username);
    localStorage.setItem("token", "fake-token");
  } else {
    localStorage.removeItem("username");
    localStorage.removeItem("token");
  }

  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: "/instructions",
          state: username ? { username } : undefined,
        } as any,
      ]}
    >
      <I18nProvider>
        <Instructions />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("Instructions", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders the instructions page content", async () => {
    renderInstructions("Pablo");

    expect(
      await screen.findByRole("heading", { name: /Instrucciones|Instructions/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Cómo se juega|How to play/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /^Dificultades$|^Difficulties$/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Tamaño del tablero|Board size/i })
    ).toBeInTheDocument();

    expect(screen.getByTestId("navbar")).toHaveTextContent("Pablo");
  });

  it("shows the instruction paragraphs", async () => {
    renderInstructions("Pablo");

    expect(
      await screen.findByText(
        /GameY es un juego por turnos|GameY is a turn-based game/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(/El objetivo es conectar|Your goal is to connect/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Solo necesitas pulsar una celda vacía|You only need to click an empty cell/i
      )
    ).toBeInTheDocument();
  });

  it("navigates back home from instructions", async () => {
    const user = userEvent.setup();
    renderInstructions("Pablo");

    const backButton = await screen.findByRole("button", {
      name: /Volver al inicio|Back to home/i,
    });

    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/home", {
      state: { username: "Pablo" },
    });
  });

  it("redirects to login when there is no username", () => {
    renderInstructions("");

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });
});