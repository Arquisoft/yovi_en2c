import crypto from "node:crypto";

export function newGameId(): string {
  return crypto.randomUUID();
}