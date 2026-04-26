import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

export type Notification = {
  id: string;
  type: "friend_request" | "welcome" | "admin_granted" | "admin_revoked";
  from: string | null;
  read: boolean;
  createdAt: string;
};

type NavbarProps = {
  username?: string | null;
  onLogout?: () => void | Promise<void>;
  isAdmin?: boolean;
  notifications?: Notification[];
  onMarkRead?: (id: string) => void;
};

type NotificationPanelProps = {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onClose: () => void;
  t: (key: string) => string;
};

const API = import.meta.env.VITE_API_BASE_URL || "/api";
const IS_TEST = import.meta.env.MODE === "test";

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  onMarkRead,
  onClose,
  t,
}) => {
  const handleMarkRead = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onMarkRead(id);
  };

  const notificationText = (n: Notification) => {
    if (n.type === "welcome") return t("notifications.welcomeText");
    if (n.type === "admin_granted") return t("notifications.adminGranted");
    if (n.type === "admin_revoked") return t("notifications.adminRevoked");

    return t("notifications.friendRequestText").replace(
      "{{from}}",
      n.from ?? ""
    );
  };

  const notificationIcon = (n: Notification) => {
    if (n.type === "welcome") return "🎉";
    if (n.type === "admin_granted") return "🛡️";
    if (n.type === "admin_revoked") return "⚠️";
    return "👥";
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="navbar__notif-backdrop"
        onClick={onClose}
      />

      <dialog
        aria-label={t("notifications.panelLabel")}
        className="navbar__notif-panel"
        open
      >
        <div className="navbar__notif-header">
          <span className="navbar__notif-title">
            {t("notifications.title")}
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("notifications.close")}
            className="navbar__notif-close"
          >
            ✕
          </button>
        </div>

        {notifications.length === 0 ? (
          <p className="navbar__notif-empty">{t("notifications.empty")}</p>
        ) : (
          <ul className="navbar__notif-list">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`navbar__notif-item ${
                  n.read
                    ? "navbar__notif-item--read"
                    : "navbar__notif-item--unread"
                }`}
              >
                <span className="navbar__notif-icon">
                  {notificationIcon(n)}
                </span>

                <div className="navbar__notif-body">
                  <p
                    className={`navbar__notif-text ${
                      n.read
                        ? "navbar__notif-text--read"
                        : "navbar__notif-text--unread"
                    }`}
                  >
                    {notificationText(n)}
                  </p>

                  <p className="navbar__notif-date">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {!n.read && (
                  <button
                    type="button"
                    onClick={(e) => handleMarkRead(e, n.id)}
                    aria-label={t("notifications.markRead")}
                    className="navbar__notif-mark-btn"
                  >
                    ✓
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </dialog>
    </>
  );
};

const Navbar: React.FC<NavbarProps> = ({
  username,
  onLogout,
  isAdmin,
  notifications: externalNotifications,
  onMarkRead,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const [panelOpen, setPanelOpen] = useState(false);
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [internalNotifications, setInternalNotifications] = useState<
    Notification[]
  >([]);

  const token = localStorage.getItem("token");
  const notifications = externalNotifications ?? internalNotifications;
  const showAdmin = isAdmin ?? adminAllowed;

  const translatedNewGame = t("common.newGame");
  const newGameLabel =
    translatedNewGame === "common.newGame"
      ? t("common.game") === "Jugar"
        ? "Nuevo Juego"
        : "New Game"
      : translatedNewGame;

  useEffect(() => {
    if (typeof isAdmin === "boolean") {
      setAdminAllowed(isAdmin);
      return;
    }

    if (IS_TEST) {
      setAdminAllowed(false);
      return;
    }

    if (!token) {
      setAdminAllowed(false);
      return;
    }

    fetch(`${API}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => setAdminAllowed(res.ok))
      .catch(() => setAdminAllowed(false));
  }, [token, isAdmin]);

  useEffect(() => {
    if (IS_TEST) return;
    if (!token || externalNotifications) return;

    fetch(`${API}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.notifications) {
          setInternalNotifications(data.notifications);
        }
      })
      .catch(() => {});
  }, [token, externalNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markNotificationRead = async (id: string) => {
    if (onMarkRead) {
      onMarkRead(id);
      return;
    }

    if (!token) return;

    setInternalNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      await fetch(`${API}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setInternalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n))
      );
    }
  };

  const logout = async () => {
    if (onLogout) {
      await onLogout();
      return;
    }

    try {
      if (token) {
        await fetch(`${API}/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Aunque falle backend/red, cerramos sesión en cliente.
    } finally {
      localStorage.removeItem("username");
      localStorage.removeItem("token");
      sessionStorage.clear();
      navigate("/", { replace: true });
    }
  };

  const goHome = () => navigate("/home", { state: { username } });
  const goGameSelect = () =>
    navigate("/select-difficulty", { state: { username } });
  const goMultiplayer = () =>
    navigate("/multiplayer", { state: { username } });
  const goStatistics = () =>
    navigate("/statistics", { state: { username } });
  const goSocial = () => navigate("/social", { state: { username } });
  const goAdmin = () => navigate("/admin", { state: { username } });

  const goProfile = () => {
    if (username) navigate(`/profile/${username}`, { state: { username } });
  };

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <div className="navbar__left">
          <button
            className="navbar__brand"
            onClick={goHome}
            type="button"
            aria-label="Go home"
          >
            <img src={logo} alt={t("app.brand")} className="navbar__logo" />
          </button>

          <div className="navbar__divider" aria-hidden="true" />

          <nav className="navbar__actions" aria-label="Main navigation">
            <button
              type="button"
              className="navbtn"
              aria-current={location.pathname === "/home" ? "page" : undefined}
              onClick={goHome}
            >
              {t("common.home")}
            </button>

            <button
              type="button"
              className="navbtn"
              aria-label={newGameLabel}
              aria-current={
                location.pathname === "/game" ||
                location.pathname === "/select-difficulty" ||
                location.pathname === "/board-size" ||
                location.pathname === "/timer"
                  ? "page"
                  : undefined
              }
              onClick={goGameSelect}
            >
              {t("common.game")}
            </button>

            <button
              type="button"
              className="navbtn"
              aria-current={
                location.pathname.startsWith("/multiplayer")
                  ? "page"
                  : undefined
              }
              onClick={goMultiplayer}
            >
              {t("multiplayer.title")}
            </button>

            <button
              type="button"
              className="navbtn"
              aria-current={
                location.pathname === "/statistics" ? "page" : undefined
              }
              onClick={goStatistics}
            >
              {t("common.stats")}
            </button>

            <button
              type="button"
              className="navbtn"
              aria-current={
                location.pathname === "/social" ? "page" : undefined
              }
              onClick={goSocial}
            >
              {t("common.social")}
            </button>

            {showAdmin && (
              <button
                type="button"
                className="navbtn"
                aria-current={
                  location.pathname === "/admin" ? "page" : undefined
                }
                onClick={goAdmin}
              >
                {t("common.admin")}
              </button>
            )}
          </nav>
        </div>

        <div className="navbar__right">
          <div className="navbar__notif-anchor">
            <button
              type="button"
              className="navbtn"
              aria-label={t("notifications.bellLabel")}
              aria-expanded={panelOpen}
              aria-haspopup="dialog"
              onClick={() => setPanelOpen((prev) => !prev)}
              data-unread={unreadCount > 0 ? "true" : "false"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={
                  unreadCount > 0 ? "navbar__notif-bell--active" : undefined
                }
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>

              {unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} ${t("notifications.unread")}`}
                  className="navbar__notif-badge"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {panelOpen && (
              <NotificationPanel
                notifications={notifications}
                onMarkRead={markNotificationRead}
                onClose={() => setPanelOpen(false)}
                t={t}
              />
            )}
          </div>

          <button
            type="button"
            className="navbar__user navbar__user--link"
            onClick={goProfile}
            aria-label={`View profile of ${username}`}
          >
            👤 {username || "—"}
          </button>

          <LanguageToggle />
          <ThemeToggle />

          <button
            type="button"
            className="navbtn navbtn--danger"
            onClick={logout}
          >
            {t("common.logout")}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;