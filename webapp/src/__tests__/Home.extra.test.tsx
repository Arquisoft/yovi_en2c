import { render, screen, waitFor, within } from "@testing-library/react";
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

function renderHome(
  usernameFromState?: string,
  usernameInStorage?: string,
  tokenInStorage = "fake-token"
) {
  localStorage.clear();
  if (usernameInStorage) localStorage.setItem("username", usernameInStorage);
  if (tokenInStorage) localStorage.setItem("token", tokenInStorage);

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
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

describe("Home — cobertura adicional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("navigates to select-difficulty when button is clicked", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    const button = await screen.findByRole("button", {
      name: /Seleccionar dificultad|Select difficulty/i,
    });

    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/select-difficulty", {
      state: { username: "Pablo" },
    });
  });

  test("quick game navigates with boardSize 7 by default", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await user.click(await screen.findByRole("button", { name: /Partida rápida|Start quick game/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/game", {
      state: { username: "Pablo", bot: "minimax_bot", boardSize: 7 },
    });
  });

  test("local game navigates with localGame flag", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    await user.click(await screen.findByRole("button", { name: /Jugar en local|Play locally/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/select-difficulty", {
      state: { username: "Pablo", bot: "local", boardSize: 7, localGame: true },
    });
  });

  test("redirects to root when fetch throws an error", async () => {
    localStorage.setItem("username", "Pablo");
    localStorage.setItem("token", "fake-token");

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[{ pathname: "/home", state: { username: "Pablo" } }]}>
          <Home />
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("redirects to root when token verification fails", async () => {
    localStorage.setItem("username", "Pablo");
    localStorage.setItem("token", "bad-token");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[{ pathname: "/home", state: { username: "Pablo" } }]}>
          <Home />
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    expect(localStorage.getItem("username")).toBeNull();
  });

  test("calls /api/verify with bearer token when session exists", async () => {
    renderHome("Pablo", undefined, "valid-token");

    await screen.findByText(/Hola Pablo|Hello Pablo/i);

    expect(global.fetch).toHaveBeenCalledWith("/api/verify", {
      method: "GET",
      headers: {
        Authorization: "Bearer valid-token",
      },
    });
  });

  test("does not render home while session is still being verified", () => {
    localStorage.setItem("username", "Pablo");
    localStorage.setItem("token", "slow-token");

    global.fetch = vi.fn(
      () =>
        new Promise<Response>(() => {
          // never resolves
        })
    ) as unknown as typeof fetch;

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[{ pathname: "/home", state: { username: "Pablo" } }]}>
          <Home />
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.queryByText(/Hola Pablo|Hello Pablo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Partida rápida|Start quick game/i })).not.toBeInTheDocument();
  });

  test("redirects to root when token is missing", async () => {
    localStorage.setItem("username", "Pablo");
    localStorage.removeItem("token");

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[{ pathname: "/home", state: { username: "Pablo" } }]}>
          <Home />
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("removes stored credentials when verification response is not ok", async () => {
    localStorage.setItem("username", "Pablo");
    localStorage.setItem("token", "bad-token");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[{ pathname: "/home", state: { username: "Pablo" } }]}>
          <Home />
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("removes stored credentials when verify request throws", async () => {
    localStorage.setItem("username", "Pablo");
    localStorage.setItem("token", "fake-token");

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[{ pathname: "/home", state: { username: "Pablo" } }]}>
          <Home />
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("navigates to multiplayer from hero button", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    const homePanel = await screen.findByLabelText(/Home panel/i);

    await user.click(
      within(homePanel).getByRole("button", {
        name: /Multijugador|Multiplayer/i,
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith("/multiplayer", {
      state: { username: "Pablo" },
    });
  });

  test("navigates to multiplayer from multiplayer card button", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    const cards = await screen.findByLabelText(/Info cards/i);

    await user.click(
      within(cards).getByRole("button", {
        name: /Jugar multijugador|Play multiplayer/i,
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith("/multiplayer", {
      state: { username: "Pablo" },
    });
  });

  test("navigates to select difficulty from third card", async () => {
    const user = userEvent.setup();
    renderHome("Pablo");

    const button = await screen.findByRole("button", {
      name: /Seleccionar dificultad|Select difficulty/i,
    });

    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith("/select-difficulty", {
      state: { username: "Pablo" },
    });
  });

  test("renders hero badge and home panel landmark", async () => {
    renderHome("Pablo");

    const homePanel = await screen.findByLabelText(/Home panel/i);

    expect(homePanel).toBeInTheDocument();
    expect(
      within(homePanel).getByText(
        /Estás en Gamey - Yovi_EN2C|You are in Gamey - Yovi_EN2C/i
      )
    ).toBeInTheDocument();
    expect(within(homePanel).getByRole("img", { name: /GameY/i })).toBeInTheDocument();
  });

  test("renders info cards section with new local and future cards", async () => {
    renderHome("Pablo");

    const cards = await screen.findByLabelText(/Info cards/i);

    expect(cards).toBeInTheDocument();
    expect(within(cards).getByRole("heading", { name: /Jugar en local|Local play/i })).toBeInTheDocument();
    expect(within(cards).getByText(/Modo local|Local mode/i)).toBeInTheDocument();
    expect(within(cards).getByRole("button", { name: /Jugar en local|Play locally/i })).toBeInTheDocument();

    expect(within(cards).getByRole("heading", { name: /Futuro|Future/i })).toBeInTheDocument();
    expect(within(cards).getByText(/^Próximamente$|^Coming soon$/i)).toBeInTheDocument();
  });
});