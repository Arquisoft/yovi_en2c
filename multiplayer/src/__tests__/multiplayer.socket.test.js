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
});