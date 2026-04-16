"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remoteGameSessionsStore = void 0;
class RemoteGameSessionsStore {
    sessions = new Map();
    save(session) {
        this.sessions.set(session.sessionId, session);
    }
    get(sessionId) {
        return this.sessions.get(sessionId);
    }
    getOrThrow(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`remote session ${sessionId} not found`);
        }
        return session;
    }
    delete(sessionId) {
        return this.sessions.delete(sessionId);
    }
    list() {
        return Array.from(this.sessions.values());
    }
}
exports.remoteGameSessionsStore = new RemoteGameSessionsStore();
