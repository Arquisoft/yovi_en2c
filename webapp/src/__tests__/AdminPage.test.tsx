import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom";
import AdminPage from "../AdminPage";
import { I18nProvider } from "../i18n/I18nProvider";

vi.mock("../Navbar", () => ({
  default: ({ username, isAdmin }: { username?: string | null; isAdmin?: boolean }) => (
    <div>
      Navbar {username} {isAdmin ? "admin" : "user"}
    </div>
  ),
}));

const USERS = [
  {
    username: "admin",
    email: "admin@admin.com",
    realName: null,
    role: "admin",
    isRootAdmin: true,
  },
  {
    username: "alice",
    email: "alice@test.com",
    realName: "Alice Liddell",
    role: "user",
    isRootAdmin: false,
  },
  {
    username: "bob",
    email: null,
    realName: null,
    role: "admin",
    isRootAdmin: false,
  },
  {
    username: "pablo",
    email: "pablo@test.com",
    realName: "Pablo",
    role: "admin",
    isRootAdmin: false,
  },
] as const;

function ok(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function fail(body: unknown, status = 500): Response {
  return {
    ok: false,
    status,
    json: async () => body,
  } as Response;
}

function renderAdminPage() {
  localStorage.setItem("username", "pablo");
  localStorage.setItem("token", "token-123");

  return render(
    <I18nProvider>
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    </I18nProvider>
  );
}

function mockInitialUsers(users = USERS) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce(ok({ success: true, users }))
  );
}

const makeAdminRe = /hacer admin|make admin|admin\.makeAdmin/i;
const removeAdminRe = /quitar admin|remove admin|admin\.removeAdmin/i;
const resetRe = /borrar historial|reset|admin\.deleteHistory/i;
const deleteUserRe = /borrar usuario|delete user|admin\.deleteUser/i;

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  test("renders navbar as admin", async () => {
    mockInitialUsers();
    renderAdminPage();

    expect(await screen.findByText(/Navbar pablo admin/i)).toBeInTheDocument();
  });

  test("loads and renders all users", async () => {
    mockInitialUsers();
    renderAdminPage();

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("pablo")).toBeInTheDocument();
  });

  test("calls GET /api/admin/users with bearer token", async () => {
    mockInitialUsers();
    renderAdminPage();

    await screen.findByText("alice");

    expect(global.fetch).toHaveBeenCalledWith("/api/admin/users", {
      headers: { Authorization: "Bearer token-123" },
    });
  });

  test("shows fallback dash when email is missing", async () => {
    mockInitialUsers();
    renderAdminPage();

    await screen.findByText("bob");

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  test("renders user profile links", async () => {
    mockInitialUsers();
    renderAdminPage();

    const aliceText = await screen.findByText("alice");
    const aliceLink = aliceText.closest("a");

    expect(aliceLink).toBeInTheDocument();
    expect(aliceLink).toHaveAttribute("href", "/profile/alice");
  });

  test("renders avatar initials from username", async () => {
    mockInitialUsers();
    renderAdminPage();

    expect(await screen.findByText("AL")).toBeInTheDocument();
  });

  test("renders avatar initials from username when realName is missing", async () => {
    mockInitialUsers();
    renderAdminPage();

    expect(await screen.findByText("BO")).toBeInTheDocument();
  });

  test("shows loading while users are loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>(() => {
            // intentionally never resolves
          })
      )
    );

    renderAdminPage();

    expect(screen.getByText(/loading|cargando|common\.loading/i)).toBeInTheDocument();
  });

  test("shows error when initial load fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(fail({ error: "Forbidden" }, 403)));

    renderAdminPage();

    expect(await screen.findByText(/admin\.error\.load|error/i)).toBeInTheDocument();
  });

  test("shows error when initial load throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network")));

    renderAdminPage();

    expect(await screen.findByText(/admin\.error\.load|error/i)).toBeInTheDocument();
  });

  test("make admin sends PATCH with role admin and reloads users", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(ok({ success: true, users: USERS }))
        .mockResolvedValueOnce(ok({ success: true }))
        .mockResolvedValueOnce(ok({ success: true, users: USERS }))
    );

    renderAdminPage();

    const aliceRow = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(aliceRow).getByRole("button", { name: makeAdminRe }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/users/alice/role",
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer token-123",
          }),
          body: JSON.stringify({ role: "admin" }),
        })
      );
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test("remove admin sends PATCH with role user and reloads users", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(ok({ success: true, users: USERS }))
        .mockResolvedValueOnce(ok({ success: true }))
        .mockResolvedValueOnce(ok({ success: true, users: USERS }))
    );

    renderAdminPage();

    const bobRow = (await screen.findByText("bob")).closest("tr") as HTMLTableRowElement;
    await user.click(within(bobRow).getByRole("button", { name: removeAdminRe }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/users/bob/role",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "user" }),
        })
      );
    });
  });

  test("root admin cannot be demoted", async () => {
    mockInitialUsers();
    renderAdminPage();

    const adminRow = (await screen.findByText("admin")).closest("tr") as HTMLTableRowElement;
    const removeButton = within(adminRow).getByRole("button", { name: removeAdminRe });

    expect(removeButton).toBeDisabled();
  });

  test("shows error when role update fails", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(ok({ success: true, users: USERS }))
        .mockResolvedValueOnce(fail({ error: "Role update failed" }, 400))
    );

    renderAdminPage();

    const aliceRow = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(aliceRow).getByRole("button", { name: makeAdminRe }));

    expect(await screen.findByText(/admin\.error\.role|error/i)).toBeInTheDocument();
  });

  test("does not delete history when confirm is cancelled", async () => {
    const user = userEvent.setup();
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    mockInitialUsers();
    renderAdminPage();

    const aliceRow = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(aliceRow).getByRole("button", { name: resetRe }));

    expect(window.confirm).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("delete history sends DELETE and reloads users", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(ok({ success: true, users: USERS }))
        .mockResolvedValueOnce(ok({ success: true }))
        .mockResolvedValueOnce(ok({ success: true, users: USERS }))
    );

    renderAdminPage();

    const aliceRow = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(aliceRow).getByRole("button", { name: resetRe }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/admin/users/alice/history", {
        method: "DELETE",
        headers: { Authorization: "Bearer token-123" },
      });
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test("delete history confirm mentions the selected username", async () => {
    const user = userEvent.setup();

    mockInitialUsers();
    renderAdminPage();

    const aliceRow = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(aliceRow).getByRole("button", { name: resetRe }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("alice"));
  });

  test("shows error when delete history fails", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(ok({ success: true, users: USERS }))
        .mockResolvedValueOnce(fail({ error: "Delete failed" }, 500))
    );

    renderAdminPage();

    const aliceRow = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(aliceRow).getByRole("button", { name: resetRe }));

    expect(await screen.findByText(/admin\.error\.deleteHistory|error/i)).toBeInTheDocument();
  });

  test("does not delete user when confirm is cancelled", async () => {
    const user = userEvent.setup();
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    mockInitialUsers();
    renderAdminPage();

    const aliceRow = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(aliceRow).getByRole("button", { name: deleteUserRe }));

    expect(window.confirm).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("delete user sends DELETE and reloads users", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(ok({ success: true, users: USERS }))
        .mockResolvedValueOnce(ok({ success: true }))
        .mockResolvedValueOnce(ok({ success: true, users: USERS.filter((u) => u.username !== "alice") }))
    );

    renderAdminPage();

    const aliceRow = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(aliceRow).getByRole("button", { name: deleteUserRe }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/admin/users/alice", {
        method: "DELETE",
        headers: { Authorization: "Bearer token-123" },
      });
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test("delete user confirm mentions the selected username", async () => {
    const user = userEvent.setup();

    mockInitialUsers();
    renderAdminPage();

    const aliceRow = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(aliceRow).getByRole("button", { name: deleteUserRe }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("alice"));
  });

  test("root admin cannot be deleted", async () => {
    mockInitialUsers();
    renderAdminPage();

    const adminRow = (await screen.findByText("admin")).closest("tr") as HTMLTableRowElement;
    const deleteButton = within(adminRow).getByRole("button", { name: deleteUserRe });

    expect(deleteButton).toBeDisabled();
  });

  test("current user cannot delete themselves", async () => {
    mockInitialUsers();
    renderAdminPage();

    const pabloRow = (await screen.findByText("pablo")).closest("tr") as HTMLTableRowElement;
    const deleteButton = within(pabloRow).getByRole("button", { name: deleteUserRe });

    expect(deleteButton).toBeDisabled();
  });

  test("shows error when delete user fails", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(ok({ success: true, users: USERS }))
        .mockResolvedValueOnce(fail({ error: "Delete user failed" }, 500))
    );

    renderAdminPage();

    const aliceRow = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(aliceRow).getByRole("button", { name: deleteUserRe }));

    expect(await screen.findByText(/admin\.error\.deleteUser|error/i)).toBeInTheDocument();
  });
});