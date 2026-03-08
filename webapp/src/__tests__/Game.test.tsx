import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Game from "../Game";
import { I18nProvider } from "../i18n/I18nProvider";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderGame(usernameFromState = "Pablo", usernameInStorage = "Pablo") {
  localStorage.clear();

  if (usernameInStorage) {
    localStorage.setItem("username", usernameInStorage);
  }

  return render(
    <I18nProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/game",
            state: usernameFromState ? { username: usernameFromState } : undefined,
          },
        ]}
      >
        <Game />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("Game component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mockNavigate.mockReset();

    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useRealTimers();
  });

  test("renders title and action buttons", () => {
    renderGame();

    expect(screen.getByRole("heading", { name: /GameY/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nueva partida|New game/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Volver a Home|Back To Home/i })).toBeInTheDocument();
  });

  test("creates new game successfully", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          yen: {
            size: 7,
            players: ["B", "R"],
            layout: "......./......./......./......./......./......./.......",
          },
        }),
    } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });
  });

  test("shows plain text error if new game response is not json", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Plain backend error",
    } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    expect(await screen.findByText(/Plain backend error/i)).toBeInTheDocument();
  });

  test("shows error if new game fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: async () =>
        JSON.stringify({
          ok: false,
          error: "Game server unavailable",
        }),
    } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    expect(await screen.findByText(/Game server unavailable/i)).toBeInTheDocument();
  });

  test("does not send move without selection", () => {
    renderGame();

    const sendButton = screen.getByRole("button", {
      name: /Enviar jugada|Send move/i,
    });

    expect(sendButton).toBeDisabled();
  });

  test("enables send button after selecting a cell", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          yen: {
            size: 7,
            players: ["B", "R"],
            layout: "......./......./......./......./......./......./.......",
          },
        }),
    } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).not.toBeDisabled();
    });
  });

  test("sends move successfully", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              players: ["B", "R"],
              layout: "......./......./......./......./......./......./.......",
            },
          }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              players: ["B", "R"],
              layout: "B....../......./......./......./......./......./.......",
            },
          }),
      } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /Enviar jugada|Send move/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  test("sends move on double click", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              players: ["B", "R"],
              layout: "......./......./......./......./......./......./.......",
            },
          }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              players: ["B", "R"],
              layout: "B....../......./......./......./......./......./.......",
            },
          }),
      } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.dblClick(circles[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  test("shows backend error when move fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              players: ["B", "R"],
              layout: "......./......./......./......./......./......./.......",
            },
          }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        text: async () =>
          JSON.stringify({
            ok: false,
            error: "Backend error",
          }),
      } as unknown as Response);

    renderGame();

    await user.click(screen.getByRole("button", { name: /Nueva partida|New game/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("circle").length).toBeGreaterThan(0);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Enviar jugada|Send move/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /Enviar jugada|Send move/i }));

    expect(await screen.findByText(/Backend error/i)).toBeInTheDocument();
  });

  test("navigates back to home when back button is clicked", async () => {
    const user = userEvent.setup();

    renderGame();

    await user.click(screen.getByRole("button", { name: /Volver a Home|Back To Home/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/home", { state: { username: "Pablo" } });
  });

  test("redirects to root when username is missing", async () => {
    renderGame("", "");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  test("navigates to finished screen when backend returns a winning result", async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          finished: true,
          winner: "B",
          winning_edges: [
            [[0, 0], [1, 0]],
            [[1, 0], [2, 0]],
          ],
          yen: {
            size: 7,
            players: ["B", "R"],
            layout: "......./......./......./......./......./......./.......",
          },
        }),
    } as unknown as Response);

    renderGame();

    await act(async () => {
      screen.getByRole("button", { name: /Nueva partida|New game/i }).click();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(950);
    });

    expect(mockNavigate).toHaveBeenCalledWith("/game/finished", {
      replace: true,
      state: { result: "win" },
    });
  });
});