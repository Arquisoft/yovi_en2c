import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import Navbar from "../Navbar";
import { I18nProvider } from "../i18n/I18nProvider";
import { ThemeProvider } from "../ThemeProvider";

// Stub localStorage before each test to avoid path-not-found errors (see session notes)
function makeLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderNavbar(initialPath = "/home") {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Navbar username="Pablo" onLogout={vi.fn()} />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorageMock());
    // Reset to dark (default) before each test
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("renders the theme toggle button", () => {
    renderNavbar();
    // Button is present — aria-label varies by language, so we check by title
    const btn = screen.getByTitle(/tema claro|tema oscuro|light theme|dark theme/i);
    expect(btn).toBeInTheDocument();
  });

  test("applies data-theme='dark' on initial render (default)", () => {
    renderNavbar();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  test("switches to light theme when clicked in dark mode", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTitle(/tema claro|light theme/i));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  test("switches back to dark theme when clicked again", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTitle(/tema claro|light theme/i));
    await user.click(screen.getByTitle(/tema oscuro|dark theme/i));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  test("persists theme selection to localStorage", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTitle(/tema claro|light theme/i));

    expect(localStorage.getItem("theme")).toBe("light");
  });

  test("persists dark theme to localStorage when toggled back", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTitle(/tema claro|light theme/i));
    await user.click(screen.getByTitle(/tema oscuro|dark theme/i));

    expect(localStorage.getItem("theme")).toBe("dark");
  });

  test("button shows sun icon (☀️) in dark mode to indicate switch to light", () => {
    renderNavbar();
    const btn = screen.getByTitle(/tema claro|light theme/i);
    expect(btn).toHaveTextContent("☀️");
  });

  test("button shows moon icon (🌙) in light mode to indicate switch to dark", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTitle(/tema claro|light theme/i));

    const btn = screen.getByTitle(/tema oscuro|dark theme/i);
    expect(btn).toHaveTextContent("🌙");
  });

  test("restores saved theme from localStorage on mount", () => {
    // Pre-seed localStorage with light theme
    localStorage.setItem("theme", "light");

    renderNavbar();

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
