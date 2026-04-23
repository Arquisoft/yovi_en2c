const { generateRoomCode, generateUniqueRoomCode } = require("../codes");

describe("codes", () => {
  test("generateRoomCode returns string of requested length", () => {
    const code = generateRoomCode(6);
    expect(typeof code).toBe("string");
    expect(code).toHaveLength(6);
  });

  test("generateRoomCode uses allowed alphabet", () => {
    const code = generateRoomCode(20);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });

  test("generateUniqueRoomCode returns code not present in existing set", () => {
    const existing = new Set(["ABC123", "ZZZZZZ"]);
    const code = generateUniqueRoomCode(existing, 6);
    expect(existing.has(code)).toBe(false);
    expect(code).toHaveLength(6);
  });

  test("generateUniqueRoomCode throws if it cannot find unique code", () => {
    const spy = jest.spyOn(Math, "random").mockReturnValue(0);

    const existing = new Set(["AAAAAA"]);
    expect(() => generateUniqueRoomCode(existing, 6, 2)).toThrow(
      "Could not generate a unique room code"
    );

    spy.mockRestore();
  });
});