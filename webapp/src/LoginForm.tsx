import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import logo from "../img/logo.png";
import LanguageToggle from "./LanguageToggle";

const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [responseMessage, setResponseMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setResponseMessage(null);
    setError(null);

    if (!username.trim()) {
      setError(t("login.error.username"));
      return;
    }

    if (!password.trim()) {
      setError(t("login.error.password"));
      return;
    }

    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResponseMessage(data.message);
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
    <div className="auth-wrapper">
      <form onSubmit={handleSubmit} className="register-form" aria-label={t("login.aria")}>
        <div className="register-toprow">
          <img src={logo} alt="GameY" className="logo" />
          <LanguageToggle />
        </div>

        <div className="form-group">
          <label htmlFor="login-username">{t("login.username")}</label>
          <input
            type="text"
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="form-input"
            placeholder={t("login.username")}
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="login-password">{t("login.password")}</label>
          <input
            type="password"
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
            placeholder={t("login.password")}
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? t("login.loading") : t("login.button")}
        </button>

        <div style={{ marginTop: 12, textAlign: "center" }}>
          <Link to="/register">{t("login.goRegister")}</Link>
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

export default LoginForm;