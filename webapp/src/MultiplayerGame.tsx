import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import Navbar from "./Navbar";
import { useI18n } from "./i18n/I18nProvider";

type LocationState = {
  username?: string;
  roomCode?: string;
  boardSize?: number;
  isHost?: boolean;
};

type Yen = {
  size: number;
  turn: number;
  players: string[];
  layout: string;
};

type RoomState = {
  code: string;
  size: number;
  status: "waiting" | "active" | "finished";
  yen: Yen;
  players: {
    B: { username: string } | null;
    R: { username: string } | null;
  };
};

function parseLayout(layout: string) {
  if (!layout) return [];
  return layout.split("/").map((row) => [...row]);
}

function indexToRowCol(index: number, size: number) {
  let start = 0;
  for (let row = 0; row < size; row += 1) {
    const rowLen = row + 1;
    const end = start + rowLen;
    if (index >= start && index < end) {
      return { row, col: index - start };
    }
    start = end;
  }
  return null;
}

function rowColToIndex(row: number, col: number) {
  return (row * (row + 1)) / 2 + col;
}

const CELL_SIZE = 34;
const GAP_X = 38;
const GAP_Y = 34;
const OFFSET_X = 70;
const OFFSET_Y = 60;

const MultiplayerGame: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const socketRef = useRef<Socket | null>(null);

  const state = (location.state as LocationState | null) ?? null;
  const username = state?.username ?? localStorage.getItem("username") ?? "";
  const roomCode = state?.roomCode ?? "";
  const boardSize = state?.boardSize ?? 7;

  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState<{ row: number; col: number } | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  const logout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (!username || !roomCode) {
      navigate("/multiplayer", { replace: true, state: { username } });
      return;
    }

    const socket = io("/", {
      path: "/multiplayer/socket.io",
      transports: ["websocket"]
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);

      socket.emit("join_room", { code: roomCode, username }, (response: any) => {
        if (!response?.ok) {
          setError(response?.error || t("multiplayer.error.join"));
          return;
        }
        setRoom(response.room);
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("room_updated", (data: any) => {
      if (data?.room) setRoom(data.room);
    });

    socket.on("game_started", (data: any) => {
      if (data?.room) setRoom(data.room);
    });

    socket.on("game_updated", (data: any) => {
      if (data?.room) {
        setRoom(data.room);
        setHint(null);
      }
    });

    socket.on("game_over", (data: any) => {
      if (data?.room) setRoom(data.room);
    });

    socket.on("opponent_left", () => {
      setError(t("multiplayer.opponentLeft"));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [navigate, roomCode, t, username]);

  const yen = room?.yen ?? {
    size: boardSize,
    turn: 0,
    players: ["B", "R"],
    layout: "."
  };

  const matrix = useMemo(() => parseLayout(yen.layout), [yen.layout]);

  const yourColor = useMemo(() => {
    if (!room) return null;
    if (room.players.B?.username === username) return "B";
    if (room.players.R?.username === username) return "R";
    return null;
  }, [room, username]);

  const currentTurnColor = yen.players[yen.turn];
  const isYourTurn = !!yourColor && currentTurnColor === yourColor;

  const playMove = (row: number, col: number) => {
    if (!socketRef.current || !room || !isYourTurn || room.status !== "active") return;

    socketRef.current.emit("make_move", { code: room.code, row, col }, (response: any) => {
      if (!response?.ok) {
        setError(response?.error || t("multiplayer.error.move"));
      }
    });
  };

  const askHint = async () => {
    if (!room?.yen) return;

    setHintLoading(true);
    setError("");

    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ yen: room.yen })
      });

      const data = await res.json();

      if (!res.ok || !data?.ok || !data?.coords) {
        setError(data?.error || t("multiplayer.error.hint"));
        return;
      }

      const row = data.coords.x;
      const col = data.coords.y;
      setHint({ row, col });
    } catch {
      setError(t("multiplayer.error.network"));
    } finally {
      setHintLoading(false);
    }
  };

  const leaveRoom = async () => {
    try {
      await fetch("/api/multiplayer/room/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: roomCode,
          username
        })
      });
    } catch {
      // ignore
    } finally {
      socketRef.current?.disconnect();
      navigate("/multiplayer", { replace: true, state: { username } });
    }
  };

  const size = yen.size;
  const width = OFFSET_X * 2 + size * GAP_X + 80;
  const height = OFFSET_Y * 2 + size * GAP_Y + 80;

  return (
    <div className="page">
      <Navbar username={username} onLogout={logout} />

      <main className="container">
        <section className="hero">
          <h1 className="hero__title">{t("multiplayer.gameTitle")}</h1>
          <p className="hero__subtitle">
            {t("multiplayer.roomCode")}: <strong>{roomCode}</strong> ·{" "}
            {connected ? t("multiplayer.connected") : t("multiplayer.connecting")}
          </p>

          <div className="hero__actions">
            <button className="btn btn--ghost" type="button" onClick={leaveRoom}>
              {t("multiplayer.leave")}
            </button>
          </div>
        </section>

        <section className="grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="card">
            <h2 className="card__title">{t("multiplayer.players")}</h2>
            <p className="card__text">
              B: {room?.players.B?.username ?? "—"} · R: {room?.players.R?.username ?? "—"}
            </p>
            <p className="card__text">
              {isYourTurn ? t("multiplayer.yourTurn") : t("multiplayer.opponentTurn")}
            </p>
          </article>

          <article className="card">
            <div className="game-board-area">
              <div className="game-board-wrapper">
                <svg width={width} height={height} role="img" aria-label="Game board">
                  {matrix.map((rowCells, row) =>
                    rowCells.map((cell, col) => {
                      const x = OFFSET_X + row * (GAP_X / 2) + col * GAP_X;
                      const y = OFFSET_Y + row * GAP_Y;

                      const isHint =
                        hint?.row === row && hint?.col === col;

                      const fill =
                        cell === "B"
                          ? "#3b82f6"
                          : cell === "R"
                            ? "#ef4444"
                            : "var(--board-cell-empty-fill)";

                      return (
                        <g
                          key={`${row}-${col}`}
                          onClick={() => cell === "." && playMove(row, col)}
                          style={{
                            cursor: cell === "." && isYourTurn ? "pointer" : "default"
                          }}
                        >
                          <circle
                            cx={x}
                            cy={y}
                            r={CELL_SIZE / 2}
                            fill={fill}
                            stroke="var(--board-cell-token-stroke)"
                            strokeWidth={isHint ? 4 : 2}
                            opacity={isHint ? 0.9 : 1}
                          />
                        </g>
                      );
                    })
                  )}
                </svg>
              </div>

              <div className="game-side-panel">
                <button
                  type="button"
                  className="game-hint-btn"
                  onClick={askHint}
                  disabled={hintLoading || !room}
                >
                  {hintLoading ? t("game.hintLoading") : t("game.hint")}
                </button>
              </div>
            </div>

            {error ? <p className="error-message">{error}</p> : null}
          </article>
        </section>
      </main>
    </div>
  );
};

export default MultiplayerGame;