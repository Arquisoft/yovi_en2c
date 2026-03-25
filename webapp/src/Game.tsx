import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.tsx";
import { useI18n } from "./i18n/I18nProvider";

type BotId = "random_bot" | "heuristic_bot" | "minimax_bot" | "alfa_beta_bot" | "monte_carlo_hard" | "monte_carlo_extreme";
type WinningEdge = [[number, number], [number, number]];

type GatewayResponse =
  | { ok: true; yen?: any; finished?: boolean; winner?: string | null; winning_edges?: WinningEdge[]; message?: string }
  | { ok: false; error: string; details?: any };

type LocationState = {
  username?: string;
  mode?: "bot" | "player";
  botId?: BotId;
  boardSize?: number;
};
const API_URL = import.meta.env.VITE_API_URL ?? "/api"; // <-- use relative

function parseLayout(layout: string) {
  if (!layout) return [];
  return layout.split("/").map(row => [...row]);
}

async function readGatewayResponse(res: Response): Promise<GatewayResponse> {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok: false, error: text || `HTTP ${res.status}` }; }
}

function useWindowSize() {
  const [size, setSize] = React.useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  React.useEffect(() => {
    const fn = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return size;
}

function normalizeEdges(raw: any): WinningEdge[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e: any) => Array.isArray(e) && e.length === 2 && Array.isArray(e[0]) && Array.isArray(e[1]))
    .map((e: any) => [[Number(e[0][0]), Number(e[0][1])], [Number(e[1][0]), Number(e[1][1])]]);
}

const Game: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t }    = useI18n();

  const st = (location.state as LocationState | null) ?? null;

  const username  = useMemo(() => st?.username ?? localStorage.getItem("username") ?? "", [st]);
  const initBot   = useMemo<BotId>(() => st?.botId ?? "random_bot", [st]);
  const initSize  = useMemo(() => st?.boardSize ?? 7, [st]);
  const gameMode  = useMemo(() => st?.mode ?? "bot", [st]);

  useEffect(() => { if (!username) navigate("/", { replace: true }); }, [username, navigate]);

  const logout = () => { localStorage.removeItem("username"); navigate("/", { replace: true }); };

  const [yen,       setYen]       = useState<any>(null);
  const [botId]                   = useState<BotId>(initBot);
  const [boardSize] = useState<number>(initSize);
  const [selected,  setSelected]  = useState<{ row: number; col: number } | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  const [fixedPlayers, setFixedPlayersState] = useState<[string, string] | null>(null);
  const fixedPlayersRef = useRef<[string, string] | null>(null);
  const setFixedPlayers = (p: [string, string]) => { fixedPlayersRef.current = p; setFixedPlayersState(p); };

  const [winOverlay, setWinOverlay] = useState<{ winner: string; edges: WinningEdge[] } | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const headerRef      = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);
  const { w: winW, h: winH } = useWindowSize();

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const upd = () => setHeaderH(el.getBoundingClientRect().height);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => { if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current); }, []);

  const extractPlayers = (y: any): [string, string] => {
    const p = y?.players;
    return Array.isArray(p) && p.length >= 2 ? [String(p[0]), String(p[1])] : ["B", "R"];
  };

  const actualBoardSize = yen?.size ?? boardSize;
  const layoutMatrix    = useMemo(() => (yen?.layout ? parseLayout(yen.layout) : []), [yen]);
  const humanToken      = useMemo(() => fixedPlayers ? fixedPlayers[0] : (yen?.players?.[0] ? String(yen.players[0]) : "B"), [yen, fixedPlayers]);
  const botToken        = useMemo(() => fixedPlayers ? fixedPlayers[1] : (yen?.players?.[1] ? String(yen.players[1]) : "R"), [yen, fixedPlayers]);

  const padPx = useMemo(() => Math.round(Math.max(10, Math.min(22, winW * 0.025))), [winW]);

  const boardPx = useMemo(() => {
    const byW = Math.floor(winW - padPx * 2);
    const byH = Math.floor(winH - headerH - padPx * 3 - 36);
    return Math.max(200, Math.min(640, byW, byH));
  }, [winW, winH, headerH, padPx]);

  const boardWidth  = 540;
  const padding     = 50;
  const usableWidth = boardWidth - padding * 2;
  const cellSpacing = actualBoardSize > 1 ? usableWidth / (actualBoardSize - 1) : 0;
  const rowHeight   = cellSpacing * 0.85;
  const r           = useMemo(() => Math.max(4.5, Math.min(8.5, cellSpacing * 0.12)), [cellSpacing]);

  const clearPendingFinish = () => {
    if (finishTimerRef.current !== null) { window.clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
  };

  const applyFinishFromGateway = (payload: any, players: [string, string]) => {
    const finished = typeof payload?.finished === "boolean" ? payload.finished : false;
    if (!finished) return;

    const winnerRaw = payload?.winner ?? null;
    const winner    = winnerRaw == null ? null : String(winnerRaw);
    const edges     = normalizeEdges(payload?.winning_edges);

    if (winner && edges.length > 0) setWinOverlay({ winner, edges });
    else setWinOverlay(null);

    clearPendingFinish();
    const youWin = winner ? winner === players[0] : false;

    finishTimerRef.current = window.setTimeout(() => {
      navigate("/game/finished", {
        replace: true,
        state: { result: winner ? (youWin ? "win" : "lost") : "draw" },
      });
    }, winner ? 900 : 350);
  };

  const newGame = async () => {
    setBusy(true);
    setError(null);
    setWinOverlay(null);
    clearPendingFinish();
    fixedPlayersRef.current = null;
    setFixedPlayersState(null);

    try {
      const res  = await fetch(`${API_URL}/game/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: boardSize }),
      });
      const data = await readGatewayResponse(res);
      if (!res.ok || !data.ok) throw new Error(!data.ok ? data.error : "Game creation failed");

      const nextYen = (data as any).yen;
      const p = extractPlayers(nextYen);
      setFixedPlayers(p);
      setYen(nextYen);
      setSelected(null);
      setGameStarted(true);
      applyFinishFromGateway(data, p);
    } catch (e: any) {
      setError(e?.message ?? "Game creation failed");
    } finally {
      setBusy(false);
    }
  };

  const sendMove = async (override?: { row: number; col: number } | null) => {
    const target = override ?? selected;
    if (!target || !yen || busy) return;
    const rrow = layoutMatrix[target.row];
    if (!rrow || rrow[target.col] !== ".") return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/game/pvb/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yen, bot: botId, row: target.row, col: target.col }),
      });
      const data = await readGatewayResponse(res);
      if (!res.ok || !data.ok) throw new Error(!data.ok ? data.error : "Backend error");

      const nextYen = (data as any).yen;
      const p: [string, string] = fixedPlayersRef.current ?? extractPlayers(nextYen);
      if (!fixedPlayersRef.current) setFixedPlayers(p);

      setYen(nextYen);
      setSelected(null);
      applyFinishFromGateway(data, p);
    } catch (e: any) {
      setError(e?.message ?? "Backend error");
    } finally {
      setBusy(false);
    }
  };

  if (!username) return null;

  const overlayStroke = (token: string) => {
    if (token === humanToken) return "#1e6bb8";
    if (token === botToken)   return "#b83232";
    return "#111";
  };

  return (
    <div className="game-page">
      <Navbar username={username} onLogout={logout} />

      <main className="game-main">
        {/* Toolbar */}
        <div ref={headerRef} className="game-toolbar">
          <button
            type="button"
            className="btn btn--outline"
            style={{ padding: "8px 14px", fontSize: 13 }}
            onClick={() => navigate("/home", { state: { username } })}
          >
            ← {t("game.back")}
          </button>

          {gameMode === "bot" && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: ".5px", textTransform: "uppercase" }}>
              vs {botId.replace(/_/g, " ")}
            </span>
          )}

          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: ".5px", textTransform: "uppercase" }}>
            {boardSize}×{boardSize}
          </span>

          <button
            type="button"
            className="btn btn--primary"
            style={{ padding: "8px 16px", fontSize: 13 }}
            onClick={newGame}
            disabled={busy}
          >
            {gameStarted ? t("game.restart") ?? "New Game" : t("game.new") ?? "Start"}
          </button>

          {gameStarted && (
            <button
              type="button"
              className="btn btn--outline"
              style={{ padding: "8px 14px", fontSize: 13 }}
              onClick={() => sendMove(null)}
              disabled={!selected || busy || !yen}
            >
              {busy ? t("game.sending") : t("game.send")}
            </button>
          )}
        </div>

        {error && (
          <p className="msg msg--error" style={{ textAlign: "center" }}>{error}</p>
        )}

        {!gameStarted && (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            color: "var(--muted)",
          }}>
            <span style={{ fontSize: 48 }}>🎮</span>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, letterSpacing: ".5px" }}>
              {t("game.pressStart") ?? "Press Start to begin"}
            </p>
          </div>
        )}

        {gameStarted && (
          <div
            className="game-board-wrap"
            style={{ width: `${boardPx}px`, height: `${boardPx}px` }}
          >
            <svg
              viewBox={`0 0 ${boardWidth} ${boardWidth}`}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: "block", touchAction: "manipulation" }}
            >
              {/* Win overlay edges */}
              {winOverlay?.edges?.map(([[r1, c1], [r2, c2]], i) => {
                const row1 = layoutMatrix[r1];
                const row2 = layoutMatrix[r2];
                if (!row1 || !row2) return null;
                const ox1 = padding + ((actualBoardSize - row1.length) * cellSpacing) / 2;
                const ox2 = padding + ((actualBoardSize - row2.length) * cellSpacing) / 2;
                return (
                  <line
                    key={`we-${i}`}
                    x1={ox1 + c1 * cellSpacing}
                    y1={padding + r1 * rowHeight}
                    x2={ox2 + c2 * cellSpacing}
                    y2={padding + r2 * rowHeight}
                    stroke={overlayStroke(winOverlay.winner)}
                    strokeWidth={Math.max(3, r * 0.9)}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                );
              })}

              {/* Cells */}
              {layoutMatrix.map((row, ri) => {
                const offsetX = padding + ((actualBoardSize - row.length) * cellSpacing) / 2;
                return row.map((cell, ci) => {
                  const x = offsetX + ci * cellSpacing;
                  const y = padding + ri * rowHeight;

                  let fill = "#b0aa9f";
                  if (cell === humanToken) fill = "#1e6bb8";
                  if (cell === botToken)   fill = "#b83232";
                  const isSelected = !!selected && selected.row === ri && selected.col === ci;
                  if (isSelected && cell === ".") fill = "#d4782a";

                  const clickable = cell === "." && !busy && !!yen;

                  return (
                    <circle
                      key={`${ri}-${ci}`}
                      cx={x} cy={y} r={r}
                      fill={fill}
                      stroke="#5a5650"
                      strokeWidth={1.2}
                      onClick={() => { if (!clickable) return; setSelected({ row: ri, col: ci }); }}
                      onDoubleClick={() => { if (!clickable) return; sendMove({ row: ri, col: ci }); }}
                      style={{ cursor: clickable ? "pointer" : "default" }}
                    />
                  );
                });
              })}
            </svg>
          </div>
        )}
      </main>
    </div>
  );
};

export default Game;
