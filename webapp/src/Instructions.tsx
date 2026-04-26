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

  if (!username) return null;

  return (
    <div className="page">
      <Navbar username={username} />
      
      <main className="container" style={{ paddingTop: 40 }}>
        <div className="instructions-page">
          <div className="hero instructions-header">
            <h1 className="hero__title">{t("instructions.title")}</h1>
            <p className="hero__subtitle">{t("instructions.subtitle")}</p>
          </div>

          <InstructionsContent />

          <div className="instructions-actions">
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
    </div>
  );
};

export default Instructions;