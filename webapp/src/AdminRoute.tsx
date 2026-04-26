import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function AdminRoute({ children }: { children: JSX.Element }) {
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch(`${API}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => setState(res.ok ? "allowed" : "denied"))
      .catch(() => setState("denied"));
  }, []);

  if (state === "loading") return <p>Loading...</p>;
  if (state === "denied") return <Navigate to="/home" replace />;

  return children;
}