import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import Game from "../Game";

describe("Game component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("renders title and buttons", () => {
    render(<Game />);

    expect(
      screen.getByRole("heading", { name: /GameY/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Nueva partida/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Enviar jugada/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Comprobar conexión/i })
    ).toBeInTheDocument();
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
            layout:
              "......./......./......./......./......./......./.......",
          },
        }),
    } as unknown as Response);

    render(<Game />);

    await user.click(
      screen.getByRole("button", { name: /Nueva partida/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
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

    render(<Game />);

    await user.click(
      screen.getByRole("button", { name: /Nueva partida/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Game server unavailable/i)
      ).toBeInTheDocument();
    });
  });

  test("does not send move without selection", () => {
    render(<Game />);

    const sendButton = screen.getByRole("button", {
      name: /Enviar jugada/i,
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
            layout:
              "......./......./......./......./......./......./.......",
          },
        }),
    } as unknown as Response);

    render(<Game />);

    await user.click(
      screen.getByRole("button", { name: /Nueva partida/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const circles = document.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);

    await user.click(circles[0]);

    const sendButton = screen.getByRole("button", {
      name: /Enviar jugada/i,
    });

    expect(sendButton).not.toBeDisabled();
  });

  test("sends move successfully", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      // new game
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              layout:
                "......./......./......./......./......./......./.......",
            },
          }),
      })
      // send move
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              layout:
                "B....../......./......./......./......./......./.......",
            },
          }),
      });

    render(<Game />);

    await user.click(
      screen.getByRole("button", { name: /Nueva partida/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await user.click(
      screen.getByRole("button", { name: /Enviar jugada/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  test("shows backend error when move fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      // new game
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            yen: {
              size: 7,
              layout:
                "......./......./......./......./......./......./.......",
            },
          }),
      })
      // send move fails
      .mockResolvedValueOnce({
        ok: false,
        text: async () =>
          JSON.stringify({
            ok: false,
            error: "Backend error",
          }),
      });

    render(<Game />);

    await user.click(
      screen.getByRole("button", { name: /Nueva partida/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const circles = document.querySelectorAll("circle");
    await user.click(circles[0]);

    await user.click(
      screen.getByRole("button", { name: /Enviar jugada/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Backend error/i)
      ).toBeInTheDocument();
    });
  });

  test("health check success", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          message: "OK",
        }),
    } as unknown as Response);

    render(<Game />);

    await user.click(
      screen.getByRole("button", {
        name: /Comprobar conexión GameY/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Conectado correctamente/i)
      ).toBeInTheDocument();
    });
  });

  test("health check failure", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: async () =>
        JSON.stringify({
          ok: false,
          error: "Connection failed",
        }),
    } as unknown as Response);

    render(<Game />);

    await user.click(
      screen.getByRole("button", {
        name: /Comprobar conexión GameY/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Error de conexión/i)
      ).toBeInTheDocument();
    });
  });
});
