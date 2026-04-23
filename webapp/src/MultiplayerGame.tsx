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

type WinningEdge = [[number, number], [number, number]];

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

type SocketMoveResponse = {
  ok: boolean;
  room?: RoomState;
  finished?: boolean;
  winner?: string | null;
  winningEdges?: WinningEdge[];
  error?: string;
};

function parseLayout(layout: string) {
  if (!layout) return [];
  return layout.split("/").map((row) => [...row]);
}

function buildEmptyLayout(size: number) {
  return Array.from({ length: size }, (_, row) => ".".repeat(row + 1)).join("/");
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
      [Number(e[1][0]), Number(e[1][1])]
    ]);
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

const HINT_DURATION_MS = 2500;
const MULTIPLAYER_URL =
  import.meta.env.VITE_MULTIPLAYER_URL ?? "http://localhost:7000";
const MULTIPLAYER_SOCKET_PATH =
  import.meta.env.VITE_MULTIPLAYER_SOCKET_PATH ?? "/socket.io";

const MultiplayerGame: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const socketRef = useRef<Socket | null>(null);
  const hintTimerRef = useRef<number | null>(null);
  const multiplayerResultSavedRef = useRef(false);

  const state = (location.state as LocationState | null) ?? null;
  const username = state?.username ?? localStorage.getItem("username") ?? "";
  const roomCode = state?.roomCode ?? "";
  const boardSizeFromState = state?.boardSize ?? 7;

  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [hintCell, setHintCell] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [winningPath, setWinningPath] = useState<{
    winner: string;
    cells: Set<string>;
  } | null>(null);
  const [gameOver, setGameOver] = useState<{
    result: "win" | "lost" | "draw";
    winner: string | null;
  } | null>(null);

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

    multiplayerResultSavedRef.current = false;

    const socket = io(MULTIPLAYER_URL, {
      path: MULTIPLAYER_SOCKET_PATH,
      transports: ["websocket"]
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setError("");

      socket.emit("join_room", { code: roomCode, username }, (response: any) => {
        if (!response?.ok) {
          setError(response?.error || t("multiplayer.error.join"));
          return;
        }
        setRoom(response.room);
      });
    });

    socket.on("connect_error", () => {
      setConnected(false);
      setError(t("multiplayer.error.network"));
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
      const nextRoom = data?.room ?? null;

      if (nextRoom) {
        setRoom(nextRoom);
        setHintCell(null);
      }

      if (data?.finished) {
        const winner = data?.winner != null ? String(data.winner) : null;
        const winningCells = buildWinningCellSet(data?.winningEdges);

        setWinningPath(
          winner && winningCells.size > 0 ? { winner, cells: winningCells } : null
        );

        const myColor = yourColorRef(nextRoom ?? room, username);
        const didIWin = winner ? winner === myColor : false;

        setGameOver({
          result: winner ? (didIWin ? "win" : "lost") : "draw",
          winner
        });

        if (winner) {
          saveMultiplayerGameResult(nextRoom ?? room, winner);
        }
      }
    });

    socket.on("game_over", (data: any) => {
      const nextRoom = data?.room ?? null;

      if (nextRoom) {
        setRoom(nextRoom);
      }

      const winner = data?.winner != null ? String(data.winner) : null;
      const winningCells = buildWinningCellSet(data?.winningEdges);

      setWinningPath(
        winner && winningCells.size > 0 ? { winner, cells: winningCells } : null
      );

      const myColor = yourColorRef(nextRoom ?? room, username);
      const didIWin = winner ? winner === myColor : false;

      setGameOver({
        result: winner ? (didIWin ? "win" : "lost") : "draw",
        winner
      });

      if (winner) {
        saveMultiplayerGameResult(nextRoom ?? room, winner);
      }
    });

    socket.on("opponent_left", () => {
      setError(t("multiplayer.opponentLeft"));
    });

    return () => {
      if (hintTimerRef.current !== null) {
        window.clearTimeout(hintTimerRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [navigate, roomCode, t, username]);

  const yen = room?.yen ?? {
    size: boardSizeFromState,
    turn: 0,
    players: ["B", "R"],
    layout: buildEmptyLayout(boardSizeFromState)
  };

  const layoutMatrix = useMemo(() => parseLayout(yen.layout), [yen.layout]);

  const yourColor = useMemo(() => {
    if (!room) return null;
    if (room.players.B?.username === username) return "B";
    if (room.players.R?.username === username) return "R";
    return null;
  }, [room, username]);

  const currentTurnColor = yen.players[yen.turn];
  const isYourTurn =
    !!yourColor && currentTurnColor === yourColor && room?.status === "active" && !gameOver;

  const boardSize = yen.size;
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

  const boardPx = 640;

  function yourColorRef(nextRoom: RoomState | null | undefined, currentUsername: string) {
    if (!nextRoom) return null;
    if (nextRoom.players.B?.username === currentUsername) return "B";
    if (nextRoom.players.R?.username === currentUsername) return "R";
    return null;
  }

  const clearHint = () => {
    setHintCell(null);
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  };

  const playMove = (row: number, col: number) => {
    if (!socketRef.current || !room || !isYourTurn) return;

    clearHint();
    setError("");

    socketRef.current.emit(
      "make_move",
      { code: room.code, row, col },
      (response: SocketMoveResponse) => {
        if (!response?.ok) {
          setError(response?.error || t("multiplayer.error.move"));
        }
      }
    );
  };

  const askHint = async () => {
    if (!room?.yen || gameOver) return;

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

      const size = room.yen.size;
      const row = size - 1 - data.coords.x;
      const col = data.coords.y;
      const key = `${row}-${col}`;

      setHintCell(key);

      if (hintTimerRef.current !== null) {
        window.clearTimeout(hintTimerRef.current);
      }

      hintTimerRef.current = window.setTimeout(() => {
        setHintCell(null);
        hintTimerRef.current = null;
      }, HINT_DURATION_MS);
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

  const saveMultiplayerGameResult = async (
    finalRoom: RoomState | null,
    winnerColor: string | null
  ) => {
    if (!finalRoom || multiplayerResultSavedRef.current) return;

    const player1 = finalRoom.players.B?.username;
    const player2 = finalRoom.players.R?.username;

    if (!player1 || !player2 || !winnerColor) return;

    const winnerUsername =
      winnerColor === "B"
        ? finalRoom.players.B?.username
        : winnerColor === "R"
          ? finalRoom.players.R?.username
          : null;

    if (!winnerUsername) return;

    multiplayerResultSavedRef.current = true;

    try {
      await fetch("/api/gameresult/multiplayer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          player1,
          player2,
          winner: winnerUsername,
          boardSize: finalRoom.yen.size
        })
      });
    } catch {
      // silencioso, igual que en PvB
    }
  };

  const winnerUsername =
    gameOver?.winner === "B"
      ? room?.players.B?.username ?? "—"
      : gameOver?.winner === "R"
        ? room?.players.R?.username ?? "—"
        : null;

  const getCellFill = (cell: string, row: number, col: number) => {
    const key = `${row}-${col}`;
    const isWin = !!winningPath?.cells.has(key);

    if (hintCell === key && cell === ".") return "rgba(254,235,160,0.55)";
    if (cell === "B") return isWin ? "#7fd3ff" : "#1e88e5";
    if (cell === "R") return isWin ? "#ff8a80" : "#d32f2f";
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

  if (!username) return null;

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
              {t("multiplayer.playerOne")}: {room?.players.B?.username ?? "—"}
            </p>

            <p className="card__text">
              {t("multiplayer.playerTwo")}: {room?.players.R?.username ?? "—"}
            </p>

            <p className="card__text">
              {isYourTurn ? t("multiplayer.yourTurn") : t("multiplayer.opponentTurn")}
            </p>
          </article>

          <article className="card">
            <div className="game-board-area">
              <div
                className="game-board-wrapper"
                style={{ width: `${boardPx}px`, height: `${boardPx}px` }}
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
                      const key = `${rowIndex}-${colIndex}`;
                      const clickable = cell === "." && isYourTurn;
                      const isHinted = hintCell === key;

                      return (
                        <polygon
                          key={key}
                          points={getHexagonPoints(x, y, pieceRadius)}
                          fill={getCellFill(cell, rowIndex, colIndex)}
                          stroke={getCellStroke(cell, rowIndex, colIndex)}
                          strokeWidth={getCellStrokeWidth(rowIndex, colIndex)}
                          onClick={() => {
                            if (clickable) playMove(rowIndex, colIndex);
                          }}
                          style={{
                            cursor: clickable ? "pointer" : "default",
                            transition: "fill 180ms ease, stroke 180ms ease, opacity 120ms ease",
                            opacity: cell === "." && clickable ? 0.95 : 1,
                            animation: isHinted
                              ? "hint-pulse 0.7s ease-in-out infinite alternate"
                              : "none"
                          }}
                        />
                      );
                    });
                  })}
                </svg>
              </div>

              {!gameOver && (
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
              )}
            </div>

            {error ? <p className="error-message">{error}</p> : null}
          </article>
        </section>

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
              justifyContent: "center"
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, rgba(18,24,38,.78), rgba(18,24,38,.62))",
                border: "1px solid rgba(255,255,255,.18)",
                borderRadius: 20,
                padding: "40px 48px",
                textAlign: "center",
                boxShadow: "0 24px 60px rgba(0,0,0,.6)",
                display: "flex",
                flexDirection: "column",
                gap: 24,
                minWidth: 260
              }}
            >
              <div style={{ fontSize: 56 }}>
                {gameOver.result === "win" ? "🏆" : gameOver.result === "lost" ? "💀" : "🤝"}
              </div>

              <h2 style={{ margin: 0, fontSize: 28, color: "white" }}>
                {gameOver.result === "win"
                  ? t("game.finished.win")
                  : gameOver.result === "lost"
                    ? t("game.finished.lost")
                    : t("game.finished.draw")}
              </h2>

              {winnerUsername ? (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  {t("multiplayer.winner")}: {winnerUsername}
                </p>
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap"
                }}
              >
                <button
                  onClick={() => navigate("/multiplayer", { state: { username } })}
                  style={{
                    padding: "12px 22px",
                    borderRadius: 12,
                    background: "#A52019",
                    color: "white",
                    border: "none",
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: "pointer"
                  }}
                >
                  {t("game.finished.back")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MultiplayerGame;