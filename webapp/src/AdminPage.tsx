import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

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

  return (
    <>
      <Navbar username={currentUsername} isAdmin />

      <main className="admin-page">
        <h1>{t("admin.title")}</h1>

        {error && <p className="admin-error">{error}</p>}

        {loading ? (
          <p>{t("common.loading")}</p>
        ) : (
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
                    <Link to={`/profile/${user.username}`}>
                      👤 {user.realName || user.username}
                    </Link>
                  </td>

                  <td>{user.email || "—"}</td>

                  <td>{t(`admin.role.${user.role}`)}</td>

                  <td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}