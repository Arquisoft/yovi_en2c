import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";
import LanguageToggle from "./LanguageToggle.tsx";

type NavbarProps = {
  username?: string | null;
  onLogout?: () => void;
  title?: string;
};

const Navbar: React.FC<NavbarProps> = ({ username, onLogout, title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const go = (path: string) => navigate(path, { state: { username } });

  return (
      <>
        <header className="site-header">
          <div className="site-header__inner">
            <button
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                onClick={() => go("/home")}
                aria-label="Go home"
            >
              <img src={logo} alt="GameY" className="site-header__logo" />
            </button>

            <span className="site-header__title">
            {title ?? t("app.brand")}
          </span>

            {username && (
                <span className="nav-user" title={username}>
              👤 {username}
            </span>
            )}

            <LanguageToggle />

            <nav className="site-header__nav" aria-label="Main navigation">
              <button
                  className={`nav-link${location.pathname === "/home" ? " nav-link--active" : ""}`}
                  onClick={() => go("/home")}
                  type="button"
              >
                {t("common.home")}
              </button>
              <button
                  className={`nav-link${location.pathname.startsWith("/game") ? " nav-link--active" : ""}`}
                  onClick={() => go("/game")}
                  type="button"
              >
                {t("common.game")}
              </button>
              <button
                  className={`nav-link${location.pathname === "/stats" ? " nav-link--active" : ""}`}
                  onClick={() => go("/stats")}
                  type="button"
              >
                {t("common.stats") ?? "Stats"}
              </button>
              <button
                  className="nav-link nav-link--exit"
                  onClick={onLogout}
                  type="button"
              >
                {t("common.logout")}
              </button>
            </nav>
          </div>
        </header>
        <div className="site-header__ribbon" aria-hidden="true" />
      </>
  );
};

export default Navbar;
