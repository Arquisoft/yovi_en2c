import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

type AdminUser = {
  username: string;
  email: string | null;
  realName: string | null;
  role: "user" | "admin";
  isRootAdmin: boolean;
};

export default function AdminPage() {
  const { t } = useI18n();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const currentUsername = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Admin users load failed");
      }

      setUsers(data.users ?? []);
    } catch {
      setError(t("admin.error.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const changeRole = async (username: string, role: "user" | "admin") => {
    setError(null);

    try {
      const res = await fetch(`${API}/admin/users/${username}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Role update failed");
      }

      await loadUsers();
    } catch {
      setError(t("admin.error.role"));
    }
  };

  const deleteHistory = async (username: string) => {
    const ok = window.confirm(
      t("admin.deleteHistoryConfirm").replace("{{username}}", username)
    );

    if (!ok) return;

    setError(null);

    try {
      const res = await fetch(`${API}/admin/users/${username}/history`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Delete history failed");
      }

      await loadUsers();
    } catch {
      setError(t("admin.error.deleteHistory"));
    }
  };

  const deleteUser = async (username: string) => {
    const ok = window.confirm(
      t("admin.deleteUserConfirm").replace("{{username}}", username)
    );

    if (!ok) return;

    setError(null);

    try {
      const res = await fetch(`${API}/admin/users/${username}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Delete user failed");
      }

      await loadUsers();
    } catch {
      setError(t("admin.error.deleteUser"));
    }
  };

  return (
    <>
      <Navbar username={currentUsername} isAdmin />

      <main className="admin-page">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h1>{t("admin.title")}</h1>
            </div>
          </div>

          {error && <p className="admin-error">{error}</p>}

          {loading ? (
            <p className="admin-loading">{t("common.loading")}</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("admin.user")}</th>
                    <th>{t("admin.email")}</th>
                    <th>{t("admin.role")}</th>
                    <th>{t("admin.actions")}</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user.username}>
                      <td>
                        <Link
                          className="admin-user-link"
                          to={`/profile/${user.username}`}
                        >
                          <span className="admin-avatar" aria-hidden="true">
                            {(user.realName || user.username)
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <span>{user.realName || user.username}</span>
                        </Link>
                      </td>

                      <td>{user.email || "—"}</td>

                      <td>
                        <span className={`admin-role admin-role--${user.role}`}>
                          {t(`admin.role.${user.role}`)}
                        </span>
                      </td>

                      <td>
                        <div className="admin-actions">
                          {user.role === "admin" ? (
                            <button
                              type="button"
                              disabled={user.isRootAdmin}
                              onClick={() => changeRole(user.username, "user")}
                            >
                              {t("admin.removeAdmin")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => changeRole(user.username, "admin")}
                            >
                              {t("admin.makeAdmin")}
                            </button>
                          )}

                          <button
                            type="button"
                            className="danger"
                            onClick={() => deleteHistory(user.username)}
                          >
                            {t("admin.deleteHistory")}
                          </button>

                          <button
                            type="button"
                            className="danger danger--delete-user"
                            disabled={
                              user.isRootAdmin ||
                              user.username === currentUsername
                            }
                            onClick={() => deleteUser(user.username)}
                          >
                            {t("admin.deleteUser")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}