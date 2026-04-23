import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.tsx";
import { useI18n } from "./i18n/I18nProvider";

type Mode = "bot" | "player" | null;
type BotId = "random_bot" | "heuristic_bot" | "minimax_bot" | "alfa_beta_bot" | "monte_carlo_hard" | "monte_carlo_extreme";

const BOT_OPTIONS: { value: BotId; labelKey: string }[] = [
  { value: "random_bot",         labelKey: "game.bot.random"    },
  { value: "heuristic_bot",      labelKey: "game.bot.heuristic"},
  { value: "minimax_bot",        labelKey: "game.bot.minimax"   },
  { value: "alfa_beta_bot",      labelKey: "game.bot.alfabeta"  },
  { value: "monte_carlo_hard",   labelKey: "game.bot.mcHard"    },
  { value: "monte_carlo_extreme",labelKey: "game.bot.mcExtreme" },
];

const BOARD_SIZES = [5, 7, 9, 11];

const Home: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { t }     = useI18n();

  const username = useMemo(() => {
    const st = (location.state as { username?: string } | null) ?? null;
    return st?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  const [mode,      setMode]      = useState<Mode>(null);
  const [botId,     setBotId]     = useState<BotId>("random_bot");
  const [boardSize, setBoardSize] = useState<number>(7);

  const logout = () => {
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  };

  const handlePlay = () => {
    if (!mode) return;
    navigate("/game", {
      state: {
        username,
        mode,
        botId:     mode === "bot" ? botId : undefined,
        boardSize,
      },
    });
  };

  const selectMode = (m: Mode) => setMode(prev => (prev === m ? null : m));

  if (!username) return null;

  return (
      <div className="page" style={{ padding: "20px", minHeight: "100vh", background: "var(--bg)" }}>
        <Navbar username={username} onLogout={logout} />

        <main className="page-main" style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>

          {/* Welcome Banner */}
          <div style={{
            textAlign: "center",
            padding: "20px 16px",
            background: "var(--surface)",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            width: "100%",
          }}>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: "var(--accent)", margin: 0 }}>
              {t("home.welcome")} <span style={{ color: "#ff3b3b" }}>{username}</span>!
            </h1>
            <p style={{ fontSize: 16, color: "#555", marginTop: 6 }}>
              {t("home.chooseOpponent")}
            </p>
          </div>

          {/* Play Options (Bot / Player) */}
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
              <button
                  type="button"
                  data-testid="bot-card"
                  className={`play-card${mode === "bot" ? " is-selected" : ""}`}
                  onClick={() => selectMode("bot")}
                style={{
                  flex: "1 1 250px",
                  padding: "36px 24px",
                  fontSize: 28,
                  minHeight: 200,
                  borderRadius: 16,
                  transition: "transform .2s, box-shadow .2s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-6px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <div style={{ fontSize: 64 }}>🤖</div>
              <span style={{ fontSize: 20 }}>{t("home.card.bots")}</span>
            </button>

            <button
                type="button"
                data-testid="player-card"
                className={`play-card${mode === "player" ? " is-selected" : ""}`}
                onClick={() => selectMode("player")}
                style={{
                  flex: "1 1 250px",
                  padding: "36px 24px",
                  fontSize: 28,
                  minHeight: 200,
                  borderRadius: 16,
                  transition: "transform .2s, box-shadow .2s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-6px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <div style={{ fontSize: 64 }}>👥</div>
              <span style={{ fontSize: 20 }}>{t("home.card.players")}</span>
            </button>
          </div>

          {/* Config panel — ABOVE instructions */}
          {mode && (
              <div style={{
                background: "var(--surface)",
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                padding: 24,
                width: "100%",
                maxWidth: 700,
                display: "flex",
                flexDirection: "column",
                gap: 20
              }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--accent)", margin: 0 }}>
                  {mode === "bot"
                      ? t("home.config.botTitle")
                      : t("home.config.playerTitle")}
                </h2>

                {/* Bot selector — only for bot mode */}
                {mode === "bot" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ fontWeight: 700, fontSize: 14 }}>{t("home.config.bot")}</label>
                      <select
                          value={botId}
                          onChange={e => setBotId(e.target.value as BotId)}
                          style={{
                            padding: "10px 12px",
                            fontSize: 16,
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--surface2)",
                          }}
                      >
                        {BOT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {t(opt.labelKey)}
                            </option>
                        ))}
                      </select>
                    </div>
                )}

                {/* Board size — both modes */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontWeight: 700, fontSize: 14 }}>{t("home.config.boardSize")}</label>
                  <select
                      value={boardSize}
                      onChange={e => setBoardSize(Number(e.target.value))}
                      style={{
                        padding: "10px 12px",
                        fontSize: 16,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface2)",
                      }}
                  >
                    {BOARD_SIZES.map(s => (
                        <option key={s} value={s}>{s}×{s}</option>
                    ))}
                  </select>
                </div>

                <button
                    type="button"
                    onClick={handlePlay}
                    style={{
                      marginTop: 10,
                      padding: "14px 0",
                      fontSize: 18,
                      fontWeight: 700,
                      borderRadius: 10,
                      background: "var(--ok)",
                      color: "#fff",
                      cursor: "pointer",
                      transition: "transform .2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-3px)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
                >
                  {t("home.start")}
                </button>
              </div>
          )}

          {/* Instructions / Tips — now below settings */}
          <div style={{
            background: "var(--surface)",
            border: "2px solid var(--border)",
            borderRadius: 12,
            padding: 20,
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            width: "100%",
            maxWidth: 700
          }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--accent)", marginBottom: 12 }}>
              {t("home.instructions.title")}
            </h2>
            <p style={{ fontSize: 16, color: "#555", margin: 0 }}>
              {t("home.instructions.description")}
            </p>
          </div>

        </main>
      </div>
  );
};

export default Home;