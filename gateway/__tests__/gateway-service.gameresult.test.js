// ============================================================
// NUEVOS TESTS — Issue #59: Persistir resultados de partidas
// Añadir al final de gateway-service.test.js
// ============================================================
// Cubren:
//   - POST /gameresult en el gateway (nueva ruta)
//   - Reenvío correcto al users service
//   - Manejo de errores (502, propagación de errores del users service)
// ============================================================

import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../gateway-service.js";
import axios from "axios";

vi.mock("axios");

describe("Gateway — POST /gameresult", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should forward game result to users service and return 201", async () => {
        axios.post.mockResolvedValueOnce({
            status: 201,
            data: {
                success: true,
                message: "Game result saved",
                game: {
                    username: "Pablo",
                    opponent: "minimax_bot",
                    result: "win",
                    winner: "Pablo",
                    score: 5,
                    boardSize: 7,
                    gameMode: "pvb"
                }
            }
        });

        const res = await request(app)
            .post("/gameresult")
            .send({
                username: "Pablo",
                opponent: "minimax_bot",
                result: "win",
                winner: "Pablo",
                score: 5,
                boardSize: 7,
                gameMode: "pvb"
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/Game result saved/i);
        expect(res.body.game).toHaveProperty("username", "Pablo");
        expect(res.body.game).toHaveProperty("boardSize", 7);
        expect(res.body.game).toHaveProperty("gameMode", "pvb");
        expect(res.body.game).toHaveProperty("winner", "Pablo");
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringMatching(/\/gameresult$/),
            expect.objectContaining({
                username: "Pablo",
                opponent: "minimax_bot",
                result: "win"
            })
        );
    });

    it("should forward game result with loss result", async () => {
        axios.post.mockResolvedValueOnce({
            status: 201,
            data: {
                success: true,
                message: "Game result saved",
                game: {
                    username: "Pablo",
                    opponent: "minimax_bot",
                    result: "loss",
                    winner: "minimax_bot",
                    score: 3,
                    boardSize: 9,
                    gameMode: "pvb"
                }
            }
        });

        const res = await request(app)
            .post("/gameresult")
            .send({
                username: "Pablo",
                opponent: "minimax_bot",
                result: "loss",
                winner: "minimax_bot",
                score: 3,
                boardSize: 9,
                gameMode: "pvb"
            });

        expect(res.status).toBe(201);
        expect(res.body.game).toHaveProperty("result", "loss");
        expect(res.body.game).toHaveProperty("winner", "minimax_bot");
        expect(res.body.game).toHaveProperty("boardSize", 9);
    });

    it("should return 404 when user does not exist in users service", async () => {
        axios.post.mockRejectedValueOnce({
            response: {
                status: 404,
                data: { success: false, error: "The user Pablo does not exist" }
            }
        });

        const res = await request(app)
            .post("/gameresult")
            .send({
                username: "Pablo",
                opponent: "minimax_bot",
                result: "win",
                score: 5
            });

        expect(res.status).toBe(404);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/does not exist/i);
    });

    it("should return 400 when mandatory fields are missing", async () => {
        axios.post.mockRejectedValueOnce({
            response: {
                status: 400,
                data: { success: false, error: "The are absent field/s : username, opponent, result are mandatory" }
            }
        });

        const res = await request(app)
            .post("/gameresult")
            .send({
                username: "Pablo"
            });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/mandatory/i);
    });

    it("should return 502 when users service is unavailable", async () => {
        axios.post.mockRejectedValueOnce(new Error("Service down"));

        const res = await request(app)
            .post("/gameresult")
            .send({
                username: "Pablo",
                opponent: "minimax_bot",
                result: "win",
                score: 5
            });

        expect(res.status).toBe(502);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Users service unavailable/i);
    });

    it("should return 500 when users service returns internal error", async () => {
        axios.post.mockRejectedValueOnce({
            response: {
                status: 500,
                data: { success: false, error: "Internal server error" }
            }
        });

        const res = await request(app)
            .post("/gameresult")
            .send({
                username: "Pablo",
                opponent: "minimax_bot",
                result: "win",
                score: 5
            });

        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
    });

    it("should forward all new fields to users service", async () => {
        axios.post.mockResolvedValueOnce({
            status: 201,
            data: { success: true, message: "Game result saved", game: {} }
        });

        await request(app)
            .post("/gameresult")
            .send({
                username: "Pablo",
                opponent: "monte_carlo_hard",
                result: "win",
                winner: "Pablo",
                score: 8,
                boardSize: 11,
                gameMode: "pvb"
            });

        expect(axios.post).toHaveBeenCalledWith(
            expect.stringMatching(/\/gameresult$/),
            expect.objectContaining({
                winner: "Pablo",
                boardSize: 11,
                gameMode: "pvb",
                score: 8
            })
        );
    });
});
