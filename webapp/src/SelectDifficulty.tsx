import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
const PRESET_TIMERS      = [0, 15, 30, 60];   // 0 = no limit
const PRESET_UNDO_LIMITS = [1, 2, 3, 0];       // 0 = unlimited

const SelectDifficulty: React.FC = () => {
    const navigate = useNavigate();
    const { t }    = useI18n();

    const [username,    setUsername]    = useState<string | null>(null);
    const [selected,    setSelected]    = useState<string>("");
    const [presetSize,  setPresetSize]  = useState<number | null>(7);
    const [customSize,  setCustomSize]  = useState<string>("");
    const [presetTimer, setPresetTimer] = useState<number | null>(0);
    const [customTimer, setCustomTimer] = useState<string>("");

    // ── Undo config ───────────────────────────────────────────────────────────
    const [allowUndo, setAllowUndo] = useState<boolean>(false);
    const [undoLimit, setUndoLimit] = useState<number>(3);

    // ── Pie Rule config ───────────────────────────────────────────────────────
    const [pieRule, setPieRule] = useState<boolean>(false);

    const boardSize = customSize !== "" ? parseInt(customSize, 10) : (presetSize ?? 7);
    const timerSeconds: number =
        customTimer !== ""
            ? parseInt(customTimer, 10)
            : (presetTimer ?? 0);

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

    const handlePresetSize  = (size: number)                           => { setPresetSize(size);      setCustomSize(""); };
    const handleCustomSize  = (e: React.ChangeEvent<HTMLInputElement>) => { setPresetSize(null);      setCustomSize(e.target.value); };
    const handlePresetTimer = (seconds: number)                        => { setPresetTimer(seconds);  setCustomTimer(""); };
    const handleCustomTimer = (e: React.ChangeEvent<HTMLInputElement>) => { setPresetTimer(null);     setCustomTimer(e.target.value); };

    const sizeWarning = (): string | null => {
        if (!boardSize || isNaN(boardSize))    return null;
        if (boardSize < MIN_RECOMMENDED)       return t("boardsize.warning.small");
        if (boardSize > MAX_RECOMMENDED)       return t("boardsize.warning.large");
        return null;
    };

    const timerWarning = (): string | null => {
        if (timerSeconds === 0 || isNaN(timerSeconds)) return null;
        if (timerSeconds < 5)                          return t("timer.warning.short");
        if (timerSeconds > 300)                        return t("timer.warning.long");
        return null;
    };

    const handleStart = () => {
        if (selected) {
            localStorage.setItem("selectedBot", selected);
            navigate("/game", {
                state: {
                    username,
                    bot:          selected,
                    boardSize,
                    timerSeconds: isNaN(timerSeconds) ? 0 : timerSeconds,
                    allowUndo,
                    undoLimit:    allowUndo ? undoLimit : 0,
                    pieRule,
                },
            });
        }
    };

    if (!username) return null;

    const sizeWarn  = sizeWarning();
    const timerWarn = timerWarning();

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

                    {/* ── Bot selection ─────────────────────────────────────── */}
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

                    {/* ── Board size ────────────────────────────────────────── */}
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

                    {/* ── Turn timer ────────────────────────────────────────── */}
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

                    {/* ── Undo moves ────────────────────────────────────────── */}
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

                    {/* ── Pie Rule ──────────────────────────────────────────── */}
                    <div className="card">
                        <h2 className="card__title">{t("pieRule.title")}</h2>
                        <p className="card__text">{t("pieRule.subtitle")}</p>

                        <div className="sd-toggle-row">
                            <span className="sd-toggle-label">{t("pieRule.toggle.label")}</span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={pieRule}
                                aria-label={t("pieRule.toggle.label")}
                                data-testid="pie-rule-toggle"
                                onClick={() => setPieRule(prev => !prev)}
                                className={`sd-toggle ${pieRule ? "sd-toggle--on" : ""}`}
                            >
                                <span className="sd-toggle__thumb" />
                            </button>
                        </div>

                        {/* Hint pill — only visible when Pie Rule is ON */}
                        {pieRule && (
                            <p className="sd-pie-hint">{t("pieRule.hint")}</p>
                        )}
                    </div>

                    {/* ── Actions ───────────────────────────────────────────── */}
                    <button
                        onClick={handleStart}
                        disabled={!selected}
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