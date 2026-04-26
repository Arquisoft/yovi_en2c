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

  const fetchNotifications = async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // silencio
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const goHome = () => navigate("/home", { state: { username } });
  const goGame = () => navigate("/select-difficulty", { state: { username } });
  const goMultiplayer = () => navigate("/multiplayer", { state: { username } });
  const goSocial = () => navigate("/social", { state: { username } });
  const goStats = () => navigate("/stats", { state: { username } });
  const goAdmin = () => navigate("/admin", { state: { username } });

  const handleNotificationClick = async (id: string) => {
    try {
      await fetch(`${API}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read: true } : n
        )
      );
    } catch {
      // silencio
    }
  };

  const renderNotificationText = (n: Notification) => {
    switch (n.type) {
      case "welcome":
        return t("notifications.welcomeText");

      case "admin_granted":
        return t("notifications.adminGranted");

      case "admin_revoked":
        return t("notifications.adminRevoked");

      case "friend_request":
      default:
        return t("notifications.friendRequestText").replace(
          "{{from}}",
          n.from ?? ""
        );
    }
  };

  return (
    <header className="navbar">
      <div className="navbar__inner">

        {/* LEFT */}
        <div className="navbar__left">
          <button className="navbar__brand" onClick={goHome}>
            <img src={logo} alt="logo" />
          </button>

          <button
            className="navbtn"
            onClick={goGame}
            aria-current={location.pathname === "/select-difficulty" ? "page" : undefined}
          >
            {t("common.game")}
          </button>

          <button
            className="navbtn"
            onClick={goMultiplayer}
            aria-current={location.pathname === "/multiplayer" ? "page" : undefined}
          >
            Multiplayer
          </button>

          <button
            className="navbtn"
            onClick={goSocial}
            aria-current={location.pathname === "/social" ? "page" : undefined}
          >
            {t("common.social")}
          </button>

          <button
            className="navbtn"
            onClick={goStats}
            aria-current={location.pathname === "/stats" ? "page" : undefined}
          >
            {t("common.stats")}
          </button>

          {/* 🔥 ADMIN SOLO SI ES ADMIN */}
          {isAdmin && (
            <button
              className="navbtn"
              onClick={goAdmin}
              aria-current={location.pathname === "/admin" ? "page" : undefined}
            >
              {t("common.admin")}
            </button>
          )}
        </div>

        {/* RIGHT */}
        <div className="navbar__right">

          {/* NOTIFICATIONS */}
          <div className="notifications">
            <button onClick={() => setOpen(!open)}>
              🔔 {unreadCount > 0 && <span>({unreadCount})</span>}
            </button>

            {open && (
              <div className="notifications__dropdown">
                {notifications.length === 0 && (
                  <p>{t("notifications.empty")}</p>
                )}

                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notification ${n.read ? "read" : "unread"}`}
                    onClick={() => handleNotificationClick(n.id)}
                  >
                    {renderNotificationText(n)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <LanguageToggle />
          <ThemeToggle />

          <span className="navbar__user">{username}</span>

          <button onClick={onLogout}>
            {t("common.logout")}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;