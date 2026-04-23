jest.mock("../src/gamey-client", () => ({
  createNewGame: jest.fn(),
  applyPvpMove: jest.fn()
}));

process.env.NODE_ENV = "test";

const { io: Client } = require("socket.io-client");
const { createNewGame, applyPvpMove } = require("../src/gamey-client");
const { server, rooms } = require("../src/multiplayer-service");

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
    if (clientA && clientA.connected) clientA.disconnect();
    if (clientB && clientB.connected) clientB.disconnect();
  });

  test("socket create_room creates room", (done) => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    clientA = new Client(`http://localhost:${port}`);

    clientA.on("connect", () => {
      clientA.emit("create_room", { username: "Alice", size: 3 }, (res) => {
        try {
          expect(res.ok).toBe(true);
          expect(res.room.players.B.username).toBe("Alice");
          expect(res.yourColor).toBe("B");
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });

  test("socket join_room joins existing room", (done) => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    clientA = new Client(`http://localhost:${port}`);
    clientB = new Client(`http://localhost:${port}`);

    clientA.on("connect", () => {
      clientA.emit("create_room", { username: "Alice", size: 3 }, (createRes) => {
        const code = createRes.room.code;

        clientB.on("connect", () => {
          clientB.emit("join_room", { code, username: "Bob" }, (joinRes) => {
            try {
              expect(joinRes.ok).toBe(true);
              expect(joinRes.room.players.R.username).toBe("Bob");
              expect(joinRes.yourColor).toBe("R");
              done();
            } catch (err) {
              done(err);
            }
          });
        });
      });
    });
  });

  test("socket make_move updates room state", (done) => {
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

    clientA = new Client(`http://localhost:${port}`);
    clientB = new Client(`http://localhost:${port}`);

    clientA.on("connect", () => {
      clientA.emit("create_room", { username: "Alice", size: 3 }, (createRes) => {
        const code = createRes.room.code;

        clientB.on("connect", () => {
          clientB.emit("join_room", { code, username: "Bob" }, () => {
            clientA.emit("make_move", { code, row: 0, col: 0 }, (moveRes) => {
              try {
                expect(moveRes.ok).toBe(true);
                expect(moveRes.room.yen.layout).toBe("B/../...");
                done();
              } catch (err) {
                done(err);
              }
            });
          });
        });
      });
    });
  });

  test("socket leave_room succeeds", (done) => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    clientA = new Client(`http://localhost:${port}`);

    clientA.on("connect", () => {
      clientA.emit("create_room", { username: "Alice", size: 3 }, (createRes) => {
        const code = createRes.room.code;

        clientA.emit("leave_room", { code }, (leaveRes) => {
          try {
            expect(leaveRes.ok).toBe(true);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });
  });
});