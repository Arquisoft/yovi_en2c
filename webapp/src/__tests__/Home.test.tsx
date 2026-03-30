import { render, screen} from "@testing-library/react";
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



  test("logs out from navbar and navigates to root", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await user.click(
      screen.getByRole("button", { name: /Salir|Logout/i })
    );

    expect(localStorage.getItem("username")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  test("renders username from location state", () => {
    renderHome("Pablo");

    expect(screen.getByText("Pablo")).toBeInTheDocument();
  });

  test("uses username from localStorage if not in state", () => {
    renderHome(undefined, "Ana");

    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  test("selecting bot mode shows config panel", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await user.click(screen.getByText(/Game against bots/i));

    expect(screen.getByText(/BOT SETTINGS|MATCH SETTINGS/i)).toBeInTheDocument();
  });
  test("selecting bot mode shows config panel", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await user.click(screen.getByText(/Game against bots/i));

    expect(screen.getByText(/BOT SETTINGS|MATCH SETTINGS/i)).toBeInTheDocument();
  });

  test("clicking same mode twice toggles it off", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    const botButton = screen.getByText(/Game against bots/i);

    await user.click(botButton);
    expect(screen.getByText(/BOT SETTINGS/i)).toBeInTheDocument();

    await user.click(botButton);
    expect(screen.queryByText(/BOT SETTINGS/i)).not.toBeInTheDocument();
  });

  test("player mode does not show bot selector", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await user.click(screen.getByText(/Game against players/i));

    expect(screen.queryByLabelText(/Bot/i)).not.toBeInTheDocument();
  });

  test("can change bot selection", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await user.click(screen.getByText(/Game against bots/i));

    const select = screen.getByRole("combobox", { name: /Bot/i });

    await user.selectOptions(select, "minimax_bot");

    expect(select).toHaveValue("minimax_bot");
  });

  test("can change board size", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await user.click(screen.getByText(/Game against bots/i));

    const select = screen.getByRole("combobox", { name: /Board size/i });

    await user.selectOptions(select, "9");

    expect(select).toHaveValue("9");
  });


});