import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import InstructionsContent from "./InstructionsContent";
import { useI18n } from "./i18n/I18nProvider";

const Instructions: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const username = useMemo(() => {
    const st = (location.state as { username?: string } | null) ?? null;
    return st?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  const logout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  if (!username) return null;

  return (
    <main className="container" style={{ paddingTop: 40 }}>
      <div
        style={{
          maxWidth: 850,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div className="hero" style={{ textAlign: "center" }}>
          <h1 className="hero__title">{t("instructions.title")}</h1>
          <p className="hero__subtitle">{t("instructions.subtitle")}</p>
        </div>

        <InstructionsContent />

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => navigate("/home", { state: { username } })}
          >
            {t("instructions.back")}
          </button>
        </div>
      </div>
    </main>
  );
};

export default Instructions;