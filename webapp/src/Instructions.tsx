import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
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
    <div className="page">
      <Navbar username={username} onLogout={logout} />

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

          <section className="card">
            <h2 className="card__title">{t("instructions.howToPlay.title")}</h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                lineHeight: 1.6,
                textAlign: "left",
              }}
            >
              <p>{t("instructions.howToPlay.p1")}</p>
              <p>{t("instructions.howToPlay.p2")}</p>
              <p>{t("instructions.howToPlay.p3")}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">{t("instructions.difficulty.title")}</h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                lineHeight: 1.6,
                textAlign: "left",
              }}
            >
              <p>{t("instructions.difficulty.p1")}</p>
              <p>{t("instructions.difficulty.p2")}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">{t("instructions.board.title")}</h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                lineHeight: 1.6,
                textAlign: "left",
              }}
            >
              <p>{t("instructions.board.p1")}</p>
              <p>{t("instructions.board.p2")}</p>
            </div>
          </section>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              className="btn btn--primary"
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