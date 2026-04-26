import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import InstructionsContent from "./InstructionsContent";
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

const API_URL          = "/api";
const HINT_DURATION_MS = 2500;
const UNDO_TOAST_MS    = 1800;

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
      .filter((e: any) => Array.isArray(e) && e.length === 2 && Array.isArray(e[0]) && Array.isArray(e[1]))
      .map((e: any) => [[Number(e[0][0]), Number(e[0][1])], [Number(e[1][0]), Number(e[1][1])]]);
}

function buildWinningCellSet(edgesRaw: any): Set<string> {
  const cells = new Set<string>();
  for (const [[r1, c1], [r2, c2]] of normalizeEdges(edgesRaw)) {
    cells.add(`${r1}-${c1}`);
    cells.add(`${r2}-${c2}`);
  }
  return cells;
}

function getHexagonPoints(cx: number, cy: number, radius: number) {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return points.join(" ");
}

// ── TurnTimer ─────────────────────────────────────────────────────────────────
interface TurnTimerProps { secondsLeft: number; totalSeconds: number; }

const TIMER_SIZE = 64;
const TIMER_STROKE = 5;
const TIMER_R = (TIMER_SIZE - TIMER_STROKE) / 2;
const TIMER_CIRC = 2 * Math.PI * TIMER_R;

const TurnTimer: React.FC<TurnTimerProps> = ({ secondsLeft, totalSeconds }) => {
  const ratio      = totalSeconds > 0 ? secondsLeft / totalSeconds : 1;
  const color      = ratio > 0.5 ? "var(--ok)" : ratio > 0.25 ? "var(--amber)" : "var(--danger)";
  const pulse      = ratio <= 0.25;
  const dashOffset = TIMER_CIRC * (1 - ratio);
  return (
      <div className={`game-timer-container${pulse ? " game-timer-container--pulse" : ""}`} style={{ width: TIMER_SIZE, height: TIMER_SIZE }}>
        <svg width={TIMER_SIZE} height={TIMER_SIZE}>
          <circle cx={TIMER_SIZE / 2} cy={TIMER_SIZE / 2} r={TIMER_R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={TIMER_STROKE} />
          <circle cx={TIMER_SIZE / 2} cy={TIMER_SIZE / 2} r={TIMER_R} fill="none" stroke={color} strokeWidth={TIMER_STROKE} strokeDasharray={TIMER_CIRC} strokeDashoffset={dashOffset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s ease" }} />
        </svg>
        <span className="game-timer-label" style={{ color }}>{secondsLeft}</span>
      </div>
  );
};

// ── BotTimer ──────────────────────────────────────────────────────────────────
interface BotTimerProps { size: number; }

const BotTimer: React.FC<BotTimerProps> = ({ size }) => {
  const stroke = 5;
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const arcLen = circ * 0.25;
  return (
      <div className="game-timer-container" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--aqua)" strokeWidth={stroke} strokeDasharray={`${arcLen} ${circ - arcLen}`} strokeLinecap="round" className="game-bot-timer-arc" />
        </svg>
        <span className="game-timer-label" style={{ color: "var(--aqua)", fontSize: 22 }}>🤖</span>
      </div>
  );
};

// ── Game ──────────────────────────────────────────────────────────────────────

const Game: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t }    = useI18n();

  const username = useMemo(() => {
    const st = (location.state as { username?: string } | null) ?? null;
    return st?.username ?? localStorage.getItem("username") ?? "";
  }, [location.state]);

  useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  const [yen, setYen] = useState<any>(null);

  const botId = useMemo(() => {
    const stateBot = (location.state as { bot?: string } | null)?.bot;
    if (stateBot) { localStorage.setItem("selectedBot", stateBot); return stateBot; }
    return localStorage.getItem("selectedBot") ?? "heuristic_bot";
  }, [location.state]);

  const timerSeconds = useMemo(() => {
    const st = (location.state as { timerSeconds?: number } | null) ?? null;
    return st?.timerSeconds ?? 0;
  }, [location.state]);

  const timerEnabled = timerSeconds > 0;

  // ── Undo config (read from navigation state) ──────────────────────────────
  const allowUndo = useMemo(() => {
    const st = (location.state as { allowUndo?: boolean } | null) ?? null;
    return st?.allowUndo ?? false;
  }, [location.state]);

  // undoLimit: 0 = unlimited, >0 = max undos per game
  const undoLimit = useMemo(() => {
    const st = (location.state as { undoLimit?: number } | null) ?? null;
    return st?.undoLimit ?? 0;
  }, [location.state]);

  const [showInstructions, setShowInstructions] = useState(false);

  const boardSizeFromState = useMemo(() => {
    const st = (location.state as { boardSize?: number } | null) ?? null;
    return st?.boardSize ?? 7;
  }, [location.state]);

  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [moveCount,  setMoveCount]  = useState(0);

  const [hintCell,    setHintCell]    = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const hintTimerRef = useRef<number | null>(null);

  // ── Undo state ────────────────────────────────────────────────────────────
  // yenHistory: array of YEN states BEFORE each human move (index 0 = oldest).
  // Each entry is the complete yen object the player could revert to.
  const [yenHistory,  setYenHistory]  = useState<any[]>([]);
  const [undoCount,   setUndoCount]   = useState(0);   // how many undos used this game
  const [undoToast,   setUndoToast]   = useState(false);
  const undoToastTimerRef = useRef<number | null>(null);

  const [fixedPlayers, setFixedPlayersState] = useState<[string, string] | null>(null);
  const fixedPlayersRef = useRef<[string, string] | null>(null);

  const setFixedPlayers = (players: [string, string]) => {
    fixedPlayersRef.current = players;
    setFixedPlayersState(players);
  };

  const { w: winW, h: winH } = useWindowSize();
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);

  const [winningPath, setWinningPath] = useState<{ winner: string; cells: Set<string> } | null>(null);

  const [gameOver, setGameOver] = useState<{
    result: "win" | "lost" | "draw";
    winner: string | null;
    reason?: "timeout";
  } | null>(null);

  const [timeLeft,       setTimeLeft]       = useState<number>(timerSeconds);
  const timerIntervalRef = useRef<number | null>(null);
  const finishTimerRef   = useRef<number | null>(null);
  const autoStartedRef   = useRef(false);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (!timerEnabled) return;
    stopTimer();
    setTimeLeft(timerSeconds);
    timerIntervalRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { stopTimer(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [timerEnabled, timerSeconds, stopTimer]);

  useEffect(() => {
    if (!timerEnabled || timeLeft !== 0 || gameOver || !yen || busy) return;
    const players: [string, string] = fixedPlayersRef.current ?? ["B", "R"];
    setGameOver({ result: "lost", winner: players[1], reason: "timeout" });
    saveGameResult("loss", players[1], moveCount, boardSizeFromState, "timeout");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

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
      if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
      if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
      if (undoToastTimerRef.current !== null) window.clearTimeout(undoToastTimerRef.current);
      stopTimer();
    };
  }, [stopTimer]);

  useEffect(() => {
    autoStartedRef.current = false;
    setYen(null); setWinningPath(null); setGameOver(null);
    setError(null); setMoveCount(0); setShowInstructions(false);
    setHintCell(null); setHintLoading(false);
    setYenHistory([]); setUndoCount(0); setUndoToast(false);
    stopTimer(); setTimeLeft(timerSeconds);
  }, [botId, boardSizeFromState, stopTimer, timerSeconds]);

  const extractPlayers = (nextYen: any): [string, string] => {
    const p = nextYen?.players;
    return Array.isArray(p) && p.length >= 2 ? [String(p[0]), String(p[1])] : ["B", "R"];
  };

  const applyLocalHumanMove = (currentYen: any, row: number, col: number, token: string) => {
    if (!currentYen?.layout) return currentYen;
    const rows = currentYen.layout.split("/").map((r: string) => r.split(""));
    if (!rows[row] || rows[row][col] !== ".") return currentYen;
    rows[row][col] = token;
    return {
      ...currentYen,
      layout: rows.map((r: string[]) => r.join("")).join("/"),
      turn: typeof currentYen.turn === "number" ? currentYen.turn + 1 : currentYen.turn,
    };
  };

  const boardSize    = yen?.size ?? boardSizeFromState;
  const layoutMatrix = useMemo(() => (!yen?.layout ? [] : parseLayout(yen.layout)), [yen]);
  const humanToken   = useMemo(() => fixedPlayers ? fixedPlayers[0] : (yen?.players?.[0] ? String(yen.players[0]) : "B"), [yen, fixedPlayers]);
  const botToken     = useMemo(() => fixedPlayers ? fixedPlayers[1] : (yen?.players?.[1] ? String(yen.players[1]) : "R"), [yen, fixedPlayers]);

  const boardWidth  = 540;
  const padding     = 50;
  const usableWidth = boardWidth - padding * 2;
  const cellSpacing = boardSize > 1 ? usableWidth / (boardSize - 1) : 0;
  const rowHeight   = cellSpacing * 0.85;

  const pieceRadius = useMemo(() => {
    const byWidth  = cellSpacing * 0.42;
    const byHeight = rowHeight * 0.48;
    return Math.max(7, Math.min(22, byWidth, byHeight));
  }, [cellSpacing, rowHeight]);

  const padPx = useMemo(() => Math.round(Math.max(12, Math.min(28, winW * 0.03))), [winW]);

  const boardPx = useMemo(() => {
    const timerReserve = timerEnabled ? 80 + 24 : 0;
    const byWidth  = Math.floor(winW - padPx * 2 - timerReserve);
    const byHeight = Math.floor(winH - headerH - padPx * 3 - 28 - 10 - 20);
    return Math.max(220, Math.min(680, byWidth, byHeight));
  }, [winW, winH, headerH, padPx, timerEnabled]);

  const isEmptyCell = (row: number, col: number) => {
    const r = layoutMatrix[row];
    return !!r && r[col] === ".";
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
      currentBoardSize: number,
      endReason?: "timeout"
  ) => {
    try {
      await fetch(`${API_URL}/gameresult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username, opponent: botId, result, winner,
          score, boardSize: currentBoardSize, gameMode: "pvb",
          ...(endReason ? { endReason } : {}),
        }),
      });
    } catch { /* intentionally silent */ }
  };

  const applyFinishFromGateway = (
      payload: any,
      playersFixed: [string, string],
      currentMoveCount: number,
      currentBoardSize: number
  ) => {
    const finished = typeof payload?.finished === "boolean" ? payload.finished : false;
    if (!finished) return;
    stopTimer();
    const winner       = payload?.winner != null ? String(payload.winner) : null;
    const winningCells = buildWinningCellSet(payload?.winning_edges);
    setWinningPath(winner && winningCells.size > 0 ? { winner, cells: winningCells } : null);
    clearPendingFinish();
    const youWin = winner ? winner === playersFixed[0] : false;
    const result: "win" | "lost" | "draw" = winner ? (youWin ? "win" : "lost") : "draw";
    setGameOver({ result, winner });
    if (result !== "draw") saveGameResult(result === "win" ? "win" : "loss", winner, currentMoveCount, currentBoardSize);
  };

  const clearHint = () => {
    setHintCell(null);
    if (hintTimerRef.current !== null) { window.clearTimeout(hintTimerRef.current); hintTimerRef.current = null; }
  };

  const newGame = async () => {
    setBusy(true); setError(null); setWinningPath(null); setGameOver(null);
    clearPendingFinish(); setMoveCount(0); stopTimer(); setTimeLeft(timerSeconds);
    clearHint(); setHintLoading(false);
    fixedPlayersRef.current = null; setFixedPlayersState(null);
    // Reset undo state for new game
    setYenHistory([]); setUndoCount(0); setUndoToast(false);
    try {
      const res  = await fetch(`${API_URL}/game/new`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: boardSizeFromState }),
      });
      const data = await readGatewayResponse(res);
      if (!res.ok || !data.ok) throw new Error(!data.ok ? data.error : "Game creation failed");
      const nextYen  = (data as any).yen;
      const players  = extractPlayers(nextYen);
      setFixedPlayers(players);
      setYen(nextYen);
      applyFinishFromGateway(data, players, 0, boardSizeFromState);
      startTimer();
    } catch (e: any) {
      setError(e?.message ?? "Game creation failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!username || autoStartedRef.current || busy) return;
    autoStartedRef.current = true;
    newGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, botId, boardSizeFromState]);

  const sendMove = async (target: { row: number; col: number }) => {
    if (!target || !yen || busy || gameOver) return;
    if (!isEmptyCell(target.row, target.col)) return;
    clearHint();
    stopTimer();
    const optimisticYen = applyLocalHumanMove(yen, target.row, target.col, humanToken);
    setBusy(true); setError(null);
    const previousYen   = yen;
    const newMoveCount  = moveCount + 1;
    setMoveCount(newMoveCount);
    setYen(optimisticYen);

    // ── Push to undo history before the move is sent ──────────────────────
    if (allowUndo) {
      setYenHistory(prev => [...prev, previousYen]);
    }

    try {
      const res  = await fetch(`${API_URL}/game/pvb/move`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yen: previousYen, bot: botId, row: target.row, col: target.col }),
      });
      const data = await readGatewayResponse(res);
      if (!res.ok || !data.ok) throw new Error(!data.ok ? data.error : "Backend error");
      const nextYen  = (data as any).yen;
      const players: [string, string] = fixedPlayersRef.current ?? extractPlayers(nextYen);
      if (!fixedPlayersRef.current) setFixedPlayers(players);
      setYen(nextYen);
      applyFinishFromGateway(data, players, newMoveCount, boardSizeFromState);
      if (!(data as any).finished) startTimer();
    } catch (e: any) {
      // Revert on error — also pop the history entry we just pushed
      setYen(previousYen);
      setMoveCount((c) => Math.max(0, c - 1));
      if (allowUndo) {
        setYenHistory(prev => prev.slice(0, -1));
      }
      setError(e?.message ?? "Backend error");
      startTimer();
    } finally {
      setBusy(false);
    }
  };

  // ── Undo move ─────────────────────────────────────────────────────────────
  // Restores the board to the state before the last human move.
  // The bot's response move is also rolled back because the history stores
  // the YEN BEFORE the human moved (which is also BEFORE the bot responded).
  const undoMove = () => {
    if (!allowUndo) return;
    if (yenHistory.length === 0) return;
    if (gameOver) return;
    if (busy) return;
    if (undoLimit > 0 && undoCount >= undoLimit) return;

    const previousYen = yenHistory[yenHistory.length - 1];
    setYen(previousYen);
    setYenHistory(prev => prev.slice(0, -1));
    setMoveCount(prev => Math.max(0, prev - 1));
    setUndoCount(prev => prev + 1);
    clearHint();
    stopTimer();
    startTimer();

    // Show brief "Move undone" toast
    setUndoToast(true);
    if (undoToastTimerRef.current !== null) window.clearTimeout(undoToastTimerRef.current);
    undoToastTimerRef.current = window.setTimeout(() => {
      setUndoToast(false);
      undoToastTimerRef.current = null;
    }, UNDO_TOAST_MS);
  };

  const requestHint = async () => {
    if (!yen || busy || gameOver || hintLoading) return;
    setHintLoading(true);
    setHintCell(null);
    try {
      const res  = await fetch(`${API_URL}/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yen }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Hint unavailable");
      const coords = data.coords;
      const size   = yen.size as number;
      const row    = size - 1 - coords.x;
      const col    = coords.y;
      const key    = `${row}-${col}`;
      setHintCell(key);
      if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = window.setTimeout(() => {
        setHintCell(null);
        hintTimerRef.current = null;
      }, HINT_DURATION_MS);
    } catch (e: any) {
      setError(e?.message ?? "Hint unavailable");
    } finally {
      setHintLoading(false);
    }
  };

  if (!username) return null;

  const getCellFill = (cell: string, row: number, col: number) => {
    const key   = `${row}-${col}`;
    const isWin = !!winningPath?.cells.has(key);
    if (hintCell === key && cell === ".") return "rgba(254,235,160,0.55)";
    if (cell === humanToken) return isWin ? "#7fd3ff" : "#1e88e5";
    if (cell === botToken)   return isWin ? "#ff8a80" : "#d32f2f";
    return "var(--board-cell-empty-fill)";
  };

  const getCellStroke = (cell: string, row: number, col: number) => {
    const key = `${row}-${col}`;
    if (hintCell === key && cell === ".") return "var(--amber)";
    if (winningPath?.cells.has(key)) return "#ffffff";
    if (cell === ".") return "#5b5b5b";
    return "#3b3b3b";
  };

  const getCellStrokeWidth = (row: number, col: number) => {
    const key = `${row}-${col}`;
    if (hintCell === key) return 3.5;
    if (winningPath?.cells.has(key)) return 2.8;
    return 1.4;
  };

  // ── Button visibility / disabled logic ────────────────────────────────────
  const showHintButton = !!yen && !gameOver && !busy;

  const showUndoButton = allowUndo && !!yen && !gameOver;

  // The undo button is disabled when:
  //  - the game is busy (waiting for bot)
  //  - no moves have been made yet (history is empty)
  //  - the undo limit has been reached
  const undoDisabled =
      busy ||
      yenHistory.length === 0 ||
      (undoLimit > 0 && undoCount >= undoLimit);

  const undoRemaining = undoLimit > 0 ? undoLimit - undoCount : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
      <div className="page" style={{ height: "100dvh", overflow: "auto", display: "flex", flexDirection: "column" }}>
        <Navbar username={username} />

        <main
            style={{
              flex: "1 1 auto", minHeight: 0,
              padding: `${padPx}px`, paddingBottom: `${padPx}px`,
              fontFamily: "system-ui", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 12, overflow: "auto", boxSizing: "border-box",
            }}
        >
          {/* Header row */}
          <div
              ref={headerRef}
              style={{ width: "100%", maxWidth: 980, position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <button
                type="button"
                onClick={() => navigate("/home", { state: { username } })}
                style={{
                  position: "absolute", left: 0, top: 0,
                  padding: "8px 12px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.06)",
                  color: "white", fontWeight: 800, cursor: "pointer",
                }}
            >
              {t("game.back")}
            </button>

            <h1 style={{ margin: 0, textAlign: "center", paddingTop: 6 }}>{t("app.brand")}</h1>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
              <button
                  onClick={newGame} disabled={busy}
                  style={{
                    padding: "8px 14px", borderRadius: 12, background: "#A52019",
                    color: "white", border: "none", opacity: busy ? 0.7 : 1,
                    cursor: busy ? "not-allowed" : "pointer", fontWeight: 700,
                  }}
              >
                {t("game.new")}
              </button>

              <button
                  onClick={() => setShowInstructions((c) => !c)}
                  style={{
                    padding: "8px 14px", borderRadius: 12, background: "rgba(255,255,255,.08)",
                    color: "white", border: "1px solid rgba(255,255,255,.18)", cursor: "pointer", fontWeight: 700,
                  }}
              >
                {t("instructions.title")}
              </button>
            </div>

            {error && (
                <div style={{ color: "red", textAlign: "center", fontWeight: 600, marginTop: 10 }}>
                  {error}
                </div>
            )}
          </div>

          {showInstructions && (
              <div style={{ width: "100%", maxWidth: 980 }}>
                <InstructionsContent compact />
              </div>
          )}

          {/* Board + side panel */}
          <div className="game-board-area">
            <div
                className="game-board-wrapper"
                style={{ width: `${boardPx}px`, height: `${boardPx}px` }}
            >
              <svg
                  viewBox={`0 0 ${boardWidth} ${boardWidth}`}
                  width="100%" height="100%"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ display: "block", touchAction: "manipulation" }}
              >
                {layoutMatrix.map((row, rowIndex) => {
                  const offsetX = padding + ((boardSize - row.length) * cellSpacing) / 2;
                  return row.map((cell, colIndex) => {
                    const x        = offsetX + colIndex * cellSpacing;
                    const y        = padding + rowIndex * rowHeight;
                    const clickable = cell === "." && !busy && !!yen && !gameOver;
                    const isHinted  = hintCell === `${rowIndex}-${colIndex}`;
                    return (
                        <polygon
                            key={`${rowIndex}-${colIndex}`}
                            points={getHexagonPoints(x, y, pieceRadius)}
                            fill={getCellFill(cell, rowIndex, colIndex)}
                            stroke={getCellStroke(cell, rowIndex, colIndex)}
                            strokeWidth={getCellStrokeWidth(rowIndex, colIndex)}
                            onClick={() => { if (clickable) sendMove({ row: rowIndex, col: colIndex }); }}
                            style={{
                              cursor: clickable ? "pointer" : "default",
                              transition: "fill 180ms ease, stroke 180ms ease, opacity 120ms ease",
                              opacity: cell === "." && clickable ? 0.95 : 1,
                              animation: isHinted ? "hint-pulse 0.7s ease-in-out infinite alternate" : "none",
                            }}
                        />
                    );
                  });
                })}
              </svg>
            </div>

            {/* Side panel — timer + hint + undo */}
            {yen && !gameOver && (
                <div className="game-side-panel">
                  {/* Timer section */}
                  {timerEnabled && (
                      <>
                        {busy ? (
                            <>
                              <BotTimer size={TIMER_SIZE} />
                              <p className="game-timer-text">{t("timer.botThinking")}</p>
                            </>
                        ) : (
                            <>
                              <TurnTimer secondsLeft={timeLeft} totalSeconds={timerSeconds} />
                              <p className="game-timer-text">{t("timer.yourTurn")}</p>
                            </>
                        )}
                      </>
                  )}

                  {/* Hint button */}
                  {showHintButton && (
                      <button
                          onClick={requestHint}
                          disabled={hintLoading}
                          aria-label={t("game.hint")}
                          className="game-hint-btn"
                      >
                        {hintLoading ? t("game.hintLoading") : t("game.hint")}
                      </button>
                  )}

                  {/* Undo button — below hint, only when undo is enabled */}
                  {showUndoButton && (
                      <button
                          onClick={undoMove}
                          disabled={undoDisabled}
                          aria-label={t("game.undo")}
                          className="game-hint-btn"
                          style={{
                            marginTop: 8,
                            opacity: undoDisabled ? 0.45 : 1,
                            cursor: undoDisabled ? "not-allowed" : "pointer",
                          }}
                      >
                        {t("game.undo")}
                        {undoRemaining !== null && (
                            <span style={{
                              marginLeft: 6,
                              fontSize: "0.72rem",
                              opacity: 0.75,
                            }}>
                              ({undoRemaining})
                            </span>
                        )}
                      </button>
                  )}
                </div>
            )}
          </div>

          {/* Undo toast — brief "Move undone" notification */}
          {undoToast && (
              <div
                  role="status"
                  aria-live="polite"
                  style={{
                    position: "fixed",
                    bottom: 28,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 200,
                    background: "rgba(30,40,60,0.92)",
                    border: "1px solid rgba(67,195,221,.45)",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "10px 22px",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                  }}
              >
                {t("game.undoDone")}
              </div>
          )}

          {/* Game over overlay */}
          {gameOver && (
              <div
                  style={{
                    position: "fixed", inset: 0, zIndex: 100,
                    background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
              >
                <div
                    style={{
                      background: "linear-gradient(135deg, rgba(18,24,38,.78), rgba(18,24,38,.62))",
                      border: "1px solid rgba(255,255,255,.18)", borderRadius: 20,
                      padding: "40px 48px", textAlign: "center",
                      boxShadow: "0 24px 60px rgba(0,0,0,.6)",
                      display: "flex", flexDirection: "column", gap: 24, minWidth: 260,
                    }}
                >
                  <div style={{ fontSize: 56 }}>
                    {gameOver.reason === "timeout" ? "⏰"
                        : gameOver.result === "win"  ? "🏆"
                            : gameOver.result === "lost" ? "💀"
                                : "🤝"}
                  </div>

                  <h2 style={{ margin: 0, fontSize: 28, color: "white" }}>
                    {gameOver.reason === "timeout"   ? t("timer.timeout.lost")
                        : gameOver.result === "win"    ? t("game.finished.win")
                            : gameOver.result === "lost"   ? t("game.finished.lost")
                                : t("game.finished.draw")}
                  </h2>

                  {gameOver.reason === "timeout" && (
                      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                        {t("timer.timeout.description")}
                      </p>
                  )}

                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                        onClick={() => navigate("/home", { state: { username } })}
                        style={{
                          padding: "12px 22px", borderRadius: 12, background: "#A52019",
                          color: "white", border: "none", fontWeight: 800, fontSize: 16, cursor: "pointer",
                        }}
                    >
                      {t("game.finished.back")}
                    </button>

                    <button
                        onClick={() => { setGameOver(null); newGame(); }}
                        style={{
                          padding: "12px 22px", borderRadius: 12,
                          background: "rgba(67,195,221,.20)", color: "white",
                          border: "1px solid rgba(67,195,221,.55)", fontWeight: 800, fontSize: 16, cursor: "pointer",
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