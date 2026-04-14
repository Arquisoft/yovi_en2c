"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidYen = assertValidYen;
exports.detectSingleAddedMove = detectSingleAddedMove;
exports.applyMoveToYen = applyMoveToYen;
exports.computeStatusFromPvbResponse = computeStatusFromPvbResponse;
exports.normalizeStatus = normalizeStatus;
function assertValidYen(yen) {
    if (!yen) {
        throw new Error("YEN is required");
    }
    if (!Number.isInteger(yen.size) || yen.size < 1) {
        throw new Error("YEN.size must be a positive integer");
    }
    if (!Number.isInteger(yen.turn) || yen.turn < 0) {
        throw new Error("YEN.turn must be a non-negative integer");
    }
    if (!Array.isArray(yen.players) || yen.players.length < 2) {
        throw new Error("YEN.players must contain at least two players");
    }
    if (typeof yen.layout !== "string" || yen.layout.trim() === "") {
        throw new Error("YEN.layout is required");
    }
    const rows = splitRows(yen.layout);
    if (rows.length !== yen.size) {
        throw new Error(`YEN.layout must contain ${yen.size} rows`);
    }
    for (let row = 0; row < rows.length; row += 1) {
        const expectedLength = row + 1;
        if (rows[row].length !== expectedLength) {
            throw new Error(`YEN row ${row} must have length ${expectedLength}, got ${rows[row].length}`);
        }
    }
}
function detectSingleAddedMove(previous, proposed) {
    assertValidYen(previous);
    assertValidYen(proposed);
    if (previous.size !== proposed.size) {
        throw new Error("proposed position has different size");
    }
    if (previous.players.join(",") !== proposed.players.join(",")) {
        throw new Error("proposed position has different players");
    }
    const oldRows = splitRows(previous.layout);
    const newRows = splitRows(proposed.layout);
    const currentPlayerToken = previous.players[previous.turn];
    if (!currentPlayerToken) {
        throw new Error("current player token does not exist");
    }
    let detected = null;
    for (let row = 0; row < oldRows.length; row += 1) {
        for (let col = 0; col < oldRows[row].length; col += 1) {
            const oldCell = oldRows[row][col];
            const newCell = newRows[row][col];
            if (oldCell === newCell) {
                continue;
            }
            if (oldCell !== ".") {
                throw new Error("proposed position overwrites an occupied cell");
            }
            if (newCell !== currentPlayerToken) {
                throw new Error(`proposed position must add exactly one '${currentPlayerToken}' token`);
            }
            if (detected !== null) {
                throw new Error("proposed position contains more than one new move");
            }
            detected = {
                row,
                col,
                token: newCell
            };
        }
    }
    if (detected === null) {
        throw new Error("proposed position does not contain any new move");
    }
    return detected;
}
function applyMoveToYen(yen, coords) {
    assertValidYen(yen);
    const row = yen.size - 1 - coords.x;
    const col = coords.y;
    const rows = splitRows(yen.layout);
    if (row < 0 || row >= rows.length) {
        throw new Error("bot returned invalid row coordinate");
    }
    if (col < 0 || col >= rows[row].length) {
        throw new Error("bot returned invalid col coordinate");
    }
    if (rows[row][col] !== ".") {
        throw new Error("bot returned a move on an occupied cell");
    }
    const token = yen.players[yen.turn];
    if (!token) {
        throw new Error("current player token does not exist");
    }
    rows[row][col] = token;
    return {
        ...yen,
        turn: (yen.turn + 1) % yen.players.length,
        layout: joinRows(rows)
    };
}
function computeStatusFromPvbResponse(result) {
    if (!result.finished) {
        return "ONGOING";
    }
    if (!result.winner) {
        return "DRAW";
    }
    const opponentToken = result.yen.players[0];
    const botToken = result.yen.players[1];
    if (result.winner === botToken) {
        return "BOT_WON";
    }
    if (result.winner === opponentToken) {
        return "OPPONENT_WON";
    }
    return "DRAW";
}
function normalizeStatus(status) {
    return status;
}
function splitRows(layout) {
    return layout.split("/").map((row) => row.split(""));
}
function joinRows(rows) {
    return rows.map((row) => row.join("")).join("/");
}
