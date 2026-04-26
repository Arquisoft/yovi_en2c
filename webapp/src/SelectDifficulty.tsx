import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import Navbar from "./Navbar";
import logo from "../img/logo.png";

const difficulties = [
    { id: "heuristic_bot",       nameKey: "difficulty.easy",    botId: "heuristic_bot"       },
    { id: "minimax_bot",         nameKey: "difficulty.medium",  botId: "minimax_bot"         },
    { id: "alfa_beta_bot",       nameKey: "difficulty.hard",    botId: "alfa_beta_bot"       },
    { id: "monte_carlo_hard",    nameKey: "difficulty.expert",  botId: "monte_carlo_hard"    },
    { id: "monte_carlo_extreme", nameKey: "difficulty.extreme", botId: "monte_carlo_extreme" },
];

const PRESET_SIZES       = [5, 7, 9, 11];
const MIN_RECOMMENDED    = 5;
const MAX_RECOMMENDED    = 11;
const PRESET_TIMERS      = [0, 15, 30, 60];
const PRESET_UNDO_LIMITS = [1, 2, 3, 0];

type GameMode    = "bot" | "local";
type FirstPlayer = "player1" | "player2" | "random";

const SelectDifficulty: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t }    = useI18n();

    const [username,    setUsername]    = useState<string | null>(null);

    // ── Mode ─────────────────────────────────────────────────────────────────
    const [gameMode,    setGameMode]    = useState<GameMode>(
        (location.state as { bot?: string } | null)?.bot === "local" ? "local" : "bot"
    );

    // ── Bot config ────────────────────────────────────────────────────────────
    const [selected,    setSelected]    = useState<string>("");

    // ── Local multiplayer config ──────────────────────────────────────────────
    const [player2Name, setPlayer2Name] = useState<string>("");
    const [firstPlayer, setFirstPlayer] = useState<FirstPlayer>("player1");
    const [pieRule,     setPieRule]     = useState<boolean>(false);

    // ── Board size ────────────────────────────────────────────────────────────
    const [presetSize,  setPresetSize]  = useState<number | null>(7);
    const [customSize,  setCustomSize]  = useState<string>("");

    // ── Turn timer ────────────────────────────────────────────────────────────
    const [presetTimer, setPresetTimer] = useState<number | null>(0);
    const [customTimer, setCustomTimer] = useState<string>("");

    // ── Undo ──────────────────────────────────────────────────────────────────
    const [allowUndo,   setAllowUndo]   = useState<boolean>(false);
    const [undoLimit,   setUndoLimit]   = useState<number>(3);

    const boardSize: number    = customSize  !== "" ? parseInt(customSize,  10) : (presetSize  ?? 7);
    const timerSeconds: number = customTimer !== "" ? parseInt(customTimer, 10) : (presetTimer ?? 0);

    useEffect(() => {
        const storedUser = localStorage.getItem("username");
        if (!storedUser) {
            navigate("/", { replace: true });
        } else {
            setUsername(storedUser);
        }
    }, [navigate]);

    const logout = () => {
        localStorage.removeItem("username");
        localStorage.removeItem("token");
        navigate("/", { replace: true });
    };

    const handlePresetSize  = (size: number)                           => { setPresetSize(size);     setCustomSize(""); };
    const handleCustomSize  = (e: React.ChangeEvent<HTMLInputElement>) => { setPresetSize(null);     setCustomSize(e.target.value); };
    const handlePresetTimer = (seconds: number)                        => { setPresetTimer(seconds); setCustomTimer(""); };
    const handleCustomTimer = (e: React.ChangeEvent<HTMLInputElement>) => { setPresetTimer(null);    setCustomTimer(e.target.value); };

    const sizeWarning = (): string | null => {
        if (!boardSize || isNaN(boardSize))  return null;
        if (boardSize < MIN_RECOMMENDED)     return t("boardsize.warning.small");
        if (boardSize > MAX_RECOMMENDED)     return t("boardsize.warning.large");
        return null;
    };

    const timerWarning = (): string | null => {
        if (timerSeconds === 0 || isNaN(timerSeconds)) return null;
        if (timerSeconds < 5)                          return t("timer.warning.short");
        if (timerSeconds > 300)                        return t("timer.warning.long");
        return null;
    };

    // Resolves random first player at the moment Start is pressed
    const resolveFirstPlayer = (): "player1" | "player2" => {
        if (firstPlayer === "random") return Math.random() < 0.5 ? "player1" : "player2";
        return firstPlayer;
    };

    const handleStart = () => {
        const safeBoardSize    = isNaN(boardSize)    ? 7 : boardSize;
        const safeTimerSeconds = isNaN(timerSeconds) ? 0 : timerSeconds;

        if (gameMode === "bot") {
            if (!selected) return;
            localStorage.setItem("selectedBot", selected);
            navigate("/game", {
                state: {
                    username,
                    bot:          selected,
                    boardSize:    safeBoardSize,
                    timerSeconds: safeTimerSeconds,
                    allowUndo,
                    undoLimit:    allowUndo ? undoLimit : 0,
                    mode:         "bot",
                },
            });
        } else {
            const p2 = player2Name.trim() || "Player 2";
            navigate("/game", {
                state: {
                    username,
                    boardSize:    safeBoardSize,
                    timerSeconds: safeTimerSeconds,
                    allowUndo,
                    undoLimit:    allowUndo ? undoLimit : 0,
                    mode:         "local",
                    player1Name:  username,
                    player2Name:  p2,
                    firstPlayer:  resolveFirstPlayer(),
                    pieRule,
                },
            });
        }
    };

    if (!username) return null;

    const sizeWarn = sizeWarning();
    const timerWarn = timerWarning();
    const canStart  = gameMode === "local" || !!selected;

    return (
        <div className="page">
            <Navbar username={username} onLogout={logout} />
            <main className="container sd-container">
                <div className="sd-wrapper">

                    {/* ── Hero ──────────────────────────────────────────────── */}
                    <div className="hero sd-hero">
                        <div className="hero__top">
                            <img src={logo} alt="GameY" className="hero__logo" />
                        </div>
                        <h1 className="hero__title">{t("difficulty.title")}</h1>
                        <p className="hero__subtitle">{t("difficulty.subtitle")}</p>
                    </div>

                    {/* ── Card 0: Game mode ─────────────────────────────────── */}
                    <div className="card">
                        <h2 className="card__title">{t("gamemode.title")}</h2>
                        <p className="card__text">{t("gamemode.subtitle")}</p>
                        <div className="sd-btn-list">
                            <button
                                onClick={() => setGameMode("bot")}
                                className={`btn sd-btn-full ${gameMode === "bot" ? "btn--primary" : ""}`}
                            >
                                {t("gamemode.vsBot")}
                            </button>
                            <button
                                onClick={() => setGameMode("local")}
                                className={`btn sd-btn-full ${gameMode === "local" ? "btn--primary" : ""}`}
                            >
                                {t("gamemode.local")}
                            </button>
                        </div>
                    </div>

                    {/* ── Card 1a: Bot difficulty (vs Bot only) ─────────────── */}
                    {gameMode === "bot" && (
                        <div className="card">
                            <h2 className="card__title">{t("difficulty.subtitle")}</h2>
                            <div className="sd-btn-list">
                                {difficulties.map((diff) => (
                                    <button
                                        key={diff.id}
                                        onClick={() => setSelected(diff.botId)}
                                        className={`btn sd-btn-full ${selected === diff.botId ? "btn--primary" : ""}`}
                                    >
                                        {t(diff.nameKey)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Card 1b: Player 2 name (Local only) ───────────────── */}
                    {gameMode === "local" && (
                        <div className="card">
                            <h2 className="card__title">{t("local.player2.title")}</h2>
                            <p className="card__text">{t("local.player2.subtitle")}</p>
                            <div style={{ marginBottom: 8, opacity: 0.65, fontSize: "0.85rem" }}>
                                {t("local.player1.label")}: <strong>{username}</strong>
                            </div>
                            <input
                                type="text"
                                maxLength={24}
                                value={player2Name}
                                onChange={(e) => setPlayer2Name(e.target.value)}
                                placeholder={t("local.player2.placeholder")}
                                className="form-input sd-custom-input"
                            />
                        </div>
                    )}

                    {/* ── Card 2: Board size (always) ───────────────────────── */}
                    <div className="card">
                        <h2 className="card__title">{t("boardsize.title")}</h2>
                        <p className="card__text">{t("boardsize.subtitle")}</p>
                        <div className="sd-preset-row">
                            {PRESET_SIZES.map((size) => (
                                <button
                                    key={size}
                                    onClick={() => handlePresetSize(size)}
                                    className={`btn sd-preset-btn ${presetSize === size ? "btn--primary" : ""}`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                        <input
                            type="number"
                            min={1}
                            value={customSize}
                            onChange={handleCustomSize}
                            placeholder={t("boardsize.custom.placeholder")}
                            className="form-input sd-custom-input"
                        />
                        {sizeWarn && <p className="sd-warning">{sizeWarn}</p>}
                    </div>

                    {/* ── Card 3: Turn timer (always) ───────────────────────── */}
                    <div className="card">
                        <h2 className="card__title">{t("timer.title")}</h2>
                        <p className="card__text">{t("timer.subtitle")}</p>
                        <div className="sd-preset-row">
                            {PRESET_TIMERS.map((seconds) => (
                                <button
                                    key={seconds}
                                    onClick={() => handlePresetTimer(seconds)}
                                    className={`btn sd-preset-btn ${presetTimer === seconds ? "btn--primary" : ""}`}
                                >
                                    {seconds === 0 ? t("timer.noLimit") : `${seconds}s`}
                                </button>
                            ))}
                        </div>
                        <input
                            type="number"
                            min={5}
                            max={300}
                            value={customTimer}
                            onChange={handleCustomTimer}
                            placeholder={t("timer.custom.placeholder")}
                            className="form-input sd-custom-input"
                        />
                        {timerWarn && <p className="sd-warning">{timerWarn}</p>}
                    </div>

                    {/* ── Card 4: Undo moves (always) ───────────────────────── */}
                    <div className="card">
                        <h2 className="card__title">{t("undo.title")}</h2>
                        <p className="card__text">{t("undo.subtitle")}</p>
                        <div className="sd-toggle-row">
                            <span className="sd-toggle-label">{t("undo.toggle.label")}</span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={allowUndo}
                                aria-label={t("undo.toggle.label")}
                                onClick={() => setAllowUndo(prev => !prev)}
                                className={`sd-toggle ${allowUndo ? "sd-toggle--on" : ""}`}
                            >
                                <span className="sd-toggle__thumb" />
                            </button>
                        </div>
                        {allowUndo && (
                            <div className="sd-undo-limits">
                                <p className="sd-undo-limits__label">{t("undo.limit.label")}</p>
                                <div className="sd-preset-row">
                                    {PRESET_UNDO_LIMITS.map((limit) => (
                                        <button
                                            key={limit}
                                            onClick={() => setUndoLimit(limit)}
                                            className={`btn sd-preset-btn ${undoLimit === limit ? "btn--primary" : ""}`}
                                            aria-label={limit === 0
                                                ? t("undo.limit.unlimited")
                                                : `${limit} ${t("undo.limit.moves")}`}
                                        >
                                            {limit === 0 ? t("undo.limit.unlimited") : limit}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Card 5: Who starts first (Local only) ─────────────── */}
                    {gameMode === "local" && (
                        <div className="card">
                            <h2 className="card__title">{t("local.firstplayer.title")}</h2>
                            <p className="card__text">{t("local.firstplayer.subtitle")}</p>
                            <div className="sd-btn-list">
                                <button
                                    onClick={() => setFirstPlayer("player1")}
                                    className={`btn sd-btn-full ${firstPlayer === "player1" ? "btn--primary" : ""}`}
                                >
                                    {username} ({t("local.player1.label")})
                                </button>
                                <button
                                    onClick={() => setFirstPlayer("player2")}
                                    className={`btn sd-btn-full ${firstPlayer === "player2" ? "btn--primary" : ""}`}
                                >
                                    {player2Name.trim() || t("local.player2.placeholder")} ({t("local.player2.label")})
                                </button>
                                <button
                                    onClick={() => setFirstPlayer("random")}
                                    className={`btn sd-btn-full ${firstPlayer === "random" ? "btn--primary" : ""}`}
                                >
                                    {t("local.firstplayer.random")}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Card 6: Pie Rule (Local only) ─────────────────────── */}
                    {gameMode === "local" && (
                        <div className="card">
                            <h2 className="card__title">{t("pierule.title")}</h2>
                            <p className="card__text">{t("pierule.description")}</p>
                            <div className="sd-toggle-row">
                                <span className="sd-toggle-label">{t("pierule.toggle.label")}</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={pieRule}
                                    aria-label={t("pierule.toggle.label")}
                                    onClick={() => setPieRule(prev => !prev)}
                                    className={`sd-toggle ${pieRule ? "sd-toggle--on" : ""}`}
                                >
                                    <span className="sd-toggle__thumb" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Actions ───────────────────────────────────────────── */}
                    <button
                        onClick={handleStart}
                        disabled={!canStart}
                        className="btn btn--primary sd-btn-full"
                    >
                        {t("difficulty.start")}
                    </button>

                    <button
                        type="button"
                        className="btn sd-btn-full"
                        onClick={() => navigate("/instructions", { state: { username } })}
                    >
                        {t("instructions.title")}
                    </button>

                </div>
            </main>
        </div>
    );
};

export default SelectDifficulty;