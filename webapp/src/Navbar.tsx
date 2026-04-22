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

  const goHome = () => navigate("/home");
  const goGameSelect = () => navigate("/select-difficulty", { state: { username } });

  return (
      <header className="navbar">
        <div className="navbar__inner">

          {/* Left zone: brand + navigation links */}
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
                  aria-current={location.pathname === "/statistics" ? "page" : undefined}
                  onClick={() => navigate("/statistics")}
              >
                {t("common.stats")}
              </button>

              <button
                  type="button"
                  className="navbtn"
                  aria-current={location.pathname === "/social" ? "page" : undefined}
                  onClick={() => navigate("/social")}
              >
                {t("common.social")}
              </button>
            </nav>
          </div>

          {/* Right zone: user account actions */}
          <div className="navbar__right">
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