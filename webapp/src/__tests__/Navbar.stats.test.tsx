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

function renderNavbar(initialPath = "/home", username: string | null = "Pablo") {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Navbar username={username} onLogout={vi.fn()} />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("Navbar — Statistics button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("renders the statistics button", () => {
    renderNavbar();

    expect(
      screen.getByRole("button", { name: /Estadísticas|Statistics/i })
    ).toBeInTheDocument();
  });

  test("navigates to /statistics when statistics button is clicked", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: /Estadísticas|Statistics/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/statistics");
  });

  test("marks statistics button as current page when pathname is /statistics", () => {
    renderNavbar("/statistics");

    expect(
      screen.getByRole("button", { name: /Estadísticas|Statistics/i })
    ).toHaveAttribute("aria-current", "page");
  });

  test("does not mark statistics button as current page when on /home", () => {
    renderNavbar("/home");

    expect(
      screen.getByRole("button", { name: /Estadísticas|Statistics/i })
    ).not.toHaveAttribute("aria-current");
  });

  test("statistics button renders in english when language is switched", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: /^EN$/i }));

    expect(
      screen.getByRole("button", { name: /^Statistics$/i })
    ).toBeInTheDocument();
  });
});
