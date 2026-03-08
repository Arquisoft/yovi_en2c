import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";
import LanguageToggle from "./LanguageToggle";

const RegistrationForm: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [responseMessage, setResponseMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setResponseMessage(null);
    setError(null);

    if (!username.trim()) {
      setError(t("registration.error.username"));
      return;
    }

    if (!password.trim()) {
      setError(t("registration.error.password"));
      return;
    }

    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

      const res = await fetch(`${API_URL}/createuser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: email.trim() || undefined,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResponseMessage(data.message);
        navigate("/", { replace: true });
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
    <div className="auth-wrapper">
      <form onSubmit={handleSubmit} className="register-form" aria-label={t("registration.aria")}>
        <div className="register-toprow">
          <img src={logo} alt="GameY" className="logo" />
          <LanguageToggle />
        </div>

        <div className="form-group">
          <label htmlFor="register-username">{t("registration.username")}</label>
          <input
            type="text"
            id="register-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="form-input"
            placeholder={t("registration.username")}
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-email">{t("registration.email")}</label>
          <input
            type="email"
            id="register-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            placeholder={t("registration.email")}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="register-password">{t("registration.password")}</label>
          <input
            type="password"
            id="register-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
            placeholder={t("registration.password")}
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? t("registration.loading") : t("registration.button")}
        </button>

        <div style={{ marginTop: 12, textAlign: "center" }}>
          <Link to="/">{t("registration.goLogin")}</Link>
        </div>

        {responseMessage && (
          <div className="success-message" style={{ marginTop: 8 }}>
            {responseMessage}
          </div>
        )}

        {error && (
          <div className="error-message" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default RegistrationForm;