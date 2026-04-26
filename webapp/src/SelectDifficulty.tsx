import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "./i18n/I18nProvider";
import Navbar from "./Navbar";
import logo from "../img/logo.png";

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
const PRESET_TIMERS = [0, 15, 30, 60];
const PRESET_UNDO_LIMITS = [1, 2, 3, 0];

type GameMode = "bot" | "local";
type FirstPlayer = "player1" | "player2" | "random";

const SelectDifficulty: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const [username, setUsername] = useState<string | null>(null);

  const [gameMode, setGameMode] = useState<GameMode>(
    (location.state as { bot?: string } | null)?.bot === "local" ? "local" : "bot"
  );

  const [selected, setSelected] = useState("");
  const [player2Name, setPlayer2Name] = useState("");
  const [firstPlayer, setFirstPlayer] = useState<FirstPlayer>("player1");
  const [pieRule, setPieRule] = useState(false);

  const [presetSize, setPresetSize] = useState<number | null>(7);
  const [customSize, setCustomSize] = useState("");

  const [presetTimer, setPresetTimer] = useState<number | null>(0);
  const [customTimer, setCustomTimer] = useState("");

  const [allowUndo, setAllowUndo] = useState(false);
  const [undoLimit, setUndoLimit] = useState(3);

  const boardSize = customSize !== "" ? parseInt(customSize, 10) : presetSize ?? 7;
  const timerSeconds = customTimer !== "" ? parseInt(customTimer, 10) : presetTimer ?? 0;

  useEffect(() => {
    const storedUser = localStorage.getItem("username");

    if (!storedUser) {
      navigate("/", { replace: true });
      return;
    }

    setUsername(storedUser);
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("token");
    sessionStorage.clear();
    navigate("/", { replace: true });
  };

  const handlePresetSize = (size: number) => {
    setPresetSize(size);
    setCustomSize("");
  };

  const handleCustomSize = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPresetSize(null);
    setCustomSize(e.target.value);
  };

  const handlePresetTimer = (seconds: number) => {
    setPresetTimer(seconds);
    setCustomTimer("");
  };

  const handleCustomTimer = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPresetTimer(null);
    setCustomTimer(e.target.value);
  };

  const sizeWarning = (): string | null => {
    if (!boardSize || Number.isNaN(boardSize)) return null;
    if (boardSize < MIN_RECOMMENDED) return t("boardsize.warning.small");
    if (boardSize > MAX_RECOMMENDED) return t("boardsize.warning.large");
    return null;
  };

  const timerWarning = (): string | null => {
    if (timerSeconds === 0 || Number.isNaN(timerSeconds)) return null;
    if (timerSeconds < 5) return t("timer.warning.short");
    if (timerSeconds > 300) return t("timer.warning.long");
    return null;
  };

  const resolveFirstPlayer = (): "player1" | "player2" => {
    if (firstPlayer !== "random") return firstPlayer;

    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % 2 === 0 ? "player1" : "player2";
  };

  const handleStart = () => {
    const safeBoardSize = Number.isNaN(boardSize) ? 7 : boardSize;
    const safeTimerSeconds = Number.isNaN(timerSeconds) ? 0 : timerSeconds;

    if (gameMode === "bot") {
      if (!selected) return;

      localStorage.setItem("selectedBot", selected);

      navigate("/game", {
        state: {
          username,
          bot: selected,
          boardSize: safeBoardSize,
          timerSeconds: safeTimerSeconds,
          allowUndo,
          undoLimit: allowUndo ? undoLimit : 0,
          mode: "bot",
        },
      });

      return;
    }

    navigate("/game", {
      state: {
        username,
        boardSize: safeBoardSize,
        timerSeconds: safeTimerSeconds,
        allowUndo,
        undoLimit: allowUndo ? undoLimit : 0,
        mode: "local",
        player1Name: username,
        player2Name: player2Name.trim() || "Player 2",
        firstPlayer: resolveFirstPlayer(),
        pieRule,
      },
    });
  };

  if (!username) return null;

  const sizeWarn = sizeWarning();
  const timerWarn = timerWarning();
  const canStart = gameMode === "local" || !!selected;

  return (
    <div className="page">
      <Navbar username={username} onLogout={logout} />

      <main className="container sd-container">
        <div className="sd-wrapper">
          <div className="hero sd-hero">
            <div className="hero__top">
              <img src={logo} alt="GameY" className="hero__logo" />
            </div>
            <h1 className="hero__title">{t("difficulty.title")}</h1>
            <p className="hero__subtitle">{t("difficulty.subtitle")}</p>
          </div>

          <div className="card">
            <h2 className="card__title">{t("gamemode.title")}</h2>
            <p className="card__text">{t("gamemode.subtitle")}</p>

            <div className="sd-btn-list">
              <button
                type="button"
                onClick={() => setGameMode("bot")}
                className={`btn sd-btn-full ${gameMode === "bot" ? "btn--primary" : ""}`}
              >
                {t("gamemode.vsBot")}
              </button>

              <button
                type="button"
                onClick={() => setGameMode("local")}
                className={`btn sd-btn-full ${gameMode === "local" ? "btn--primary" : ""}`}
              >
                {t("gamemode.local")}
              </button>
            </div>
          </div>

          {gameMode === "bot" && (
            <div className="card">
              <h2 className="card__title">{t("difficulty.subtitle")}</h2>

              <div className="sd-btn-list">
                {difficulties.map((diff) => (
                  <button
                    type="button"
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

          <div className="card">
            <h2 className="card__title">{t("boardsize.title")}</h2>
            <p className="card__text">{t("boardsize.subtitle")}</p>

            <div className="sd-preset-row">
              {PRESET_SIZES.map((size) => (
                <button
                  type="button"
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

          <div className="card">
            <h2 className="card__title">{t("timer.title")}</h2>
            <p className="card__text">{t("timer.subtitle")}</p>

            <div className="sd-preset-row">
              {PRESET_TIMERS.map((seconds) => (
                <button
                  type="button"
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
                onClick={() => setAllowUndo((prev) => !prev)}
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
                      type="button"
                      key={limit}
                      onClick={() => setUndoLimit(limit)}
                      className={`btn sd-preset-btn ${undoLimit === limit ? "btn--primary" : ""}`}
                    >
                      {limit === 0 ? t("undo.limit.unlimited") : limit}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {gameMode === "local" && (
            <div className="card">
              <h2 className="card__title">{t("local.firstplayer.title")}</h2>
              <p className="card__text">{t("local.firstplayer.subtitle")}</p>

              <div className="sd-btn-list">
                <button
                  type="button"
                  onClick={() => setFirstPlayer("player1")}
                  className={`btn sd-btn-full ${firstPlayer === "player1" ? "btn--primary" : ""}`}
                >
                  {username} ({t("local.player1.label")})
                </button>

                <button
                  type="button"
                  onClick={() => setFirstPlayer("player2")}
                  className={`btn sd-btn-full ${firstPlayer === "player2" ? "btn--primary" : ""}`}
                >
                  {player2Name.trim() || t("local.player2.placeholder")}{" "}
                  ({t("local.player2.label")})
                </button>

                <button
                  type="button"
                  onClick={() => setFirstPlayer("random")}
                  className={`btn sd-btn-full ${firstPlayer === "random" ? "btn--primary" : ""}`}
                >
                  {t("local.firstplayer.random")}
                </button>
              </div>
            </div>
          )}

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
                  onClick={() => setPieRule((prev) => !prev)}
                  className={`sd-toggle ${pieRule ? "sd-toggle--on" : ""}`}
                >
                  <span className="sd-toggle__thumb" />
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
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