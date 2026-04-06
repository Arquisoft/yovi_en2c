import { describe, it, expect } from "vitest";
import { newGameId } from "../utils/ids";

describe("newGameId", () => {
  it("returns a string", () => {
    const id = newGameId();

    expect(typeof id).toBe("string");
  });

  it("returns different ids", () => {
    const a = newGameId();
    const b = newGameId();

    expect(a).not.toBe(b);
  });

  it("returns a non-empty id", () => {
    const id = newGameId();

    expect(id.length).toBeGreaterThan(0);
  });
});