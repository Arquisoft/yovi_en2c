import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Notification = {
    id: string;
    type: "friend_request" | "welcome";
    from: string | null;
    read: boolean;
    createdAt: string;
};

type NavbarProps = {
    username?: string | null;
    onLogout?: () => void;
    notifications?: Notification[];
    onMarkRead?: (id: string) => void;
};

// ── NotificationPanel ─────────────────────────────────────────────────────────

type NotificationPanelProps = {
    notifications: Notification[];
    onMarkRead: (id: string) => void;
    onClose: () => void;
    t: (key: string) => string;
};

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

    return (
        <>
            {/* Backdrop — cierra el panel al clicar fuera */}
            <div
                aria-hidden="true"
                className="navbar__notif-backdrop"
                onClick={onClose}
            />

            <dialog
                aria-label={t("notifications.panelLabel")}
                className="navbar__notif-panel"
            >
                {/* Header */}
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

                {/* Empty state */}
                {notifications.length === 0 ? (
                    <p className="navbar__notif-empty">
                        {t("notifications.empty")}
                    </p>
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
                                {/* Icon */}
                                <span className="navbar__notif-icon">
                  {n.type === "welcome" ? "🎉" : "👥"}
                </span>

                                {/* Text */}
                                <div className="navbar__notif-body">
                                    <p
                                        className={`navbar__notif-text ${
                                            n.read
                                                ? "navbar__notif-text--read"
                                                : "navbar__notif-text--unread"
                                        }`}
                                    >
                                        {n.type === "welcome"
                                            ? t("notifications.welcomeText")
                                            : t("notifications.friendRequestText").replace(
                                                "{{from}}",
                                                n.from ?? ""
                                            )}
                                    </p>
                                    <p className="navbar__notif-date">
                                        {new Date(n.createdAt).toLocaleDateString()}
                                    </p>
                                </div>

                                {/* Mark as read */}
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

// ── Main Navbar ───────────────────────────────────────────────────────────────

const Navbar: React.FC<NavbarProps> = ({
                                           username,
                                           onLogout,
                                           notifications = [],
                                           onMarkRead = () => {},
                                       }) => {
    const navigate  = useNavigate();
    const location  = useLocation();
    const { t }     = useI18n();

    const [panelOpen, setPanelOpen] = useState(false);

    const unreadCount  = notifications.filter((n) => !n.read).length;

    const goHome       = () => navigate("/home");
    const goGameSelect = () => navigate("/select-difficulty", { state: { username } });

    const handleMarkRead = (id: string) => {
        onMarkRead(id);
        // Optimistic: el padre actualiza el estado vía el callback.
    };

    return (
        <header className="navbar">
            <div className="navbar__inner">

                {/* ── Left zone ──────────────────────────────────────────────────── */}
                <div className="navbar__left">
                    <button
                        className="navbar__brand"
                        onClick={goHome}
                        type="button"
                        aria-label="Ir a Home"
                    >
                        <img src={logo} alt="GameY" className="navbar__logo" />
                    </button>

                    <div className="navbar__divider" aria-hidden="true" />

                    <nav className="navbar__actions" aria-label="Navegación principal">
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
                            aria-current={location.pathname === "/game" ? "page" : undefined}
                            onClick={goGameSelect}
                        >
                            {t("common.game")}
                        </button>

                        <button
                            type="button"
                            className="navbtn"
                            aria-current={
                                location.pathname === "/statistics" ? "page" : undefined
                            }
                            onClick={() => navigate("/statistics")}
                        >
                            {t("common.stats")}
                        </button>

                        <button
                            type="button"
                            className="navbtn"
                            aria-current={
                                location.pathname === "/social" ? "page" : undefined
                            }
                            onClick={() => navigate("/social")}
                        >
                            {t("common.social")}
                        </button>
                    </nav>
                </div>

                {/* ── Right zone ─────────────────────────────────────────────────── */}
                <div className="navbar__right">

                    {/* Notification bell */}
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
                                className={unreadCount > 0 ? "navbar__notif-bell--active" : undefined}
                            >
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>

                            {/* Unread badge */}
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
                                onMarkRead={handleMarkRead}
                                onClose={() => setPanelOpen(false)}
                                t={t}
                            />
                        )}
                    </div>

                    {/* User profile */}
                    <button
                        type="button"
                        className="navbar__user navbar__user--link"
                        onClick={() => username && navigate(`/profile/${username}`)}
                        aria-label={`Ver perfil de ${username}`}
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