import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

describe("openapi.yaml", () => {
  it("is valid YAML", () => {
    const filePath = path.resolve(process.cwd(), "src/openapi/openapi.yaml");
    const raw = fs.readFileSync(filePath, "utf-8");

    expect(() => YAML.parse(raw)).not.toThrow();
  });

  it("contains required top-level keys", () => {
    const filePath = path.resolve(process.cwd(), "src/openapi/openapi.yaml");
    const raw = fs.readFileSync(filePath, "utf-8");
    const doc = YAML.parse(raw);

    expect(doc).toHaveProperty("openapi");
    expect(doc).toHaveProperty("info");
    expect(doc).toHaveProperty("paths");
    expect(doc).toHaveProperty("components");
  });

  it("documents /play", () => {
    const filePath = path.resolve(process.cwd(), "src/openapi/openapi.yaml");
    const raw = fs.readFileSync(filePath, "utf-8");
    const doc = YAML.parse(raw);

    expect(doc.paths["/play"]).toBeDefined();
    expect(doc.paths["/play"].get).toBeDefined();
  });
});