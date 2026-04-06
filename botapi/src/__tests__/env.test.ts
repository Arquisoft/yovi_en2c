import { describe, it, expect, vi } from "vitest";

describe("env", () => {
  it("uses environment values when provided", async () => {
    vi.resetModules();

    process.env.PORT = "4999";
    process.env.GAMEY_BASE_URL = "http://example.com:4000";
    process.env.GAMEY_API_VERSION = "v9";

    const { env } = await import("../config/env");

    expect(env.port).toBe(4999);
    expect(env.gameyBaseUrl).toBe("http://example.com:4000");
    expect(env.gameyApiVersion).toBe("v9");
  });

  it("uses defaults when variables are missing", async () => {
    vi.resetModules();

    delete process.env.PORT;
    delete process.env.GAMEY_BASE_URL;
    delete process.env.GAMEY_API_VERSION;

    const { env } = await import("../config/env");

    expect(env.port).toBe(4001);
    expect(env.gameyBaseUrl).toBe("http://localhost:4000");
    expect(env.gameyApiVersion).toBe("v1");
  });
});