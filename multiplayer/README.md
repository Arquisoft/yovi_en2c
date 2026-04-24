# Multiplayer Service

Realtime multiplayer service for YOVI.

## Purpose

This service manages online human-vs-human matches using WebSockets.

It does **not** implement the game rules itself.  
Instead, it delegates rule validation and move application to `gamey`, which remains the source of truth for Game Y state transitions in **YEN notation**.

## Responsibilities

- Create private rooms with a code
- Let a second player join a room
- Keep active room state in memory
- Broadcast updates to both players in real time
- Call `gamey` to:
  - create a new game
  - validate and apply PvP moves

## Environment variables

Create a `.env` file from `.env.example`:

```env
PORT=7000
GAMEY_BASE_URL=http://localhost:4000
CORS_ORIGIN=*
ROOM_CODE_LENGTH=6