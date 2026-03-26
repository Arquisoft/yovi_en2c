import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.tsx";
import { useI18n } from "./i18n/I18nProvider";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

type GameEntry = {
  _id: string;
  username: string;
  opponent: string;
  result: "win" | "loss";
  score: number;
  date: string;
};

type StatsData = {
  username: string;
  stats: { wins: number; losses: number };
  total: number;
  games: GameEntry[];
};

const Stats: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const username = useMemo(() => {
    const st = (location.state as { username?: string } | null) ?? null;
    return st?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/history/${encodeURIComponent(username)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json);
        } else {
          setError(json.error ?? "Failed to load history");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [username]);

  const logout = () => {
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  };

  if (!username) return null;

  const winRate =
    data && data.total > 0
      ? Math.round((data.stats.wins / data.total) * 100)
      : 0;

  return (
    <div className="page">
      <Navbar username={username} onLogout={logout} />

      <main className="page-main">
        <h1 className="play-section-title">
          {t("stats.title") ?? "STATISTICS"}
        </h1>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
            <span style={{ fontSize: 32 }}>⏳</span>
            <p style={{ fontWeight: 700, marginTop: 8 }}>
              {t("stats.loading") ?? "Loading your history…"}
            </p>
          </div>
        )}

        {error && (
          <p className="msg msg--error" style={{ textAlign: "center" }}>
            {error}
          </p>
        )}

        {!loading && !error && data && (
          <>
            {/* Summary cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 14,
                marginBottom: 28,
              }}
            >
              <StatCard
                emoji="🎮"
                label={t("stats.played") ?? "Played"}
                value={data.total}
                color="var(--text)"
              />
              <StatCard
                emoji="🏆"
                label={t("stats.wins") ?? "Wins"}
                value={data.stats.wins}
                color="var(--ok)"
              />
              <StatCard
                emoji="💀"
                label={t("stats.losses") ?? "Losses"}
                value={data.stats.losses}
                color="var(--danger)"
              />
              <StatCard
                emoji="📈"
                label={t("stats.winRate") ?? "Win Rate"}
                value={`${winRate}%`}
                color={winRate >= 50 ? "var(--ok)" : "var(--danger)"}
              />
            </div>

            {/* Win-rate bar */}
            {data.total > 0 && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "2px solid var(--border)",
                  borderRadius: "var(--r)",
                  padding: "18px 20px",
                  marginBottom: 24,
                  boxShadow: "var(--shadow)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: ".5px",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  <span>🏆 {t("stats.wins") ?? "Wins"}</span>
                  <span>{t("stats.losses") ?? "Losses"} 💀</span>
                </div>
                <div
                  style={{
                    height: 16,
                    background: "var(--danger)",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "2px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${winRate}%`,
                      background: "var(--ok)",
                      transition: "width .6s ease",
                      borderRadius: winRate === 100 ? 8 : "8px 0 0 8px",
                    }}
                  />
                </div>
              </div>
            )}

            {/* History table */}
            <div
              style={{
                background: "var(--surface)",
                border: "2px solid var(--border)",
                borderRadius: "var(--r)",
                overflow: "hidden",
                boxShadow: "var(--shadow)",
              }}
            >
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "2px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 18,
                    letterSpacing: 1.5,
                    color: "var(--muted)",
                  }}
                >
                  {t("stats.history") ?? "MATCH HISTORY"}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--muted)",
                    background: "var(--surface2)",
                    border: "1px solid var(--border2)",
                    borderRadius: 6,
                    padding: "3px 8px",
                  }}
                >
                  {data.total} {t("stats.games") ?? "games"}
                </span>
              </div>

              {data.games.length === 0 ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "var(--muted)",
                    fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: 40 }}>🎯</span>
                  <p style={{ marginTop: 8 }}>
                    {t("stats.noGames") ?? "No games played yet. Start playing!"}
                  </p>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ marginTop: 14 }}
                    onClick={() => navigate("/home", { state: { username } })}
                  >
                    {t("home.start") ?? "PLAY"}
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "var(--surface2)",
                          borderBottom: "2px solid var(--border)",
                        }}
                      >
                        {[
                          t("stats.col.result") ?? "Result",
                          t("stats.col.opponent") ?? "Opponent",
                          t("stats.col.date") ?? "Date",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "10px 16px",
                              textAlign: "left",
                              fontWeight: 700,
                              fontSize: 11,
                              letterSpacing: 1,
                              textTransform: "uppercase",
                              color: "var(--muted)",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.games.map((game, i) => (
                        <tr
                          key={game._id}
                          style={{
                            borderBottom:
                              i < data.games.length - 1
                                ? "1px solid var(--border2)"
                                : "none",
                            background:
                              i % 2 === 0 ? "transparent" : "var(--surface2)",
                          }}
                        >
                          <td style={{ padding: "12px 16px" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontWeight: 700,
                                fontSize: 13,
                                color:
                                  game.result === "win"
                                    ? "var(--ok)"
                                    : "var(--danger)",
                              }}
                            >
                              {game.result === "win" ? "🏆" : "💀"}
                              {game.result === "win"
                                ? (t("stats.win") ?? "WIN")
                                : (t("stats.loss") ?? "LOSS")}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontWeight: 600,
                              color: "var(--text)",
                            }}
                          >
                            {game.opponent}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              color: "var(--muted)",
                              fontSize: 13,
                            }}
                          >
                            {new Date(game.date).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

const StatCard: React.FC<{
  emoji: string;
  label: string;
  value: string | number;
  color: string;
}> = ({ emoji, label, value, color }) => (
  <div
    style={{
      background: "var(--surface)",
      border: "2px solid var(--border)",
      borderRadius: "var(--r)",
      padding: "18px 16px",
      textAlign: "center",
      boxShadow: "var(--shadow)",
    }}
  >
    <div style={{ fontSize: 28, marginBottom: 4 }}>{emoji}</div>
    <div
      style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 32,
        letterSpacing: 1,
        color,
        lineHeight: 1,
        marginBottom: 4,
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "var(--muted)",
      }}
    >
      {label}
    </div>
  </div>
);

export default Stats;
