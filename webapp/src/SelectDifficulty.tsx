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

const SelectDifficulty: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useI18n();
    const [username, setUsername] = useState<string | null>(null);
    const [selected, setSelected] = useState<string>("");

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

    const handleStart = () => {
        if (selected) {
            // Guardamos la dificultad en localStorage (opcional) y navegamos al juego
            localStorage.setItem("selectedBot", selected);
            navigate("/game", { state: { username, bot: selected } });
        }
    };

    if (!username) return null;

    return (
        <div className="page">
            <Navbar username={username} onLogout={logout} />
            <main className="container" style={{ paddingTop: 40, textAlign: "center" }}>
                <div className="hero" style={{ maxWidth: 600, margin: "0 auto" }}>
                    <div className="hero__top">
                        <img src={logo} alt="GameY" className="hero__logo" />
                    </div>
                    <h1 className="hero__title">{t("difficulty.title")}</h1>
                    <p className="hero__subtitle">{t("difficulty.subtitle")}</p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
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

                    <div style={{ marginTop: 32 }}>
                        <button
                            onClick={handleStart}
                            disabled={!selected}
                            className="btn btn--primary"
                            style={{ width: "100%" }}
                        >
                            {t("difficulty.start")}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SelectDifficulty;