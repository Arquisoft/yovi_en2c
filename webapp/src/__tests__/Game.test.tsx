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

  test("does not send move without selection", () => {
    render(<Game />);

    const sendButton = screen.getByRole("button", {
      name: /Enviar jugada/i,
    });

    expect(sendButton).toBeDisabled();
  });
});
