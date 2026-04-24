jest.mock("../gamey-client", () => ({
  createNewGame: jest.fn(),
  applyPvpMove: jest.fn()
}));

process.env.NODE_ENV = "test";

const { io: Client } = require("socket.io-client");
const { createNewGame, applyPvpMove } = require("../gamey-client");
const { server, rooms } = require("../multiplayer-service");

function connectClient(port) {
  return new Promise((resolve, reject) => {
    const client = new Client(`http://localhost:${port}`, {
      transports: ["websocket"],
      forceNew: true
    });

    client.on("connect", () => resolve(client));
    client.on("connect_error", reject);
  });
}

function emitWithAck(client, event, payload) {
  return new Promise((resolve) => {
    client.emit(event, payload, (response) => resolve(response));
  });
}

describe("multiplayer-service sockets", () => {
  let httpServer;
  let port;
  let clientA;
  let clientB;

  beforeAll((done) => {
    httpServer = server.listen(0, () => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    httpServer.close(done);
  });

  beforeEach(() => {
    rooms.rooms.clear();
    rooms.socketToRoom.clear();
    jest.clearAllMocks();
    clientA = null;
    clientB = null;
  });

  afterEach(() => {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
  });

  test("socket create_room creates room", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    clientA = await connectClient(port);

    const res = await emitWithAck(clientA, "create_room", {
      username: "Alice",
      size: 3
    });

    expect(res.ok).toBe(true);
    expect(res.room.players.B.username).toBe("Alice");
    expect(res.yourColor).toBe("B");
  });

  test("socket join_room joins existing room", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    clientA = await connectClient(port);
    const createRes = await emitWithAck(clientA, "create_room", {
      username: "Alice",
      size: 3
    });

    const code = createRes.room.code;

    clientB = await connectClient(port);
    const joinRes = await emitWithAck(clientB, "join_room", {
      code,
      username: "Bob"
    });

    expect(joinRes.ok).toBe(true);
    expect(joinRes.room.players.R.username).toBe("Bob");
    expect(joinRes.yourColor).toBe("R");
  });

  test("socket make_move updates room state", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    applyPvpMove.mockResolvedValue({
      yen: { size: 3, turn: 1, players: ["B", "R"], layout: "B/../..." },
      finished: false,
      winner: null,
      winning_edges: []
    });

    clientA = await connectClient(port);
    const createRes = await emitWithAck(clientA, "create_room", {
      username: "Alice",
      size: 3
    });

    const code = createRes.room.code;

    clientB = await connectClient(port);
    await emitWithAck(clientB, "join_room", {
      code,
      username: "Bob"
    });

    const moveRes = await emitWithAck(clientA, "make_move", {
      code,
      row: 0,
      col: 0
    });

    expect(moveRes.ok).toBe(true);
    expect(moveRes.room.yen.layout).toBe("B/../...");
  });

  test("socket leave_room succeeds", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    clientA = await connectClient(port);
    const createRes = await emitWithAck(clientA, "create_room", {
      username: "Alice",
      size: 3
    });

    const code = createRes.room.code;

    const leaveRes = await emitWithAck(clientA, "leave_room", { code });

    expect(leaveRes.ok).toBe(true);
  });

  test("socket create_room rejects invalid board size", async () => {
    clientA = await connectClient(port);

    const res = await emitWithAck(clientA, "create_room", {
      username: "Alice",
      size: 0
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/invalid board size/i);
  });

  test("socket create_room returns error when gamey fails", async () => {
    createNewGame.mockRejectedValue(new Error("gamey offline"));

    clientA = await connectClient(port);

    const res = await emitWithAck(clientA, "create_room", {
      username: "Alice",
      size: 3
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/gamey offline/i);
  });

  test("socket join_room rejects missing code", async () => {
    clientA = await connectClient(port);

    const res = await emitWithAck(clientA, "join_room", {
      username: "Bob"
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/room code is required/i);
  });

  test("socket join_room returns error when room does not exist", async () => {
    clientA = await connectClient(port);

    const res = await emitWithAck(clientA, "join_room", {
      code: "NOPE12",
      username: "Bob"
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/room not found/i);
  });

  test("socket get_room_state returns room and color", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    clientA = await connectClient(port);

    const createRes = await emitWithAck(clientA, "create_room", {
      username: "Alice",
      size: 3
    });

    const stateRes = await emitWithAck(clientA, "get_room_state", {
      code: createRes.room.code
    });

    expect(stateRes.ok).toBe(true);
    expect(stateRes.room.code).toBe(createRes.room.code);
    expect(stateRes.yourColor).toBe("B");
  });

  test("socket get_room_state returns error for missing room", async () => {
    clientA = await connectClient(port);

    const res = await emitWithAck(clientA, "get_room_state", {
      code: "NOPE12"
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/room not found/i);
  });

  test("socket make_move rejects invalid row col", async () => {
    clientA = await connectClient(port);

    const res = await emitWithAck(clientA, "make_move", {
      code: "ABCD12",
      row: "x",
      col: 0
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/invalid row\/col/i);
  });

  test("socket make_move rejects when it is not your turn", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    clientA = await connectClient(port);
    const createRes = await emitWithAck(clientA, "create_room", {
      username: "Alice",
      size: 3
    });

    clientB = await connectClient(port);
    await emitWithAck(clientB, "join_room", {
      code: createRes.room.code,
      username: "Bob"
    });

    const res = await emitWithAck(clientB, "make_move", {
      code: createRes.room.code,
      row: 0,
      col: 0
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not your turn/i);
  });

  test("socket make_move returns game over payload when move finishes game", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    applyPvpMove.mockResolvedValue({
      yen: { size: 3, turn: 1, players: ["B", "R"], layout: "B/BB/..." },
      finished: true,
      winner: "B",
      winning_edges: [[[0, 0], [1, 0]]]
    });

    clientA = await connectClient(port);
    const createRes = await emitWithAck(clientA, "create_room", {
      username: "Alice",
      size: 3
    });

    clientB = await connectClient(port);
    await emitWithAck(clientB, "join_room", {
      code: createRes.room.code,
      username: "Bob"
    });

    const res = await emitWithAck(clientA, "make_move", {
      code: createRes.room.code,
      row: 0,
      col: 0
    });

    expect(res.ok).toBe(true);
    expect(res.finished).toBe(true);
    expect(res.winner).toBe("B");
    expect(res.room.status).toBe("finished");
  });

  test("socket leave_room returns error when room does not exist", async () => {
    clientA = await connectClient(port);

    const res = await emitWithAck(clientA, "leave_room", {
      code: "NOPE12"
    });

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/room not found/i);
  });
});