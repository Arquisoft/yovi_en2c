import { RemoteGameSession } from "../models/remote-game-session.model";

class RemoteGameSessionsStore {
  private readonly sessions = new Map<string, RemoteGameSession>();

  save(session: RemoteGameSession): void {
    this.sessions.set(session.sessionId, session);
  }

  get(sessionId: string): RemoteGameSession | undefined {
    return this.sessions.get(sessionId);
  }

  getOrThrow(sessionId: string): RemoteGameSession {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`remote session ${sessionId} not found`);
    }

    return session;
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  list(): RemoteGameSession[] {
    return Array.from(this.sessions.values());
  }
}

export const remoteGameSessionsStore = new RemoteGameSessionsStore();