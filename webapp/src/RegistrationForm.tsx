import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";
import LanguageToggle from "./LanguageToggle.tsx";

const API_URL = import.meta.env.VITE_API_URL ?? "/api"; // <-- use relative

const RegistrationForm: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [success,  setSuccess]  = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!username.trim()) { setError(t("registration.error.username")); return; }
    if (!password.trim()) { setError(t("registration.error.password")); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/createuser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email: email.trim() || undefined, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(data.message);
        setTimeout(() => navigate("/", { replace: true }), 1000);
      } else {
        setError(data.error || t("registration.error.generic"));
      }
    } catch (err: any) {
      setError(err.message || t("registration.error.network"));
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="auth-page">
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

            <h1 className="auth-card__heading">{t("registration.heading") ?? "REGISTER"}</h1>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="register-username">{t("registration.username")}</label>
                <input
                    id="register-username"
                    type="text"
                    className="form-input"
                    placeholder={t("registration.username")}
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                />

              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="register-email">{t("registration.email")}</label>
                <input
                    id="register-email"
                    type="email"
                    className="form-input"
                    placeholder={t("registration.email")}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="register-password">{t("registration.password")}</label>
                <input
                    id="register-password"
                    type="password"
                    className="form-input"
                    placeholder={t("registration.password")}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                />
              </div>

              <div style={{ marginBottom: 14, textAlign: "right" }}>
                <button type="button" className="text-link" onClick={() => navigate("/")}>
                  {t("registration.goLogin")}
                </button>
              </div>

              <button
                  type="submit"
                  className="btn btn--primary btn--full btn--lg submit-button"
                  disabled={loading}
              >
                {loading ? t("registration.loading") : t("registration.button")}
              </button>

              {success && <p className="msg msg--ok">{success}</p>}
              {error   && <p className="msg msg--error">{error}</p>}
            </form>
          </div>
        </div>
      </div>
  );
};

export default RegistrationForm;
