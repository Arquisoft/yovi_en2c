import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import Navbar from "./Navbar";
import logo from "../img/logo.png";

// Definimos las dificultades y el bot correspondiente
const difficulties = [
    { id: "heuristic_bot", nameKey: "difficulty.easy", botId: "heuristic_bot" },
    { id: "minimax_bot", nameKey: "difficulty.medium", botId: "minimax_bot" },
    { id: "alfa_beta_bot", nameKey: "difficulty.hard", botId: "alfa_beta_bot" },
    { id: "monte_carlo_hard", nameKey: "difficulty.expert", botId: "monte_carlo_hard" },
    { id: "monte_carlo_extreme", nameKey: "difficulty.extreme", botId: "monte_carlo_extreme" },
];

const PRESET_SIZES = [5, 7, 9, 11];
const MIN_RECOMMENDED = 5;
const MAX_RECOMMENDED = 11;

const SelectDifficulty: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useI18n();
    const [username, setUsername] = useState<string | null>(null);
    const [selected, setSelected] = useState<string>("");
    const [presetSize, setPresetSize] = useState<number | null>(7);
    const [customSize, setCustomSize] = useState<string>("");
    const boardSize = customSize !== "" ? parseInt(customSize, 10) : (presetSize ?? 7);

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

    const handleSelect = (botId: string) => {
        setSelected(botId);
    };

    const handlePresetSize = (size: number) => {
        setPresetSize(size);
        setCustomSize("");
    };

    const handleCustomSize = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPresetSize(null);
        setCustomSize(e.target.value);
    };

    const sizeWarning = (): string | null => {
        if (!boardSize || isNaN(boardSize)) return null;
        if (boardSize < MIN_RECOMMENDED) return t("boardsize.warning.small");
        if (boardSize > MAX_RECOMMENDED) return t("boardsize.warning.large");
        return null;
    };

    const handleStart = () => {
        if (selected) {
            localStorage.setItem("selectedBot", selected);
            navigate("/game", { state: { username, bot: selected, boardSize } });
        }
    };


    if (!username) return null;

    const warning = sizeWarning();

    return (
        <div className="page">
            <Navbar username={username} onLogout={logout} />
            <main className="container" style={{ paddingTop: 40, textAlign: "center" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Cabecera */}
                    <div className="hero" style={{ textAlign: "center" }}>
                        <div className="hero__top">
                            <img src={logo} alt="GameY" className="hero__logo" />
                        </div>
                        <h1 className="hero__title">{t("difficulty.title")}</h1>
                        <p className="hero__subtitle">{t("difficulty.subtitle")}</p>
                    </div>

                    {/* Div para sleeccion de bot */}
                    <div className="card">
                        <h2 className="card__title">{t("difficulty.subtitle")}</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                            {difficulties.map((diff) => (
                                <button
                                    key={diff.id}
                                    onClick={() => handleSelect(diff.botId)}
                                    className={`btn ${selected === diff.botId ? "btn--primary" : ""}`}
                                    style={{ width: "100%", textAlign: "center" }}
                                >
                                    {t(diff.nameKey)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Div para seleccion de tamaño de tablero */}
                    <div className="card">
                        <h2 className="card__title">{t("boardsize.title")}</h2>
                        <p className="card__text">{t("boardsize.subtitle")}</p>

                        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
                            {PRESET_SIZES.map((size) => (
                                <button
                                    key={size}
                                    onClick={() => handlePresetSize(size)}
                                    className={`btn ${presetSize === size ? "btn--primary" : ""}`}
                                    style={{ minWidth: 60 }}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>

                        {/* Textfield tamaño personalizado */}
                        <input
                            type="number"
                            min={1}
                            value={customSize}
                            onChange={handleCustomSize}
                            placeholder={t("boardsize.custom.placeholder")}
                            className="form-input"
                            style={{ marginTop: 12, textAlign: "center" }}
                        />

                        {/* Alerta amarilla — solo visible si hay advertencia */}
                        {warning && (
                            <p style={{
                                marginTop: 10,
                                padding: "8px 12px",
                                borderRadius: 10,
                                background: "rgba(254,235,160,.15)",
                                border: "1px solid rgba(254,235,160,.50)",
                                color: "#feeba0",
                                fontWeight: 700,
                                fontSize: "0.9rem",
                            }}>
                                {warning}
                            </p>
                        )}
                    </div>

                    {/* Botón de inicio */}
                    <button
                        onClick={handleStart}
                        disabled={!selected}
                        className="btn btn--primary"
                        style={{ width: "100%" }}
                    >
                        {t("difficulty.start")}
                    </button>

                    {/* Botón de instrucciones */}
                    <button
                        type="button"
                        className="btn"
                        style={{ width: "100%" }}
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