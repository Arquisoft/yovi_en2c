import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RegistrationForm from "../RegistrationForm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom";
import { I18nProvider } from "../i18n/I18nProvider";

function renderWithProviders() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <RegistrationForm />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("RegistrationForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("shows validation error when username is empty", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn();

    renderWithProviders();

    await user.type(
      screen.getByRole("textbox", { name: /^(email|correo electrónico)$/i }),
      "pablo@uniovi.es"
    );
    await user.type(
      screen.getByLabelText(/^(password|contraseña)$/i),
      "123456"
    );

    await user.click(
      screen.getByRole("button", { name: /^(register|registrarse)$/i })
    );

    expect(global.fetch).not.toHaveBeenCalled();

    expect(
      await screen.findByText(/username is mandatory|obligatorio/i)
    ).toBeInTheDocument();
  });

  test("shows validation error when password is empty", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn();

    renderWithProviders();

    await user.type(
      screen.getByRole("textbox", { name: /^(username|usuario)$/i }),
      "Pablo"
    );
    await user.type(
      screen.getByRole("textbox", { name: /^(email|correo electrónico)$/i }),
      "pablo@uniovi.es"
    );

    await user.click(
      screen.getByRole("button", { name: /^(register|registrarse)$/i })
    );

    expect(global.fetch).not.toHaveBeenCalled();

    expect(
      await screen.findByText(/password is mandatory|contraseña es obligatoria/i)
    ).toBeInTheDocument();
  });

  test("submits username email and password successfully", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: "User Pablo created",
      }),
    } as Response);

    renderWithProviders();

    await user.type(
      screen.getByRole("textbox", { name: /^(username|usuario)$/i }),
      "Pablo"
    );
    await user.type(
      screen.getByRole("textbox", { name: /^(email|correo electrónico)$/i }),
      "pablo@uniovi.es"
    );
    await user.type(
      screen.getByLabelText(/^(password|contraseña)$/i),
      "123456"
    );

    await user.click(
      screen.getByRole("button", { name: /^(register|registrarse)$/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/createuser$/),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "Pablo",
          email: "pablo@uniovi.es",
          password: "123456",
        }),
      })
    );
  });

  test("submits undefined email when email is empty", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: "User Pablo created",
      }),
    } as Response);

    renderWithProviders();

    await user.type(
      screen.getByRole("textbox", { name: /^(username|usuario)$/i }),
      "Pablo"
    );
    await user.type(
      screen.getByLabelText(/^(password|contraseña)$/i),
      "123456"
    );

    await user.click(
      screen.getByRole("button", { name: /^(register|registrarse)$/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/createuser$/),
      expect.objectContaining({
        body: JSON.stringify({
          username: "Pablo",
          email: undefined,
          password: "123456",
        }),
      })
    );
  });

  test("shows backend error when registration fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: "The username field is already in the data base",
      }),
    } as Response);

    renderWithProviders();

    await user.type(
      screen.getByRole("textbox", { name: /^(username|usuario)$/i }),
      "Pablo"
    );
    await user.type(
      screen.getByRole("textbox", { name: /^(email|correo electrónico)$/i }),
      "pablo@uniovi.es"
    );
    await user.type(
      screen.getByLabelText(/^(password|contraseña)$/i),
      "123456"
    );

    await user.click(
      screen.getByRole("button", { name: /^(register|registrarse)$/i })
    );

    expect(
      await screen.findByText(/already in the data base/i)
    ).toBeInTheDocument();
  });

  test("shows network error when request throws", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    renderWithProviders();

    await user.type(
      screen.getByRole("textbox", { name: /^(username|usuario)$/i }),
      "Pablo"
    );
    await user.type(
      screen.getByRole("textbox", { name: /^(email|correo electrónico)$/i }),
      "pablo@uniovi.es"
    );
    await user.type(
      screen.getByLabelText(/^(password|contraseña)$/i),
      "123456"
    );

    await user.click(
      screen.getByRole("button", { name: /^(register|registrarse)$/i })
    );

    expect(
      await screen.findByText(/network error|error de red/i)
    ).toBeInTheDocument();
  });

  test("renders link to login page", () => {
    renderWithProviders();

    const link = screen.getByRole("link", {
      name: /back to login|volver al login/i,
    });

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  test("renders password input as password type", () => {
    renderWithProviders();

    expect(
      screen.getByLabelText(/^(password|contraseña)$/i)
    ).toHaveAttribute("type", "password");
  });
});