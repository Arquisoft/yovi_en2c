import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";

type WinningEdge = [[number, number], [number, number]];

type GatewayResponse =
  | {
      ok: true;
      yen?: any;
      finished?: boolean;
      winner?: string | null;
      winning_edges?: WinningEdge[];
      message?: string;
    }
  | { ok: false; error: string; details?: any };

const API_URL = "/api";

function parseLayout(layout: string) {
  if (!layout) return [];
  return layout.split("/").map((row) => [...row]);
}

async function readGatewayResponse(res: Response): Promise<GatewayResponse> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` };
  }
}

function useWindowSize() {
  const [size, setSize] = React.useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));

  React.useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

function normalizeEdges(edgesRaw: any): WinningEdge[] {
  if (!Array.isArray(edgesRaw)) return [];
  return edgesRaw
    .filter(
      (e: any) =>
        Array.isArray(e) &&
        e.length === 2 &&
        Array.isArray(e[0]) &&
        Array.isArray(e[1])
    )
    .map((e: any) => [
      [Number(e[0][0]), Number(e[0][1])],
      [Number(e[1][0]), Number(e[1][1])],
    ]);
}

function buildWinningCellSet(edgesRaw: any): Set<string> {
  const cells = new Set<string>();
  const edges = normalizeEdges(edgesRaw);

  for (const [[r1, c1], [r2, c2]] of edges) {
    cells.add(`${r1}-${c1}`);
    cells.add(`${r2}-${c2}`);
  }

  return cells;
}

function getHexagonPoints(cx: number, cy: number, radius: number) {
  const points: string[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }

  return points.join(" ");
}

const Game: React.FC = () => {
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

  const logout = () => {
    localStorage.removeItem("username");
    navigate("/", { replace: true });
  };

  const [yen, setYen] = useState<any>(null);
  const botId = useMemo(() => {
    const stateBot = (location.state as { bot?: string } | null)?.bot;
    if (stateBot) {
      localStorage.setItem("selectedBot", stateBot);
      return stateBot;
    }
    const saved = localStorage.getItem("selectedBot");
    if (saved) return saved;
    return "heuristic_bot";
  }, [location.state]);

  const boardSizeFromState = useMemo(() => {
    const st = (location.state as { boardSize?: number } | null) ?? null;
    return st?.boardSize ?? 7;
  }, [location.state]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moveCount, setMoveCount] = useState(0);

  const [fixedPlayers, setFixedPlayersState] = useState<[string, string] | null>(null);
  const fixedPlayersRef = useRef<[string, string] | null>(null);

  const setFixedPlayers = (players: [string, string]) => {
    fixedPlayersRef.current = players;
    setFixedPlayersState(players);
  };

  const { w: winW, h: winH } = useWindowSize();

  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);

  const [winningPath, setWinningPath] = useState<{
    winner: string;
    cells: Set<string>;
  } | null>(null);

  const [gameOver, setGameOver] = useState<{
    result: "win" | "lost" | "draw";
    winner: string | null;
  } | null>(null);

  const finishTimerRef = React.useRef<number | null>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const update = () => setHeaderH(el.getBoundingClientRect().height);
    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    autoStartedRef.current = false;
    setYen(null);
    setWinningPath(null);
    setGameOver(null);
    setError(null);
    setMoveCount(0);
  }, [botId, boardSizeFromState]);

  const extractPlayers = (nextYen: any): [string, string] => {
    const players = nextYen?.players;
    if (Array.isArray(players) && players.length >= 2) {
      return [String(players[0]), String(players[1])];
    }
    return ["B", "R"];
  };
  
  const applyLocalHumanMove = (
    currentYen: any,
    row: number,
    col: number,
    token: string
    ) => {
    if (!currentYen?.layout) return currentYen;

    const rows = currentYen.layout.split("/").map((r: string) => r.split(""));

    if (!rows[row] || rows[row][col] !== ".") {
        return currentYen;
    }

    rows[row][col] = token;

    return {
        ...currentYen,
        layout: rows.map((r: string[]) => r.join("")).join("/"),
        turn:
        typeof currentYen.turn === "number" ? currentYen.turn + 1 : currentYen.turn,
    };
  };

  const boardSize = yen?.size ?? boardSizeFromState;

  const layoutMatrix = useMemo(() => {
    if (!yen?.layout) return [];
    return parseLayout(yen.layout);
  }, [yen]);

  const humanToken = useMemo(() => {
    if (fixedPlayers) return fixedPlayers[0];
    return yen?.players?.[0] ? String(yen.players[0]) : "B";
  }, [yen, fixedPlayers]);

  const botToken = useMemo(() => {
    if (fixedPlayers) return fixedPlayers[1];
    return yen?.players?.[1] ? String(yen.players[1]) : "R";
  }, [yen, fixedPlayers]);

  const boardWidth = 540;
  const padding = 50;
  const usableWidth = boardWidth - padding * 2;
  const cellSpacing = boardSize > 1 ? usableWidth / (boardSize - 1) : 0;
  const rowHeight = cellSpacing * 0.85;

  const pieceRadius = useMemo(() => {
    const byWidth = cellSpacing * 0.42;
    const byHeight = rowHeight * 0.48;
    return Math.max(7, Math.min(22, byWidth, byHeight));
  }, [cellSpacing, rowHeight]);

  const padPx = useMemo(
    () => Math.round(Math.max(12, Math.min(28, winW * 0.03))),
    [winW]
  );

  const bottomGutter = 28;
  const extraSafety = 10;

  const boardPx = useMemo(() => {
    const byWidth = Math.floor(winW - padPx * 2);
    const byHeight = Math.floor(
      winH - headerH - padPx * 3 - bottomGutter - extraSafety - 20
    );
    return Math.max(220, Math.min(680, byWidth, byHeight));
  }, [winW, winH, headerH, padPx]);

  const isEmptyCell = (row: number, col: number) => {
    const currentRow = layoutMatrix[row];
    return !!currentRow && currentRow[col] === ".";
  };

  const clearPendingFinish = () => {
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  const saveGameResult = async (
    result: "win" | "loss",
    winner: string | null,
    score: number,
    currentBoardSize: number
  ) => {
    try {
      await fetch(`${API_URL}/gameresult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          opponent: botId,
          result,
          winner,
          score,
          boardSize: currentBoardSize,
          gameMode: "pvb",
        }),
      });
    } catch {
      // intentionally silent
    }
  };

  const applyFinishFromGateway = (
    payload: any,
    playersFixed: [string, string],
    currentMoveCount: number,
    currentBoardSize: number
  ) => {
    const finished = typeof payload?.finished === "boolean" ? payload.finished : false;
    if (!finished) return;

    const winnerRaw = payload?.winner ?? null;
    const winner = winnerRaw == null ? null : String(winnerRaw);

    const winningCells = buildWinningCellSet(payload?.winning_edges);

    if (winner && winningCells.size > 0) {
      setWinningPath({ winner, cells: winningCells });
    } else {
      setWinningPath(null);
    }

    clearPendingFinish();

    const youWin = winner ? winner === playersFixed[0] : false;
    const result: "win" | "lost" | "draw" = winner
      ? youWin
        ? "win"
        : "lost"
      : "draw";

    setGameOver({ result, winner });

    if (result !== "draw") {
      saveGameResult(
        result === "win" ? "win" : "loss",
        winner,
        currentMoveCount,
        currentBoardSize
      );
    }
  };

  const newGame = async () => {
    setBusy(true);
    setError(null);
    setWinningPath(null);
    setGameOver(null);
    clearPendingFinish();
    setMoveCount(0);

    fixedPlayersRef.current = null;
    setFixedPlayersState(null);

    try {
      const res = await fetch(`${API_URL}/game/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: boardSizeFromState }),
      });

      const data = await readGatewayResponse(res);
      if (!res.ok || !data.ok) {
        throw new Error(!data.ok ? data.error : "Game creation failed");
      }

      const nextYen = (data as any).yen;
      const players = extractPlayers(nextYen);

      setFixedPlayers(players);
      setYen(nextYen);

      applyFinishFromGateway(data, players, 0, boardSizeFromState);
    } catch (e: any) {
      setError(e?.message ?? "Game creation failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!username) return;
    if (autoStartedRef.current) return;
    if (busy) return;

    autoStartedRef.current = true;
    newGame();
  }, [username, botId, boardSizeFromState]);

  const sendMove = async (target: { row: number; col: number }) => {
    if (!target || !yen || busy || gameOver) return;
    if (!isEmptyCell(target.row, target.col)) return;

    const optimisticYen = applyLocalHumanMove(yen, target.row, target.col, humanToken);

    setBusy(true);
    setError(null);

    const previousYen = yen;
    const newMoveCount = moveCount + 1;

    setMoveCount(newMoveCount);
    setYen(optimisticYen);

    try {
        const res = await fetch(`${API_URL}/game/pvb/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            yen: previousYen,
            bot: botId,
            row: target.row,
            col: target.col,
        }),
        });

        const data = await readGatewayResponse(res);
        if (!res.ok || !data.ok) {
        throw new Error(!data.ok ? data.error : "Backend error");
        }

        const nextYen = (data as any).yen;

        const players: [string, string] =
        fixedPlayersRef.current ?? extractPlayers(nextYen);

        if (!fixedPlayersRef.current) {
        setFixedPlayers(players);
        }

        setYen(nextYen);

        applyFinishFromGateway(data, players, newMoveCount, boardSizeFromState);
    } catch (e: any) {
        setYen(previousYen);
        setMoveCount((current) => Math.max(0, current - 1));
        setError(e?.message ?? "Backend error");
    } finally {
        setBusy(false);
    }
  };

  if (!username) return null;

  const getCellFill = (cell: string, row: number, col: number) => {
    const cellKey = `${row}-${col}`;
    const isWinningCell = !!winningPath?.cells.has(cellKey);

    if (cell === humanToken) {
      return isWinningCell ? "#7fd3ff" : "#1e88e5";
    }

    if (cell === botToken) {
      return isWinningCell ? "#ff8a80" : "#d32f2f";
    }

    return "#d0d0d0";
  };

  const getCellStroke = (cell: string, row: number, col: number) => {
    const cellKey = `${row}-${col}`;
    const isWinningCell = !!winningPath?.cells.has(cellKey);

    if (isWinningCell) return "#ffffff";
    if (cell === ".") return "#5b5b5b";
    return "#3b3b3b";
  };

  return (
    <div
      className="page"
      style={{
        height: "100dvh",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Navbar username={username} onLogout={logout} />

      <main
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          padding: `${padPx}px`,
          paddingBottom: `${padPx}px`,
          fontFamily: "system-ui",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          overflow: "auto",
          boxSizing: "border-box",
        }}
      >
        <div
          ref={headerRef}
          style={{
            width: "100%",
            maxWidth: 980,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/home", { state: { username } })}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(255,255,255,.06)",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {t("game.back")}
          </button>

          <h1 style={{ margin: 0, textAlign: "center", paddingTop: 6 }}>
            {t("app.brand")}
          </h1>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 10,
            }}
          >
            <button
              onClick={newGame}
              disabled={busy}
              style={{
                padding: "8px 14px",
                borderRadius: 12,
                background: "#A52019",
                color: "white",
                border: "none",
                opacity: busy ? 0.7 : 1,
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {t("game.new")}
            </button>
          </div>

          {error && (
            <div
              style={{
                color: "red",
                textAlign: "center",
                fontWeight: 600,
                marginTop: 10,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            width: `${boardPx}px`,
            height: `${boardPx}px`,
            maxWidth: "100%",
            maxHeight: "100%",
            borderRadius: 18,
            background: "linear-gradient(135deg, #FCF5E3, #F5F5F5)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            marginBottom: 0,
          }}
        >
          <svg
            viewBox={`0 0 ${boardWidth} ${boardWidth}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block", touchAction: "manipulation" }}
          >
            {layoutMatrix.map((row, rowIndex) => {
              const offsetX = padding + ((boardSize - row.length) * cellSpacing) / 2;

              return row.map((cell, colIndex) => {
                const x = offsetX + colIndex * cellSpacing;
                const y = padding + rowIndex * rowHeight;
                const clickable = cell === "." && !busy && !!yen && !gameOver;
                const points = getHexagonPoints(x, y, pieceRadius);

                return (
                  <polygon
                    key={`${rowIndex}-${colIndex}`}
                    points={points}
                    fill={getCellFill(cell, rowIndex, colIndex)}
                    stroke={getCellStroke(cell, rowIndex, colIndex)}
                    strokeWidth={
                      winningPath?.cells.has(`${rowIndex}-${colIndex}`) ? 2.8 : 1.4
                    }
                    onClick={() => {
                      if (!clickable) return;
                      sendMove({ row: rowIndex, col: colIndex });
                    }}
                    style={{
                      cursor: clickable ? "pointer" : "default",
                      transition:
                        "fill 180ms ease, stroke 180ms ease, opacity 120ms ease",
                      opacity: cell === "." && clickable ? 0.95 : 1,
                    }}
                  />
                );
              });
            })}
          </svg>
        </div>

        {gameOver && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(18,24,38,.78), rgba(18,24,38,.62))",
                border: "1px solid rgba(255,255,255,.18)",
                borderRadius: 20,
                padding: "40px 48px",
                textAlign: "center",
                boxShadow: "0 24px 60px rgba(0,0,0,.6)",
                display: "flex",
                flexDirection: "column",
                gap: 24,
                minWidth: 260,
              }}
            >
              <div style={{ fontSize: 56 }}>
                {gameOver.result === "win"
                  ? "🏆"
                  : gameOver.result === "lost"
                  ? "💀"
                  : "🤝"}
              </div>

              <h2 style={{ margin: 0, fontSize: 28, color: "white" }}>
                {gameOver.result === "win"
                  ? t("game.finished.win")
                  : gameOver.result === "lost"
                  ? t("game.finished.lost")
                  : t("game.finished.draw")}
              </h2>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => navigate("/home", { state: { username } })}
                  style={{
                    padding: "12px 22px",
                    borderRadius: 12,
                    background: "#A52019",
                    color: "white",
                    border: "none",
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  {t("game.finished.back")}
                </button>

                <button
                  onClick={() => {
                    setGameOver(null);
                    newGame();
                  }}
                  style={{
                    padding: "12px 22px",
                    borderRadius: 12,
                    background: "rgba(67,195,221,.20)",
                    color: "white",
                    border: "1px solid rgba(67,195,221,.55)",
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  {t("game.new")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Game;