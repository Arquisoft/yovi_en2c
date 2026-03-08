import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginForm from "../LoginForm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom";
import { I18nProvider } from "../i18n/I18nProvider";

function renderWithProviders() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("LoginForm", () => {
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

    await user.click(
      screen.getByRole("button", { name: /login|iniciar sesión/i })
    );

    expect(global.fetch).not.toHaveBeenCalled();

    expect(
      await screen.findByText(
        /please enter a username|por favor, introduce un nombre de usuario/i
      )
    ).toBeInTheDocument();
  });

  test("shows validation error when password is empty", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn();

    renderWithProviders();

    await user.type(screen.getByLabelText(/username|usuario/i), "Pablo");

    await user.click(
      screen.getByRole("button", { name: /login|iniciar sesión/i })
    );

    expect(global.fetch).not.toHaveBeenCalled();

    expect(
      await screen.findByText(
        /please enter a password|por favor, introduce una contraseña/i
      )
    ).toBeInTheDocument();
  });

  test("submits username and password and stores username on success", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: "Welcome Pablo",
      }),
    } as Response);

    renderWithProviders();

    await user.type(screen.getByLabelText(/username|usuario/i), "Pablo");
    await user.type(screen.getByLabelText(/password|contraseña/i), "123456");

    await user.click(
      screen.getByRole("button", { name: /login|iniciar sesión/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/login$/),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "Pablo", password: "123456" }),
      })
    );

    await waitFor(() => {
      expect(localStorage.getItem("username")).toBe("Pablo");
    });
  });

  test("shows backend error when login fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: "Invalid credentials",
      }),
    } as Response);

    renderWithProviders();

    await user.type(screen.getByLabelText(/username|usuario/i), "Pablo");
    await user.type(screen.getByLabelText(/password|contraseña/i), "wrong");

    await user.click(
      screen.getByRole("button", { name: /login|iniciar sesión/i })
    );

    expect(
      await screen.findByText(/invalid credentials|credenciales inválidas/i)
    ).toBeInTheDocument();

    expect(localStorage.getItem("username")).toBeNull();
  });

  test("shows network error when request throws", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    renderWithProviders();

    await user.type(screen.getByLabelText(/username|usuario/i), "Pablo");
    await user.type(screen.getByLabelText(/password|contraseña/i), "123456");

    await user.click(
      screen.getByRole("button", { name: /login|iniciar sesión/i })
    );

    expect(
      await screen.findByText(/network error|error de red/i)
    ).toBeInTheDocument();
  });

  test("renders link to registration page", () => {
    renderWithProviders();

    const link = screen.getByRole("link", {
      name: /regístrate|register|don't have an account/i,
    });

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/register");
  });
});