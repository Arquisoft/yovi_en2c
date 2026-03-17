import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";

type LocationState = { username?: string };

const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [checkingSession, setCheckingSession] = useState(true);

  const username = useMemo(() => {
    const st = (location.state as LocationState | null) ?? null;
    return st?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  const token = useMemo(() => localStorage.getItem("token") ?? "", []);

  useEffect(() => {
    const verifySession = async () => {
      if (!username || !token) {
        localStorage.removeItem("username");
        localStorage.removeItem("token");
        navigate("/", { replace: true });
        return;
      }

      try {
        const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

        const res = await fetch(`${API_URL}/verify`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) {
          localStorage.removeItem("username");
          localStorage.removeItem("token");
          navigate("/", { replace: true });
          return;
        }

        setCheckingSession(false);
      } catch {
        localStorage.removeItem("username");
        localStorage.removeItem("token");
        navigate("/", { replace: true });
      }
    };

    verifySession();
  }, [username, token, navigate]);

  const logout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  const start = () => navigate("/game", { state: { username } });

  if (checkingSession || !username || !token) return null;

  return (
    <div className="page">
      <Navbar username={username} onLogout={logout} />

      <main className="container">
        <section className="hero" aria-label="Panel de inicio">
          <div className="hero__top">
            <img src={logo} alt="GameY" className="hero__logo" />

            <div className="hero__badge">
              <span aria-hidden="true" />
              {t("home.badge")}
            </div>
          </div>

          <h1 className="hero__title">{t("home.welcome", { username })}</h1>
          <p className="hero__subtitle">{t("home.subtitle")}</p>

          <div className="hero__actions">
            <button className="btn btn--primary" onClick={start} type="button">
              {t("home.start")}
            </button>

            <button className="btn btn--ghost" onClick={logout} type="button">
              {t("home.changeUser")}
            </button>
          </div>
        </section>

        <section className="grid" aria-label="Tarjetas informativas">
          <article className="card">
            <h2 className="card__title">{t("home.card1.title")}</h2>
            <p className="card__text">{t("home.card1.text")}</p>
            <span className="pill">{t("home.card1.pill")}</span>
          </article>

          <article className="card">
            <h2 className="card__title">{t("home.card2.title")}</h2>
            <p className="card__text">{t("home.card2.text")}</p>
            <span className="pill">{t("home.card2.pill")}</span>
          </article>

          <article className="card">
            <h2 className="card__title">{t("home.card3.title")}</h2>
            <p className="card__text">{t("home.card3.text")}</p>
            <span className="pill">{t("home.card3.pill")}</span>
          </article>
        </section>
      </main>
    </div>
  );
};

export default Home;