import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import Navbar from "../Navbar";
import { I18nProvider } from "../i18n/I18nProvider";
import userEvent from "@testing-library/user-event";

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
  test("clicking logo navigates to /home with username state", async () => {
    const user = userEvent.setup();
    renderNavbar("/game", "Pablo");

    const logoBtn = screen.getByRole("button", { name: /Go home/i });
    await user.click(logoBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/home", { state: { username: "Pablo" } });
  });
  test("navbar buttons navigate correctly", async () => {
    const user = userEvent.setup();
    renderNavbar("/stats", "Ana");

    // Home button
    const homeBtn = screen.getByRole("button", { name: /^Home$/i });
    await user.click(homeBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/home", { state: { username: "Ana" } });

    // Game button
    const gameBtn = screen.getByRole("button", { name: /Juego|Game/i });
    await user.click(gameBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/game", { state: { username: "Ana" } });

    // Stats button
    const statsBtn = screen.getByRole("button", { name: /Stats/i });
    await user.click(statsBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/stats", { state: { username: "Ana" } });
  });
  test("clicking logout calls onLogout", async () => {
    const user = userEvent.setup();
    const { onLogout } = renderNavbar("/home", "Ana");

    const logoutBtn = screen.getByRole("button", { name: /Salir|Logout/i });
    await user.click(logoutBtn);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
  test("active class is applied based on current path", () => {
    const { rerender } = renderNavbar("/home", "Ana");

    // Home is active
    expect(screen.getByRole("button", { name: /^Home$/i })).toHaveClass("nav-link--active");
    expect(screen.getByRole("button", { name: /Juego|Game/i })).not.toHaveClass("nav-link--active");

    // Change path to /game
    rerender(
        <MemoryRouter initialEntries={["/game"]}>
          <I18nProvider>
            <Navbar username="Ana" onLogout={vi.fn()} />
          </I18nProvider>
        </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /Juego|Game/i })).toHaveClass("nav-link--active");
  });
  test("renders custom title if provided", () => {
    renderNavbar("/home", "Ana", vi.fn());
    render(
        <I18nProvider>
          <MemoryRouter>
            <Navbar username="Ana" title="Custom App"/>
          </MemoryRouter>
        </I18nProvider>
    );

    expect(screen.getByText("Custom App")).toBeInTheDocument();
  });
  test("does not render username when not provided", () => {
    renderNavbar("/home", null);
    expect(screen.queryByText(/👤/i)).not.toBeInTheDocument();
  });

});