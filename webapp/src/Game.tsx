import React, { useMemo, useState } from "react";

type BotId = "random_bot" | "smart_bot";

type GatewayResponse =
  | { ok: true; yen?: any; message?: string }
  | { ok: false; error: string; details?: any };

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

const HUMAN = "B";
const BOT = "R";

function pretty(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

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

const Game: React.FC = () => {
  const [yen, setYen] = useState<any>(null);
  const [botId] = useState<BotId>("random_bot");
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const boardSize = yen?.size ?? 7;

  const layoutMatrix = useMemo(() => {
    if (!yen?.layout) return [];
    return parseLayout(yen.layout);
  }, [yen]);

  const boardWidth = 540;
  const padding = 50;
  const usableWidth = boardWidth - padding * 2;
  const cellSpacing = usableWidth / (boardSize - 1);
  const rowHeight = cellSpacing * 0.85;

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

      if (!res.ok || !data.ok) {
        throw new Error(!data.ok ? data.error : "Game creation failed");
      }

      setYen(data.yen);
      setSelected(null);
    } catch (e: any) {
      setError(e?.message ?? "Game creation failed");
    } finally {
      setBusy(false);
    }
  };

  const sendMove = async () => {
    if (!selected || !yen || busy) return;

    const row = layoutMatrix[selected.row];
    if (!row || row[selected.col] !== ".") return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/game/pvb/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yen,
          bot: botId,
          row: selected.row,
          col: selected.col,
        }),
      });

      const data = await readGatewayResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(!data.ok ? data.error : "Backend error");
      }

      setYen(data.yen);
      setSelected(null);
    } catch (e: any) {
      setError(e?.message ?? "Backend error");
    } finally {
      setBusy(false);
    }
  };

  const checkConnection = async () => {
    setHealthStatus(null);
    setHealthError(null);

    try {
      const res = await fetch(`${API_URL}/game/status`);
      const data = await readGatewayResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(!data.ok ? data.error : "Connection failed");
      }

      setHealthStatus(data.message ?? "OK");
    } catch (e: any) {
      setHealthError(e?.message ?? "Connection failed");
    }
  };

  return (
    <div style={{ padding: 30, fontFamily: "system-ui" }}>
      <h1 style={{ textAlign: "center" }}>GameY</h1>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 15 }}>
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
          Nueva partida
        </button>

        <button
          onClick={sendMove}
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
          {busy ? "Enviando…" : "Enviar jugada"}
        </button>
      </div>

      {error && (
        <div style={{ color: "red", textAlign: "center", marginBottom: 10, fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg
          width={boardWidth}
          height={boardWidth}
          style={{
            background: "linear-gradient(135deg, #FCF5E3, #F5F5F5)",
            borderRadius: 18,
          }}
        >
          {layoutMatrix.map((row, rowIndex) => {
            const offsetX = padding + ((boardSize - row.length) * cellSpacing) / 2;

            return row.map((cell, colIndex) => {
              const x = offsetX + colIndex * cellSpacing;
              const y = padding + rowIndex * rowHeight;

              let fill = "#9e9e9e";
              if (cell === HUMAN) fill = "#1e88e5";
              if (cell === BOT) fill = "#d32f2f";

              if (
                selected &&
                selected.row === rowIndex &&
                selected.col === colIndex &&
                cell === "."
              ) {
                fill = "#FF681F";
              }

              const clickable = cell === "." && !busy && !!yen;

              return (
                <circle
                  key={`${rowIndex}-${colIndex}`}
                  cx={x}
                  cy={y}
                  r={7}
                  fill={fill}
                  stroke="#3B3B3B"
                  strokeWidth={1.5}
                  onClick={() => {
                    if (clickable) setSelected({ row: rowIndex, col: colIndex });
                  }}
                  style={{ cursor: clickable ? "pointer" : "default" }}
                />
              );
            });
          })}
        </svg>
      </div>

      <div style={{ marginTop: 20 }}>
        <strong>Debug YEN</strong>
        <pre style={{ background: "#f0f0f0", padding: 12, borderRadius: 12 }}>
          {yen ? pretty(yen) : "∅"}
        </pre>
      </div>

      {/* Health Check Section */}
      <div style={{ marginTop: 30, textAlign: "center" }}>
        <button
          onClick={checkConnection}
          style={{
            padding: "8px 14px",
            borderRadius: 12,
            background: "#2e7d32",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Comprobar conexión GameY
        </button>

        {healthStatus && (
          <div style={{ marginTop: 10, color: "green", fontWeight: 600 }}>
            Conectado correctamente → {healthStatus}
          </div>
        )}

        {healthError && (
          <div style={{ marginTop: 10, color: "red", fontWeight: 600 }}>
            Error de conexión → {healthError}
          </div>
        )}
      </div>
    </div>
  );
};

export default Game;