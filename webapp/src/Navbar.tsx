import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

type NavbarProps = {
  username?: string | null;
  onLogout?: () => void;
};

const Navbar: React.FC<NavbarProps> = ({ username, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const goHome = () => navigate("/home", { state: { username } });
  const goGameSelect = () => navigate("/select-difficulty", { state: { username } });
  const goMultiplayer = () => navigate("/multiplayer", { state: { username } });
  const goStatistics = () => navigate("/statistics", { state: { username } });
  const goSocial = () => navigate("/social", { state: { username } });

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
            <img src={logo} alt="GameY" className="navbar__logo" />
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
              aria-current={
                location.pathname === "/game" || location.pathname === "/select-difficulty"
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
              aria-current={location.pathname.startsWith("/multiplayer") ? "page" : undefined}
              onClick={goMultiplayer}
            >
              {t("common.multiplayer")}
            </button>

            <button
              type="button"
              className="navbtn"
              aria-current={location.pathname === "/statistics" ? "page" : undefined}
              onClick={goStatistics}
            >
              {t("common.stats")}
            </button>

            <button
              type="button"
              className="navbtn"
              aria-current={location.pathname === "/social" ? "page" : undefined}
              onClick={goSocial}
            >
              {t("common.social")}
            </button>
          </nav>
        </div>

        <div className="navbar__right">
          <button
            type="button"
            className="navbar__user navbar__user--link"
            onClick={() => username && navigate(`/profile/${username}`, { state: { username } })}
            aria-label={`View profile of ${username}`}
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