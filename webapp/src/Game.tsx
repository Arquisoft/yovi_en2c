import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";

type BotId = "random_bot" | "smart_bot";

type GatewayResponse =
  | { ok: true; yen?: any; message?: string }
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

function computeWinner(layoutMatrix: string[][], token: string): string | null {
  const n = layoutMatrix.length;
  if (n === 0) return null;

  const key = (r: number, c: number) => `${r},${c}`;

  const inBounds = (r: number, c: number) =>
    r >= 0 && r < n && c >= 0 && c < (layoutMatrix[r]?.length ?? 0);

  const neighbors = (r: number, c: number) => {
    const cand: Array<[number, number]> = [
      [r, c - 1],
      [r, c + 1],
      [r - 1, c - 1],
      [r - 1, c],
      [r + 1, c],
      [r + 1, c + 1],
    ];
    return cand.filter(([rr, cc]) => inBounds(rr, cc));
  };

  const visited = new Set<string>();

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < (layoutMatrix[r]?.length ?? 0); c++) {
      if (layoutMatrix[r][c] !== token) continue;
      const k = key(r, c);
      if (visited.has(k)) continue;

      let touchesLeft = false;
      let touchesRight = false;
      let touchesBottom = false;

      const queue: Array<[number, number]> = [[r, c]];
      visited.add(k);

      while (queue.length > 0) {
        const [rr, cc] = queue.shift()!;

        if (cc === 0) touchesLeft = true;
        if (cc === layoutMatrix[rr].length - 1) touchesRight = true;
        if (rr === n - 1) touchesBottom = true;

        if (touchesLeft && touchesRight && touchesBottom) return token;

        for (const [nr, nc] of neighbors(rr, cc)) {
          if (layoutMatrix[nr][nc] !== token) continue;
          const nk = key(nr, nc);
          if (visited.has(nk)) continue;
          visited.add(nk);
          queue.push([nr, nc]);
        }
      }
    }
  }

  return null;
}

function computeGameResult(layoutMatrix: string[][], players: string[]) {
  const p0 = players?.[0] ?? "B";
  const p1 = players?.[1] ?? "R";

  const w0 = computeWinner(layoutMatrix, p0);
  if (w0) return { finished: true, winner: w0 };

  const w1 = computeWinner(layoutMatrix, p1);
  if (w1) return { finished: true, winner: w1 };

  const anyEmpty = layoutMatrix.some((row) => row.some((cell) => cell === "."));
  return { finished: !anyEmpty, winner: null as string | null };
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

  const { w: winW, h: winH } = useWindowSize();

  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const update = () => setHeaderH(el.getBoundingClientRect().height);
    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const boardSize = yen?.size ?? 7;

  const layoutMatrix = useMemo(() => {
    if (!yen?.layout) return [];
    return parseLayout(yen.layout);
  }, [yen]);

  const humanToken = useMemo(() => (yen?.players?.[0] ? String(yen.players[0]) : "B"), [yen]);
  const botToken = useMemo(() => (yen?.players?.[1] ? String(yen.players[1]) : "R"), [yen]);

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

  const goFinishedIfNeeded = (nextYen: any) => {
    const nextLayout = nextYen?.layout ? parseLayout(nextYen.layout) : [];
    const players = (nextYen?.players ?? [humanToken, botToken]).map((x: any) => String(x));
    const { finished, winner } = computeGameResult(nextLayout, players);

    if (!finished) return;

    const youWin = winner === String(players[0]);
    navigate("/game/finished", {
      replace: true,
      state: { result: winner ? (youWin ? "win" : "lost") : "draw" },
    });
  };

  const newGame = async () => {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/game/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: 7 }),
      });

      const data = await readGatewayResponse(res);

      if (!res.ok || !data.ok) throw new Error(!data.ok ? data.error : "Game creation failed");

      setYen(data.yen);
      setSelected(null);
      goFinishedIfNeeded(data.yen);
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

      setYen(data.yen);
      setSelected(null);
      goFinishedIfNeeded(data.yen);
    } catch (e: any) {
      setError(e?.message ?? "Backend error");
    } finally {
      setBusy(false);
    }
  };

  if (!username) return null;

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
          style={{ width: "100%", maxWidth: 980, display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          <h1 style={{ margin: 0, textAlign: "center" }}>{t("app.brand")}</h1>

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