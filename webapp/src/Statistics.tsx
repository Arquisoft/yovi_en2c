import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type GameEntry = {
    opponent: string;
    result: "win" | "loss";
    boardSize: number;
    gameMode: "pvb" | "pvp";
    date: string;
};

type StatsData = {
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
    pvbGames: number;
    pvpGames: number;
    lastFive: GameEntry[];
};

const PAGE_SIZE = 10;

// ── Bot ID → i18n label mapping ───────────────────────────────────────────────
const BOT_LABEL_KEYS: Record<string, string> = {
    heuristic_bot:       "difficulty.easy",
    minimax_bot:         "difficulty.medium",
    alfa_beta_bot:       "difficulty.hard",
    monte_carlo_hard:    "difficulty.expert",
    monte_carlo_extreme: "difficulty.extreme",
    random_bot:          "difficulty.random",
};

// ── Sub-components ────────────────────────────────────────────────────────────

type StatCardProps = { label: string; value: string | number; color: string };

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => (
    <div style={{
        flex: "1 1 130px", border: "1px solid var(--stroke)",
        background: "var(--panel)", borderRadius: "var(--r)",
        padding: "18px", boxShadow: "var(--shadow)", textAlign: "center",
    }}>
        <p style={{ margin: "0 0 6px", fontSize: "clamp(28px,4vw,40px)", fontWeight: 900, color }}>
            {value}
        </p>
        <p style={{ margin: 0, color: "var(--muted)", fontWeight: 700, fontSize: "0.88rem" }}>
            {label}
        </p>
    </div>
);

type WinRateBarProps = { winRate: number; labelWin: string; labelLoss: string };

const WinRateBar: React.FC<WinRateBarProps> = ({ winRate, labelWin, labelLoss }) => (
    <div style={{ marginTop: 8 }}>
        <progress
            value={winRate}
            max={100}
            style={{
                width: "100%", height: 12,
                borderRadius: 999, overflow: "hidden",
                appearance: "none", border: "none",
                background: "rgba(255,255,255,.10)",
                accentColor: "var(--aqua)",
            }}
            aria-label={`${labelWin}: ${winRate}%`}
        />
        <div style={{ display: "flex", justifyContent: "space-between",
            marginTop: 6, fontSize: "0.82rem", color: "var(--muted)" }}>
            <span>{labelWin}: {winRate}%</span>
            <span>{labelLoss}: {100 - winRate}%</span>
        </div>
    </div>
);

type GameRowProps = { game: GameEntry; labelWin: string; labelLoss: string; opponentLabel: string };

const GameRow: React.FC<GameRowProps> = ({ game, labelWin, labelLoss, opponentLabel }) => {
    const isWin = game.result === "win";
    return (
        <tr style={{ borderBottom: "1px solid var(--stroke)" }}>
            <td style={{ padding: "10px 8px", fontWeight: 700 }}>{opponentLabel}</td>
            <td style={{ padding: "10px 8px", textAlign: "center" }}>
                <span style={{
                    padding: "3px 10px", borderRadius: 999, fontWeight: 900, fontSize: "0.82rem",
                    background: isWin ? "rgba(32,201,151,.18)" : "rgba(255,77,77,.18)",
                    color: isWin ? "var(--ok)" : "var(--danger)",
                    border: `1px solid ${isWin ? "rgba(32,201,151,.40)" : "rgba(255,77,77,.40)"}`,
                }}>
                    {isWin ? labelWin : labelLoss}
                </span>
            </td>
            <td style={{ padding: "10px 8px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                {game.boardSize}×{game.boardSize}
            </td>
            <td style={{ padding: "10px 8px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                {game.gameMode.toUpperCase()}
            </td>
            <td style={{ padding: "10px 8px", textAlign: "right", color: "var(--muted)", fontSize: "0.82rem" }}>
                {new Date(game.date).toLocaleDateString()}
            </td>
        </tr>
    );
};

// ── Pagination controls ───────────────────────────────────────────────────────

type PaginationProps = {
    page: number;
    totalPages: number;
    onPrev: () => void;
    onNext: () => void;
    label: string;
};

const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPrev, onNext, label }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        gap: 16, marginTop: 14 }}>
        <button type="button" className="btn btn--primary"
                onClick={onPrev} disabled={page <= 1}
                aria-label="Previous page">
            ←
        </button>
        <span style={{ color: "var(--muted)", fontSize: "0.9rem", fontWeight: 700 }}>
            {label}
        </span>
        <button type="button" className="btn btn--primary"
                onClick={onNext} disabled={page >= totalPages}
                aria-label="Next page">
            →
        </button>
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const Statistics: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useI18n();

    const username = useMemo(() => localStorage.getItem("username") ?? "", []);
    const token    = useMemo(() => localStorage.getItem("token") ?? "", []);

    const [stats,      setStats]      = useState<StatsData | null>(null);
    const [games,      setGames]      = useState<GameEntry[]>([]);
    const [page,       setPage]       = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState<string | null>(null);

    const getOpponentLabel = useCallback((opponent: string, gameMode: "pvb" | "pvp"): string => {
        if (gameMode === "pvp") return opponent;
        const key = BOT_LABEL_KEYS[opponent];
        return key ? `Bot - ${t(key)}` : opponent;
    }, [t]);

    const fetchStats = useCallback(async (targetPage: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/stats/${username}?page=${targetPage}&pageSize=${PAGE_SIZE}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error ?? t("stats.error.generic"));
            } else {
                setStats(data.stats);
                setGames(data.games ?? []);
                setPage(targetPage);
                setTotalPages(
                    data.stats.totalGames > 0
                        ? Math.ceil(data.stats.totalGames / PAGE_SIZE)
                        : 1
                );
            }
        } catch {
            setError(t("stats.error.network"));
        } finally {
            setLoading(false);
        }
    }, [username, token, t]);

    useEffect(() => {
        if (!username || !token) {
            navigate("/", { replace: true });
            return;
        }
        fetchStats(1);

    }, [username, token, navigate]);

    const handlePrev = () => fetchStats(page - 1);
    const handleNext = () => fetchStats(page + 1);

    // ── Render ────────────────────────────────────────────────────────────────

    const renderBody = () => {
        if (loading) return (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
                <p style={{ fontSize: "1.1rem" }}>{t("stats.loading")}</p>
            </div>
        );

        if (error) return (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
                <p style={{ color: "var(--danger)", fontWeight: 800 }}>{error}</p>
                <button type="button" className="btn btn--primary"
                        onClick={() => fetchStats(1)} style={{ marginTop: 16 }}>
                    {t("stats.retry")}
                </button>
            </div>
        );

        if (!stats || stats.totalGames === 0) return (
            <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
                <p style={{ fontSize: "2.4rem", margin: "0 0 12px" }}>🎮</p>
                <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>{t("stats.empty")}</p>
                <button type="button" className="btn btn--primary"
                        onClick={() => navigate("/select-difficulty")}>
                    {t("stats.playFirst")}
                </button>
            </div>
        );

        return (
            <>
                {/* Summary cards */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <StatCard label={t("stats.totalGames")} value={stats.totalGames}     color="var(--aqua)"   />
                    <StatCard label={t("stats.wins")}       value={stats.wins}           color="var(--ok)"     />
                    <StatCard label={t("stats.losses")}     value={stats.losses}         color="var(--danger)" />
                    <StatCard label={t("stats.winRate")}    value={`${stats.winRate}%`}  color="var(--amber)"  />
                </div>

                {/* Win rate bar */}
                <div className="card">
                    <h2 className="card__title">{t("stats.winRateBar")}</h2>
                    <WinRateBar winRate={stats.winRate}
                                labelWin={t("stats.wins")} labelLoss={t("stats.losses")} />
                </div>

                {/* Game mode breakdown */}
                <div className="card">
                    <h2 className="card__title">{t("stats.gameMode")}</h2>
                    <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 120px", textAlign: "center" }}>
                            <p style={{ margin: "0 0 4px", fontWeight: 900, fontSize: "1.6rem", color: "var(--aqua)" }}>
                                {stats.pvbGames}
                            </p>
                            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>{t("stats.pvb")}</p>
                        </div>
                        <div style={{ flex: "1 1 120px", textAlign: "center" }}>
                            <p style={{ margin: "0 0 4px", fontWeight: 900, fontSize: "1.6rem", color: "var(--violet)" }}>
                                {stats.pvpGames}
                            </p>
                            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>{t("stats.pvp")}</p>
                        </div>
                    </div>
                </div>

                {/* Paginated match history */}
                {games.length > 0 && (
                    <div className="card" style={{ overflowX: "auto" }}>
                        <h2 className="card__title">{t("stats.history")}</h2>
                        <table style={{ width: "100%", borderCollapse: "collapse",
                            marginTop: 10, fontSize: "0.9rem" }}>
                            <thead>
                            <tr style={{ borderBottom: "1px solid var(--stroke)",
                                color: "var(--muted)", fontSize: "0.8rem" }}>
                                <th style={{ padding: "8px", textAlign: "left",   fontWeight: 700 }}>{t("stats.opponent")}</th>
                                <th style={{ padding: "8px", textAlign: "center", fontWeight: 700 }}>{t("stats.result")}</th>
                                <th style={{ padding: "8px", textAlign: "center", fontWeight: 700 }}>{t("stats.board")}</th>
                                <th style={{ padding: "8px", textAlign: "center", fontWeight: 700 }}>{t("stats.mode")}</th>
                                <th style={{ padding: "8px", textAlign: "right",  fontWeight: 700 }}>{t("stats.date")}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {games.map((game) => (
                                <GameRow key={`${game.opponent}-${game.date}`} game={game}
                                         labelWin={t("stats.win")} labelLoss={t("stats.loss")}
                                         opponentLabel={getOpponentLabel(game.opponent, game.gameMode)} />
                            ))}
                            </tbody>
                        </table>

                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            onPrev={handlePrev}
                            onNext={handleNext}
                            label={t("stats.page", { page: String(page), total: String(totalPages) })}
                        />
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="page">
            <Navbar username={username} />
            <main className="container" style={{ paddingTop: 40 }}>
                <div style={{ maxWidth: 860, margin: "0 auto",
                    display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="hero" style={{ textAlign: "center" }}>
                        <h1 className="hero__title">📊 {t("stats.title")}</h1>
                        <p className="hero__subtitle">{t("stats.subtitle", { username })}</p>
                        <div style={{ marginTop: 12 }}>
                            <button type="button" className="btn btn--primary"
                                    onClick={() => fetchStats(1)} disabled={loading}>
                                {loading ? t("stats.loading") : t("stats.refresh")}
                            </button>
                        </div>
                    </div>

                    {renderBody()}

                    <div style={{ display: "flex", justifyContent: "center", paddingTop: 6 }}>
                        <button type="button" className="btn btn--primary"
                                onClick={() => navigate("/home")}>
                            {t("instructions.back")}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Statistics;