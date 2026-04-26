import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

type Notification = {
  id: string;
  type: "friend_request" | "welcome" | "admin_granted" | "admin_revoked";
  from: string | null;
  read: boolean;
  createdAt?: string;
};

type NavbarProps = {
  username?: string | null;
  onLogout?: () => void;
  isAdmin?: boolean;
};

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const Navbar: React.FC<NavbarProps> = ({
  username,
  onLogout,
  isAdmin = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return;

    fetch(`${API}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.notifications) {
          setNotifications(data.notifications);
        }
      })
      .catch(() => {});
  }, [token]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const goHome = () => navigate("/home", { state: { username } });
  const goGame = () => navigate("/select-difficulty", { state: { username } });
  const goMultiplayer = () => navigate("/multiplayer", { state: { username } });
  const goSocial = () => navigate("/social", { state: { username } });
  const goStats = () => navigate("/statistics", { state: { username } });
  const goAdmin = () => navigate("/admin", { state: { username } });

  const goProfile = () => {
    if (username) {
      navigate(`/profile/${username}`, { state: { username } });
    }
  };

  const markNotificationRead = async (id: string) => {
    if (!token) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      await fetch(`${API}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // no rompas la navbar por una notificación
    }
  };

  const renderNotificationText = (notification: Notification) => {
    if (notification.type === "welcome") {
      return t("notifications.welcomeText");
    }

    if (notification.type === "admin_granted") {
      return t("notifications.adminGranted");
    }

    if (notification.type === "admin_revoked") {
      return t("notifications.adminRevoked");
    }

    return t("notifications.friendRequestText").replace(
      "{{from}}",
      notification.from ?? ""
    );
  };

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <div className="navbar__left">
          <button
            type="button"
            className="navbar__brand"
            onClick={goHome}
            aria-label={t("common.home")}
          >
            <img src={logo} alt={t("app.brand")} className="navbar__logo" />
          </button>

          <button
            type="button"
            className="navbtn"
            onClick={goHome}
            aria-current={location.pathname === "/home" ? "page" : undefined}
          >
            {t("common.home")}
          </button>

          <button
            type="button"
            className="navbtn"
            onClick={goGame}
            aria-current={
              location.pathname === "/select-difficulty" ||
              location.pathname === "/game"
                ? "page"
                : undefined
            }
          >
            {t("common.game")}
          </button>

          <button
            type="button"
            className="navbtn"
            onClick={goMultiplayer}
            aria-current={
              location.pathname.startsWith("/multiplayer") ? "page" : undefined
            }
          >
            {t("common.multiplayer")}
          </button>

          <button
            type="button"
            className="navbtn"
            onClick={goSocial}
            aria-current={location.pathname === "/social" ? "page" : undefined}
          >
            {t("common.social")}
          </button>

          <button
            type="button"
            className="navbtn"
            onClick={goStats}
            aria-current={
              location.pathname === "/statistics" ? "page" : undefined
            }
          >
            {t("common.stats")}
          </button>

          {isAdmin && (
            <button
              type="button"
              className="navbtn"
              onClick={goAdmin}
              aria-current={location.pathname === "/admin" ? "page" : undefined}
            >
              {t("common.admin")}
            </button>
          )}
        </div>

        <div className="navbar__right">
          <div className="notifications">
            <button
              type="button"
              className="navbtn"
              onClick={() => setOpen((prev) => !prev)}
              aria-label={t("notifications.bellLabel")}
              aria-expanded={open}
            >
              🔔
              {unreadCount > 0 && (
                <span className="navbar__notif-badge">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {open && (
              <div className="notifications__dropdown">
                {notifications.length === 0 ? (
                  <p>{t("notifications.empty")}</p>
                ) : (
                  notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      className={`notification ${
                        notification.read ? "read" : "unread"
                      }`}
                      onClick={() => markNotificationRead(notification.id)}
                    >
                      {renderNotificationText(notification)}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="navbar__user navbar__user--link"
            onClick={goProfile}
          >
            👤 {username || "—"}
          </button>

          <LanguageToggle />
          <ThemeToggle />

          <button
            type="button"
            className="navbtn navbtn--danger"
            onClick={() => onLogout?.()}
          >
            {t("common.logout")}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;