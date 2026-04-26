import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

type AdminRouteProps = {
  children: ReactNode;
};

export default function AdminRoute({ children }: AdminRouteProps) {
  const { t } = useI18n();
  const [state, setState] = useState<"loading" | "allowed" | "denied">(
    "loading"
  );

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setState("denied");
      return;
    }

    fetch(`${API}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => setState(res.ok ? "allowed" : "denied"))
      .catch(() => setState("denied"));
  }, []);

  if (state === "loading") {
    return <p>{t("common.loading")}</p>;
  }

  if (state === "denied") {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}