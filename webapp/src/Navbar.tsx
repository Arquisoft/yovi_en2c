import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";
import LanguageToggle from "./LanguageToggle";

type NavbarProps = {
  username?: string | null;
  onLogout?: () => void;
};

const Navbar: React.FC<NavbarProps> = ({ username, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const goHome = () => navigate("/home");
  const goGame = () => navigate("/game", { state: { username } });

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <button
          className="navbar__brand"
          onClick={goHome}
          type="button"
          aria-label="Ir a Home"
        >
          <img src={logo} alt="GameY" className="navbar__logo" />
        </button>

        <div className="navbar__right">
          <div className="navbar__user" aria-label="Usuario actual">
            👤 {t("common.user")}: {username || "—"}
          </div>

          <LanguageToggle />

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
              onClick={goGame}
            >
              {t("common.game")}
            </button>

            <button
              type="button"
              className="navbtn navbtn--danger"
              onClick={() => onLogout?.()}
            >
              {t("common.logout")}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navbar;