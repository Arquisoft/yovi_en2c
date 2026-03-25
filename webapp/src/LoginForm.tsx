import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";
import LanguageToggle from "./LanguageToggle.tsx";
const API_URL = import.meta.env.VITE_API_URL ?? "/api"; // <-- use relative

const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) { setError(t("login.error.username")); return; }
    if (!password.trim()) { setError(t("login.error.password")); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem("username", username);
        navigate("/home", { state: { username } });
      } else {
        setError(data.error || t("login.error.invalid"));
      }
    } catch (err: any) {
      setError(err.message || t("login.error.network"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Minimal top bar without nav links */}
      <header className="site-header">
        <div className="site-header__inner">
          <img src={logo} alt="GameY" className="site-header__logo" />
          <span className="site-header__title">{t("app.brand")}</span>
          <LanguageToggle />
        </div>
      </header>
      <div className="site-header__ribbon" aria-hidden="true" />

      <div className="auth-body">
        <div className="auth-card">
          <div className="auth-card__top">
            <img src={logo} alt="GameY" className="auth-card__logo" />
            <LanguageToggle />
          </div>

          <h1 className="auth-card__heading">{t("login.heading") ?? "LOGIN"}</h1>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="login-user">{t("login.username")}</label>
              <input
                id="login-user"
                type="text"
                className="form-input"
                placeholder={t("login.username")}
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-pw">{t("login.password")}</label>
              <input
                id="login-pw"
                type="password"
                className="form-input"
                placeholder={t("login.password")}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div style={{ marginBottom: 14, textAlign: "right" }}>
              <button
                type="button"
                className="text-link"
                onClick={() => navigate("/register")}
              >
                {t("login.goRegister")}
              </button>
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--full btn--lg"
              disabled={loading}
            >
              {loading ? t("login.loading") : t("login.button")}
            </button>

            {error && <p className="msg msg--error">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
