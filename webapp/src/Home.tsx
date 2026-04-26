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
  const { t } = useI18n();

  const [checkingSession, setCheckingSession] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const username = useMemo(() => {
    const st = (location.state as LocationState | null) ?? null;
    return st?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  const token = useMemo(() => localStorage.getItem("token") ?? "", []);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      if (data.success) setNotifications(data.notifications ?? []);
    } catch {
      // Non-critical
    }
  }, [token]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );

      try {
        await fetch(`${API_URL}/notifications/${id}/read`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: false } : n))
        );
      }
    },
    [token]
  );

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

        try {
          const adminRes = await fetch(`${API_URL}/admin/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          setIsAdmin(adminRes.ok);
        } catch {
          setIsAdmin(false);
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
    navigate("/game", { state: { username, bot: "minimax_bot", boardSize: 7 } });
  };

  const goLocalGame = () => {
    navigate("/select-difficulty", {
      state: { username, bot: "local", boardSize: 7, localGame: true },
    });
  };

  const goMultiplayer = () => {
    navigate("/multiplayer", { state: { username } });
  };

  const goInstructions = () => {
    navigate("/instructions", { state: { username } });
  };

  const goDifficulty = () => {
    navigate("/select-difficulty", { state: { username } });
  };

  const goSocial = () => {
    navigate("/social", { state: { username } });
  };

  if (checkingSession || !username || !token) return null;

  return (
    <div className="page">
      <Navbar
        username={username}
        onLogout={logout}
        isAdmin={isAdmin}
        notifications={notifications}
        onMarkRead={handleMarkRead}
      />

      <main className="container">
        <section className="hero" aria-label={t("home.aria")}>
          <div className="hero__top">
            <img src={logo} alt={t("app.brand")} className="hero__logo" />

            <div className="hero__badge">
              <span aria-hidden="true" />
              {t("home.badge")}
            </div>
          </div>

          <h1 className="hero__title">{t("home.welcome", { username })}</h1>
          <p className="hero__subtitle">{t("home.subtitle")}</p>

          <div className="hero__actions">
            <button
              className="btn btn--primary"
              onClick={startQuickGame}
              type="button"
            >
              {t("home.quickgame")}
            </button>

            <button
              className="btn btn--secondary"
              onClick={goMultiplayer}
              type="button"
            >
              {t("home.multiplayer")}
            </button>

            <button
              className="btn btn--ghost"
              onClick={logout}
              type="button"
            >
              {t("home.changeUser")}
            </button>
          </div>
        </section>

        <section className="grid" aria-label={t("home.cardsAria")}>
          <article className="card">
            <div className="hero__badge">
              <span aria-hidden="true" />
              {t("home.card1.pill")}
            </div>
            <h2 className="card__title">{t("home.card1.title")}</h2>
            <p className="card__text">{t("home.card1.text")}</p>
            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn--primary"
                onClick={goInstructions}
                type="button"
              >
                {t("home.instructions")}
              </button>
            </div>
          </article>

          <article className="card">
            <div className="hero__badge">
              <span aria-hidden="true" />
              {t("home.card2.pill")}
            </div>
            <h2 className="card__title">{t("home.card2.title")}</h2>
            <p className="card__text">{t("home.card2.text")}</p>
            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn--primary"
                onClick={goMultiplayer}
                type="button"
              >
                {t("home.card2.button")}
              </button>
            </div>
          </article>

          <article className="card">
            <div className="hero__badge">
              <span aria-hidden="true" />
              {t("home.card3.pill")}
            </div>
            <h2 className="card__title">{t("home.card3.title")}</h2>
            <p className="card__text">{t("home.card3.text")}</p>
            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn--primary"
                onClick={goDifficulty}
                type="button"
              >
                {t("home.selectDifficulty")}
              </button>
            </div>
          </article>

          <article className="card">
            <div className="hero__badge">
              <span aria-hidden="true" />
              {t("home.card4.pill")}
            </div>
            <h2 className="card__title">{t("home.card4.title")}</h2>
            <p className="card__text">{t("home.card4.text")}</p>
            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn--primary"
                onClick={goSocial}
                type="button"
              >
                {t("home.card4.button")}
              </button>
            </div>
          </article>

          <article className="card">
            <div className="hero__badge">
              <span aria-hidden="true" />
              {t("home.card5.pill")}
            </div>
            <h2 className="card__title">{t("home.card5.title")}</h2>
            <p className="card__text">{t("home.card5.text")}</p>
            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn--primary"
                onClick={goLocalGame}
                type="button"
              >
                {t("home.card5.button")}
              </button>
            </div>
          </article>

          <article className="card">
            <div className="hero__badge">
              <span aria-hidden="true" />
              {t("home.card6.pill")}
            </div>
            <h2 className="card__title">{t("home.card6.title")}</h2>
            <p className="card__text">{t("home.card6.text")}</p>
          </article>
        </section>
      </main>
    </div>
  );
};

export default Home;