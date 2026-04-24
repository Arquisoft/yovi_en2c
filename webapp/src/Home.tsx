import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar, { type Notification } from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";

type LocationState = { username?: string };

const API_URL = "/api";

const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t }    = useI18n();

  const [checkingSession,  setCheckingSession]  = useState(true);
  const [notifications,    setNotifications]    = useState<Notification[]>([]);

  const username = useMemo(() => {
    const st = (location.state as LocationState | null) ?? null;
    return st?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  const token = useMemo(() => localStorage.getItem("token") ?? "", []);

  // ── Fetch notifications ───────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res  = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setNotifications(data.notifications ?? []);
    } catch {
      // Non-critical: swallow silently
    }
  }, [token]);

  // ── Mark a single notification as read ───────────────────────────────────

  const handleMarkRead = useCallback(async (id: string) => {
    // Optimistic update — flip the flag immediately in UI
    setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    // Persist to backend (fire-and-forget from UI perspective)
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Revert on network error
      setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, read: false } : n)
      );
    }
  }, [token]);

  // ── Verify session then load notifications ────────────────────────────────

  useEffect(() => {
    const verifySession = async () => {
      if (!username || !token) {
        localStorage.removeItem("username");
        localStorage.removeItem("token");
        navigate("/", { replace: true });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/verify`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          localStorage.removeItem("username");
          localStorage.removeItem("token");
          navigate("/", { replace: true });
          return;
        }

        setCheckingSession(false);
        fetchNotifications();
      } catch {
        localStorage.removeItem("username");
        localStorage.removeItem("token");
        navigate("/", { replace: true });
      }
    };

    verifySession();
  }, [username, token, navigate, fetchNotifications]);

  const logout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  const startQuickGame = () => {
    navigate("/game", { state: { username, bot: "minimax_bot", boardSize: 7, mode: "bot" } });
  };

  if (checkingSession || !username || !token) return null;

  return (
      <div className="page">
        <Navbar
            username={username}
            onLogout={logout}
            notifications={notifications}
            onMarkRead={handleMarkRead}
        />

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
              <button className="btn btn--primary" onClick={startQuickGame} type="button">
                {t("home.quickgame")}
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
              <div style={{ marginTop: 16 }}>
                <button
                    className="btn btn--primary"
                    onClick={() => navigate("/instructions", { state: { username } })}
                    type="button"
                >
                  {t("home.instructions")}
                </button>
              </div>
            </article>

            {/* Card 2: Local multiplayer — now links to the game setup screen */}
            <article className="card">
              <h2 className="card__title">{t("home.card2.title")}</h2>
              <p className="card__text">{t("home.card2.text")}</p>
              <div style={{ marginTop: 16 }}>
                <button
                    className="btn btn--primary"
                    onClick={() => navigate("/select-difficulty")}
                    type="button"
                >
                  {t("home.card2.cta")}
                </button>
              </div>
            </article>

            <article className="card">
              <h2 className="card__title">{t("home.card3.title")}</h2>
              <p className="card__text">{t("home.card3.text")}</p>
              <div style={{ marginTop: 16 }}>
                <button
                    className="btn btn--primary"
                    onClick={() => navigate("/select-difficulty")}
                    type="button"
                >
                  {t("home.selectDifficulty")}
                </button>
              </div>
            </article>
          </section>
        </main>
      </div>
  );
};

export default Home;