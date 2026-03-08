import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import Navbar from "../Navbar";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderNavbar(
  initialPath = "/home",
  username: string | null = "Pablo",
  onLogout = vi.fn()
) {
  return {
    onLogout,
    ...render(
      <I18nProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Navbar username={username} onLogout={onLogout} />
        </MemoryRouter>
      </I18nProvider>
    ),
  };
}

describe("Navbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("renders logo, username and navigation buttons", () => {
    renderNavbar("/home", "Pablo");

    expect(screen.getByRole("img", { name: /GameY/i })).toBeInTheDocument();
    expect(screen.getByText(/Pablo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Home$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Juego|Game/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salir|Logout/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ES$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^EN$/i })).toBeInTheDocument();
  });

  test("shows dash when username is missing", () => {
    renderNavbar("/home", null);

    expect(screen.getByText(/—/i)).toBeInTheDocument();
  });

  test("marks Home as current page when pathname is /home", () => {
    renderNavbar("/home", "Pablo");

    expect(screen.getByRole("button", { name: /^Home$/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /Juego|Game/i })).not.toHaveAttribute("aria-current");
  });

  test("marks Game as current page when pathname is /game", () => {
    renderNavbar("/game", "Pablo");

    expect(screen.getByRole("button", { name: /Juego|Game/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /^Home$/i })).not.toHaveAttribute("aria-current");
  });

  test("navigates to home when logo is clicked", async () => {
    const user = userEvent.setup();
    renderNavbar("/game", "Pablo");

    await user.click(screen.getByRole("button", { name: /Ir a Home/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  test("navigates to home when Home button is clicked", async () => {
    const user = userEvent.setup();
    renderNavbar("/game", "Pablo");

    await user.click(screen.getByRole("button", { name: /^Home$/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  test("navigates to game when Game button is clicked", async () => {
    const user = userEvent.setup();
    renderNavbar("/home", "Pablo");

    await user.click(screen.getByRole("button", { name: /Juego|Game/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/game");
  });

  test("calls onLogout when logout button is clicked", async () => {
    const user = userEvent.setup();
    const { onLogout } = renderNavbar("/home", "Pablo", vi.fn());

    await user.click(screen.getByRole("button", { name: /Salir|Logout/i }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  test("changes language from spanish to english", async () => {
    const user = userEvent.setup();
    renderNavbar("/home", "Pablo");

    expect(screen.getByRole("button", { name: /^ES$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^EN$/i })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: /^EN$/i }));

    expect(screen.getByRole("button", { name: /^EN$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^ES$/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^Game$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Logout$/i })).toBeInTheDocument();
    expect(screen.getByText(/User/i)).toBeInTheDocument();
  });

  test("changes language from english back to spanish", async () => {
    const user = userEvent.setup();
    renderNavbar("/home", "Pablo");

    await user.click(screen.getByRole("button", { name: /^EN$/i }));
    await user.click(screen.getByRole("button", { name: /^ES$/i }));

    expect(screen.getByRole("button", { name: /^ES$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^EN$/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Juego/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salir/i })).toBeInTheDocument();
    expect(screen.getByText(/Usuario/i)).toBeInTheDocument();
  });
});