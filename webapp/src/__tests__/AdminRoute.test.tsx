import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom";
import AdminRoute from "../AdminRoute";
import { I18nProvider } from "../i18n/I18nProvider";

function ok(): Response {
  return {
    ok: true,
    json: async () => ({ success: true }),
  } as Response;
}

function fail(status = 403): Response {
  return {
    ok: false,
    status,
    json: async () => ({ success: false }),
  } as Response;
}

function renderAdminRoute() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>Admin content</div>
              </AdminRoute>
            }
          />
          <Route path="/home" element={<div>Home page</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("AdminRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  test("shows loading while checking admin permission", () => {
    localStorage.setItem("token", "token-123");

    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // intentionally never resolves
          })
      )
    );

    renderAdminRoute();

    expect(screen.getByText(/loading|cargando|common\.loading/i)).toBeInTheDocument();
  });

  test("redirects to home when token is missing", async () => {
    vi.stubGlobal("fetch", vi.fn());

    renderAdminRoute();

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("allows access when /admin/me returns ok", async () => {
    localStorage.setItem("token", "token-123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok()));

    renderAdminRoute();

    expect(await screen.findByText("Admin content")).toBeInTheDocument();
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
  });

  test("calls /admin/me with bearer token", async () => {
    localStorage.setItem("token", "token-123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok()));

    renderAdminRoute();

    await screen.findByText("Admin content");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/admin\/me$/),
      {
        headers: { Authorization: "Bearer token-123" },
      }
    );
  });

  test("redirects to home when /admin/me returns 403", async () => {
    localStorage.setItem("token", "user-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(fail(403)));

    renderAdminRoute();

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
  });

  test("redirects to home when /admin/me returns 401", async () => {
    localStorage.setItem("token", "bad-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(fail(401)));

    renderAdminRoute();

    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  test("redirects to home when request throws", async () => {
    localStorage.setItem("token", "token-123");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network")));

    renderAdminRoute();

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
  });

  test("does not render children while loading", () => {
    localStorage.setItem("token", "token-123");

    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // intentionally never resolves
          })
      )
    );

    renderAdminRoute();

    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
  });

  test("only checks admin once on mount", async () => {
    localStorage.setItem("token", "token-123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok()));

    renderAdminRoute();

    await screen.findByText("Admin content");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("keeps user on admin page after successful check", async () => {
    localStorage.setItem("token", "admin-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok()));

    renderAdminRoute();

    expect(await screen.findByText("Admin content")).toBeVisible();
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
  });
});