import { useEffect, useState } from "react";
import Navbar from "./Navbar";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

type AdminUser = {
  username: string;
  email: string | null;
  realName: string | null;
  role: "user" | "admin";
  isRootAdmin: boolean;
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const currentUsername = localStorage.getItem("username");

  const token = localStorage.getItem("token");

  const loadUsers = async () => {
    const res = await fetch(`${API}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setUsers(data.users ?? []);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const changeRole = async (username: string, role: "user" | "admin") => {
    await fetch(`${API}/admin/users/${username}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role }),
    });

    await loadUsers();
  };

  const deleteHistory = async (username: string) => {
    const ok = window.confirm(
      `¿Estás seguro de que quieres borrar el historial de partidas de ${username}? Esta es una opción destructiva.`
    );

    if (!ok) return;

    await fetch(`${API}/admin/users/${username}/history`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    await loadUsers();
  };

  return (
    <>
      <Navbar username={currentUsername} />

      <main className="admin-page">
        <h1>Admin</h1>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.username}>
                <td>
                  <a href={`/profile/${user.username}`}>
                    👤 {user.realName || user.username}
                  </a>
                </td>
                <td>{user.email || "—"}</td>
                <td>{user.role}</td>
                <td>
                  {user.role === "admin" ? (
                    <button
                      disabled={user.isRootAdmin}
                      onClick={() => changeRole(user.username, "user")}
                    >
                      Quitar admin
                    </button>
                  ) : (
                    <button onClick={() => changeRole(user.username, "admin")}>
                      Hacer admin
                    </button>
                  )}

                  <button
                    className="danger"
                    onClick={() => deleteHistory(user.username)}
                  >
                    Borrar historial
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}