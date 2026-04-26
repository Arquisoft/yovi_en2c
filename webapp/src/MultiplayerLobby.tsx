import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";

type LocationState = { username?: string };

const PRESET_SIZES = [5, 7, 9, 11];

const MultiplayerLobby: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const username = useMemo(() => {
    const st = (location.state as LocationState | null) ?? null;
    return st?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  const [mode, setMode] = useState<"create" | "join">("create");
  const [presetSize, setPresetSize] = useState<number>(7);
  const [customSize, setCustomSize] = useState<string>("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) {
      navigate("/", { replace: true });
    }
  }, [username, navigate]);

  const boardSize =
    customSize.trim() !== "" ? Number.parseInt(customSize, 10) : presetSize;

  const createRoom = async () => {
    setLoading(true);
    setError("");
    setCreatedCode("");

    try {
      const res = await fetch("/api/multiplayer/room/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          size: boardSize
        })
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error || t("multiplayer.error.create"));
        return;
      }

      const code = data.room?.code ?? "";
      setCreatedCode(code);

      navigate("/multiplayer/game", {
        state: {
          username,
          roomCode: code,
          boardSize,
          isHost: true
        }
      });
    } catch {
      setError(t("multiplayer.error.network"));
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    setLoading(true);
    setError("");

    try {
      const normalizedCode = roomCode.trim().toUpperCase();

      const res = await fetch("/api/multiplayer/room/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: normalizedCode,
          username
        })
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error || t("multiplayer.error.join"));
        return;
      }

      navigate("/multiplayer/game", {
        state: {
          username,
          roomCode: normalizedCode,
          boardSize: data.room?.size ?? 7,
          isHost: false
        }
      });
    } catch {
      setError(t("multiplayer.error.network"));
    } finally {
      setLoading(false);
    }
  };

  if (!username) return null;

  return (
    <div className="page">
      <Navbar username={username} />

      <main className="container">
        <section className="hero">
          <h1 className="hero__title">{t("multiplayer.title")}</h1>
          <p className="hero__subtitle">{t("multiplayer.subtitle")}</p>

          <div className="hero__actions">
            <button
              type="button"
              className={`btn ${mode === "create" ? "btn--primary" : "btn--ghost"}`}
              onClick={() => {
                setMode("create");
                setError("");
              }}
            >
              {t("multiplayer.create")}
            </button>

            <button
              type="button"
              className={`btn ${mode === "join" ? "btn--primary" : "btn--ghost"}`}
              onClick={() => {
                setMode("join");
                setError("");
              }}
            >
              {t("multiplayer.join")}
            </button>
          </div>
        </section>

        <section className="grid" aria-label="Multiplayer lobby">
          {mode === "create" ? (
            <article className="card">
              <h2 className="card__title">{t("multiplayer.createTitle")}</h2>
              <p className="card__text">{t("multiplayer.createText")}</p>

              <div className="mp-form-group">
                <label className="mp-label">{t("boardsize.title")}</label>

                <div className="mp-size-row">
                  {PRESET_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`btn ${customSize === "" && presetSize === size ? "btn--primary" : "btn--ghost"}`}
                      onClick={() => {
                        setPresetSize(size);
                        setCustomSize("");
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <input
                  className="form-input"
                  type="number"
                  min={3}
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  placeholder={t("boardsize.custom.placeholder")}
                />
              </div>

              <div className="mp-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={createRoom}
                  disabled={loading || !boardSize || Number.isNaN(boardSize) || boardSize < 3}
                >
                  {loading ? t("multiplayer.creating") : t("multiplayer.createRoom")}
                </button>
              </div>

              {createdCode ? (
                <p className="success-message">
                  {t("multiplayer.roomCode")}: <strong>{createdCode}</strong>
                </p>
              ) : null}

              {error ? <p className="error-message">{error}</p> : null}
            </article>
          ) : (
            <article className="card">
              <h2 className="card__title">{t("multiplayer.joinTitle")}</h2>
              <p className="card__text">{t("multiplayer.joinText")}</p>

              <div className="mp-form-group">
                <label className="mp-label">{t("multiplayer.roomCode")}</label>
                <input
                  className="form-input"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder={t("multiplayer.roomCodePlaceholder")}
                  maxLength={6}
                />
              </div>

              <div className="mp-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={joinRoom}
                  disabled={loading || roomCode.trim().length < 4}
                >
                  {loading ? t("multiplayer.joining") : t("multiplayer.joinRoom")}
                </button>
              </div>

              {error ? <p className="error-message">{error}</p> : null}
            </article>
          )}

          <article className="card">
            <h2 className="card__title">{t("multiplayer.howItWorksTitle")}</h2>
            <p className="card__text">{t("multiplayer.howItWorksText")}</p>
            <span className="pill">{t("multiplayer.howItWorksPill")}</span>
          </article>

          <article className="card">
            <h2 className="card__title">{t("multiplayer.keepFeaturesTitle")}</h2>
            <p className="card__text">{t("multiplayer.keepFeaturesText")}</p>
            <span className="pill">{t("multiplayer.keepFeaturesPill")}</span>
          </article>
        </section>
      </main>
    </div>
  );
};

export default MultiplayerLobby;