jest.mock("axios");

const axios = require("axios");
const { createNewGame, applyPvpMove } = require("../src/gamey-client");

describe("gamey-client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createNewGame calls /game/new and returns data", async () => {
    axios.post.mockResolvedValue({
      data: { size: 3, turn: 0, players: ["B", "R"], layout: "./../..." }
    });

    const result = await createNewGame(3);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toContain("/game/new");
    expect(axios.post.mock.calls[0][1]).toEqual({ size: 3 });
    expect(result).toEqual({ size: 3, turn: 0, players: ["B", "R"], layout: "./../..." });
  });

  test("applyPvpMove calls /v1/game/pvp/move and returns data", async () => {
    const yen = { size: 3, turn: 0, players: ["B", "R"], layout: "./../..." };

    axios.post.mockResolvedValue({
      data: {
        yen: { size: 3, turn: 1, players: ["B", "R"], layout: "B/../..." },
        finished: false,
        winner: null,
        winning_edges: []
      }
    });

    const result = await applyPvpMove(yen, 0, 0);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toContain("/v1/game/pvp/move");
    expect(axios.post.mock.calls[0][1]).toEqual({ yen, row: 0, col: 0 });
    expect(result.finished).toBe(false);
  });
});