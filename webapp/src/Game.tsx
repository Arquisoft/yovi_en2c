import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";

type BotId = "random_bot" | "smart_bot";
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

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

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
    .map((e: any) => [
      [Number(e[0][0]), Number(e[0][1])],
      [Number(e[1][0]), Number(e[1][1])],
    ]);
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
  const [botId] = useState<BotId>("random_bot");
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FIX: use both a ref (always current, safe inside async closures) and state
  // (drives re-renders for color display). The ref solves the stale closure problem
  // where async functions capture fixedPlayers as null even after setFixedPlayers was called.
  const [fixedPlayers, setFixedPlayersState] = useState<[string, string] | null>(null);
  const fixedPlayersRef = useRef<[string, string] | null>(null);

  const setFixedPlayers = (p: [string, string]) => {
    fixedPlayersRef.current = p;
    setFixedPlayersState(p);
  };

  const { w: winW, h: winH } = useWindowSize();

  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);

  const [winOverlay, setWinOverlay] = useState<{
    winner: string;
    edges: WinningEdge[];
  } | null>(null);

  const finishTimerRef = React.useRef<number | null>(null);

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

  // Helper: extract [humanToken, botToken] from a YEN object
  const extractPlayers = (nextYen: any): [string, string] => {
    const p = nextYen?.players;
    if (Array.isArray(p) && p.length >= 2) {
      return [String(p[0]), String(p[1])];
    }
    return ["B", "R"];
  };

  const boardSize = yen?.size ?? 7;

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

  const r = useMemo(() => {
    const rr = cellSpacing * 0.12;
    return Math.max(5.5, Math.min(8.5, rr));
  }, [cellSpacing]);

  const padPx = useMemo(() => Math.round(Math.max(12, Math.min(28, winW * 0.03))), [winW]);

  const bottomGutter = 28;
  const extraSafety = 10;

  const boardPx = useMemo(() => {
    const byWidth = Math.floor(winW - padPx * 2);
    const byHeight = Math.floor(winH - headerH - padPx * 3 - bottomGutter - extraSafety - 20);
    return Math.max(220, Math.min(680, byWidth, byHeight));
  }, [winW, winH, headerH, padPx]);

  const isEmptyCell = (row: number, col: number) => {
    const rrow = layoutMatrix[row];
    return !!rrow && rrow[col] === ".";
  };

  const clearPendingFinish = () => {
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  const applyFinishFromGateway = (payload: any, playersFixed: [string, string]) => {
    const finished = typeof payload?.finished === "boolean" ? payload.finished : false;
    if (!finished) return;

    const winnerRaw = payload?.winner ?? null;
    const winner = winnerRaw == null ? null : String(winnerRaw);

    const edges = normalizeEdges(payload?.winning_edges);

    if (winner && edges.length > 0) setWinOverlay({ winner, edges });
    else setWinOverlay(null);

    clearPendingFinish();

    const youWin = winner ? winner === playersFixed[0] : false;

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
      const res = await fetch(`${API_URL}/game/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: 7 }),
      });

      const data = await readGatewayResponse(res);
      if (!res.ok || !data.ok) throw new Error(!data.ok ? data.error : "Game creation failed");

      const nextYen = (data as any).yen;
      const p = extractPlayers(nextYen);

      // setFixedPlayers updates BOTH the ref (immediately) and the state (next render)
      setFixedPlayers(p);
      setYen(nextYen);
      setSelected(null);

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
    if (!isEmptyCell(target.row, target.col)) return;

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
    if (token === humanToken) return "#1e88e5";
    if (token === botToken) return "#d32f2f";
    return "#111";
  };

  return (
    <div className="page" style={{ height: "100dvh", overflow: "auto", display: "flex", flexDirection: "column" }}>
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

          <h1 style={{ margin: 0, textAlign: "center", paddingTop: 6 }}>{t("app.brand")}</h1>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
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
              }}
            >
              {t("game.new")}
            </button>

            <button
              onClick={() => sendMove(null)}
              disabled={!selected || busy || !yen}
              style={{
                padding: "8px 14px",
                borderRadius: 12,
                background: "#FF681F",
                color: "white",
                border: "none",
                opacity: !selected || busy || !yen ? 0.5 : 1,
                cursor: !selected || busy || !yen ? "not-allowed" : "pointer",
              }}
            >
              {busy ? t("game.sending") : t("game.send")}
            </button>
          </div>

          {error && <div style={{ color: "red", textAlign: "center", fontWeight: 600, marginTop: 10 }}>{error}</div>}
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
            {/* Winner overlay */}
            {winOverlay?.edges?.map(([[r1, c1], [r2, c2]], i) => {
              const row1 = layoutMatrix[r1];
              const row2 = layoutMatrix[r2];
              if (!row1 || !row2) return null;

              const offsetX1 = padding + ((boardSize - row1.length) * cellSpacing) / 2;
              const offsetX2 = padding + ((boardSize - row2.length) * cellSpacing) / 2;

              const x1 = offsetX1 + c1 * cellSpacing;
              const y1 = padding + r1 * rowHeight;
              const x2 = offsetX2 + c2 * cellSpacing;
              const y2 = padding + r2 * rowHeight;

              return (
                <line
                  key={`wedge-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={overlayStroke(winOverlay.winner)}
                  strokeWidth={Math.max(3, r * 0.95)}
                  strokeLinecap="round"
                  opacity={0.85}
                />
              );
            })}

            {layoutMatrix.map((row, rowIndex) => {
              const offsetX = padding + ((boardSize - row.length) * cellSpacing) / 2;

              return row.map((cell, colIndex) => {
                const x = offsetX + colIndex * cellSpacing;
                const y = padding + rowIndex * rowHeight;

                let fill = "#9e9e9e";
                if (cell === humanToken) fill = "#1e88e5";
                if (cell === botToken) fill = "#d32f2f";

                const isSelected = !!selected && selected.row === rowIndex && selected.col === colIndex;
                if (isSelected && cell === ".") fill = "#FF681F";

                const clickable = cell === "." && !busy && !!yen;

                return (
                  <circle
                    key={`${rowIndex}-${colIndex}`}
                    cx={x}
                    cy={y}
                    r={r}
                    fill={fill}
                    stroke="#3B3B3B"
                    strokeWidth={1.5}
                    onClick={() => {
                      if (!clickable) return;
                      setSelected({ row: rowIndex, col: colIndex });
                    }}
                    onDoubleClick={() => {
                      if (!clickable) return;
                      sendMove({ row: rowIndex, col: colIndex });
                    }}
                    style={{ cursor: clickable ? "pointer" : "default" }}
                  />
                );
              });
            })}
          </svg>
        </div>
      </main>
    </div>
  );
};

export default Game;