import { describe, it, expect } from "vitest";
import {
  assertValidYen,
  detectSingleAddedMove,
  applyMoveToYen,
  computeStatusFromPvbResponse,
  normalizeStatus
} from "../utils/yen";

describe("yen utils", () => {
  const validYen = {
    size: 3,
    turn: 0,
    players: ["B", "R"],
    layout: "./../..."
  };

  describe("assertValidYen", () => {
    it("does not throw for a valid YEN", () => {
      expect(() => assertValidYen(validYen)).not.toThrow();
    });

    it("throws when yen is missing", () => {
      expect(() => assertValidYen(undefined as any)).toThrow("YEN is required");
    });

    it("throws when size is invalid", () => {
      expect(() =>
        assertValidYen({ ...validYen, size: 0 })
      ).toThrow("YEN.size must be a positive integer");
    });

    it("throws when turn is invalid", () => {
      expect(() =>
        assertValidYen({ ...validYen, turn: -1 })
      ).toThrow("YEN.turn must be a non-negative integer");
    });

    it("throws when players are invalid", () => {
      expect(() =>
        assertValidYen({ ...validYen, players: [] })
      ).toThrow("YEN.players must contain at least two players");
    });

    it("throws when layout is missing", () => {
      expect(() =>
        assertValidYen({ ...validYen, layout: "" })
      ).toThrow("YEN.layout is required");
    });

    it("throws when row count does not match size", () => {
      expect(() =>
        assertValidYen({ ...validYen, layout: "./.." })
      ).toThrow("YEN.layout must contain 3 rows");
    });

    it("throws when a row length is wrong", () => {
      expect(() =>
        assertValidYen({ ...validYen, layout: "./.../..." })
      ).toThrow();
    });
  });

  describe("detectSingleAddedMove", () => {
    it("detects one valid added move", () => {
      const previous = {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "./../..."
      };

      const proposed = {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "B/../..."
      };

      expect(detectSingleAddedMove(previous, proposed)).toEqual({
        row: 0,
        col: 0,
        token: "B"
      });
    });

    it("throws when size changes", () => {
      const proposed = {
        size: 4,
        turn: 0,
        players: ["B", "R"],
        layout: "./../.../...."
    };

      expect(() =>
        detectSingleAddedMove(validYen, proposed)
      ).toThrow("proposed position has different size");
    });

    it("throws when players change", () => {
      expect(() =>
        detectSingleAddedMove(validYen, {
          ...validYen,
          players: ["X", "Y"]
        })
      ).toThrow("proposed position has different players");
    });

    it("throws when overwriting occupied cell", () => {
      const previous = {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "B/../..."
      };

      const proposed = {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "R/../..."
      };

      expect(() => detectSingleAddedMove(previous, proposed)).toThrow(
        "proposed position overwrites an occupied cell"
      );
    });

    it("throws when more than one move is added", () => {
      const proposed = {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "B/.B/..."
      };

      expect(() => detectSingleAddedMove(validYen, proposed)).toThrow(
        "proposed position contains more than one new move"
      );
    });

    it("throws when no move is added", () => {
      expect(() => detectSingleAddedMove(validYen, validYen)).toThrow(
        "proposed position does not contain any new move"
      );
    });
  });

  describe("applyMoveToYen", () => {
    it("applies move and advances turn", () => {
      const result = applyMoveToYen(validYen, { x: 2, y: 0, z: 0 });

      expect(result.layout).toBe("B/../...");
      expect(result.turn).toBe(1);
    });

    it("throws on invalid row coordinate", () => {
      expect(() =>
        applyMoveToYen(validYen, { x: 99, y: 0, z: 0 })
      ).toThrow("bot returned invalid row coordinate");
    });

    it("throws on invalid col coordinate", () => {
      expect(() =>
        applyMoveToYen(validYen, { x: 2, y: 9, z: 0 })
      ).toThrow("bot returned invalid col coordinate");
    });

    it("throws if target cell is occupied", () => {
      const occupied = {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "B/../..."
      };

      expect(() =>
        applyMoveToYen(occupied, { x: 2, y: 0, z: 0 })
      ).toThrow("bot returned a move on an occupied cell");
    });
  });

  describe("computeStatusFromPvbResponse", () => {
    it("returns ONGOING when not finished", () => {
      expect(
        computeStatusFromPvbResponse({
          yen: validYen,
          finished: false,
          winner: null
        })
      ).toBe("ONGOING");
    });

    it("returns DRAW when finished without winner", () => {
      expect(
        computeStatusFromPvbResponse({
          yen: validYen,
          finished: true,
          winner: null
        })
      ).toBe("DRAW");
    });

    it("returns BOT_WON when winner is second player", () => {
      expect(
        computeStatusFromPvbResponse({
          yen: validYen,
          finished: true,
          winner: "R"
        })
      ).toBe("BOT_WON");
    });

    it("returns OPPONENT_WON when winner is first player", () => {
      expect(
        computeStatusFromPvbResponse({
          yen: validYen,
          finished: true,
          winner: "B"
        })
      ).toBe("OPPONENT_WON");
    });
  });

  describe("normalizeStatus", () => {
    it("returns the same status", () => {
      expect(normalizeStatus("ONGOING")).toBe("ONGOING");
    });
  });
});