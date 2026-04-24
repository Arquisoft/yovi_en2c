import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import Navbar from "../Navbar";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderNavbar(path = "/home", username: string | null = "Pablo", onLogout = vi.fn()) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <Navbar username={username} onLogout={onLogout} />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("Navbar extra coverage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("navigates to multiplayer", async () => {
    const user = userEvent.setup();
    renderNavbar("/home", "Pablo");

    await user.click(screen.getByRole("button", { name: /multijugador|multiplayer/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/multiplayer", {
      state: { username: "Pablo" },
    });
  });

  test("marks multiplayer as current on /multiplayer/game", () => {
    renderNavbar("/multiplayer/game", "Pablo");

    expect(
      screen.getByRole("button", { name: /multijugador|multiplayer/i })
    ).toHaveAttribute("aria-current", "page");
  });

  test("navigates to own profile when user chip is clicked", async () => {
    const user = userEvent.setup();
    renderNavbar("/home", "Pablo");

    await user.click(screen.getByRole("button", { name: /view profile of pablo/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/profile/Pablo", {
      state: { username: "Pablo" },
    });
  });

  test("does not navigate to profile when username is null", async () => {
    const user = userEvent.setup();
    renderNavbar("/home", null);

    await user.click(screen.getByRole("button", { name: /view profile of null|view profile of/i }));

    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/profile\//),
      expect.anything()
    );
  });
});