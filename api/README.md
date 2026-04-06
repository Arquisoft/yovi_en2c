# YOVI_EN2C API

Public API for bot interoperability in the Y game.

This service enables communication between:
- external bots that want to play against our bots
- our bots, when they need to play against another team's API

The API acts as an intermediate layer between HTTP clients and the game engine (`gamey`), which is responsible for applying the rules, validating moves, and computing bot decisions.

---

## 🧠 What is this API?

This API is an **interoperability layer** whose goal is to enable **bot vs bot matches between teams**.

It does not contain the game logic itself. Instead, it:
- receives external requests
- validates basic inputs
- manages active games
- delegates the logic to the `gamey` engine
- can act both as an **interop server** and as an **interop client**

---

## 🧱 Architecture

### Server mode
External Bot -> API -> Gamey

In this mode, bots from other teams connect to our API in order to play against one of our bots.

### Remote client mode
Our Bot -> API -> Rival API -> Rival Engine

In this mode, our API connects to another team's API, retrieves the remote game state, and uses one of our bots to send moves to that external API.

---

## ⚙️ Responsibilities

### API (this service)
- Expose public HTTP endpoints
- Manage local active games (in memory)
- Manage remote game sessions (in memory)
- Translate requests into the format expected by `gamey`
- Orchestrate the game flow
- Allow external bots to play against our bots
- Allow our bots to play against another team's API

### gamey (Rust)
- Validate moves
- Apply moves
- Compute bot moves
- Detect the winner
- Work with the YEN format

---

## 📦 API structure

src/
- app.ts -> Express configuration, middlewares, and route registration
- server.ts -> Service entry point

src/config/
- env.ts -> Environment variables

src/routes/
- games.routes.ts -> Routes for local games exposed to external bots
- play.routes.ts -> Stateless route
- health.routes.ts -> Health check
- remote-games.routes.ts -> Routes to manage remote games against other APIs

src/controllers/
- games.controller.ts -> Controller for local games
- play.controller.ts -> Controller for the stateless endpoint
- health.controller.ts -> Health check controller
- remote-games.controller.ts -> Controller for remote sessions

src/services/
- interop.service.ts -> Main logic for local interoperability
- remote-interop.service.ts -> Interop logic when playing against another API

src/clients/
- gamey.client.ts -> HTTP client for `gamey`
- remote-interop.client.ts -> HTTP client for another team's API

src/store/
- active-games.store.ts -> In-memory storage for local active games
- remote-game-sessions.store.ts -> In-memory storage for remote sessions

src/models/
- active-game.model.ts -> Internal model for a local game
- remote-game-session.model.ts -> Internal model for a remote session

src/dtos/
- *.dto.ts -> API input/output types
- remote-connect.dto.ts -> DTO to connect to an existing remote game
- remote-create.dto.ts -> DTO to create a remote game
- remote-session.dto.ts -> DTOs for remote session responses

src/utils/
- ids.ts -> ID generation
- yen.ts -> Auxiliary YEN notation logic

src/openapi/
- openapi.yaml -> API documentation

---

## 🎮 Game format: YEN

The API uses **YEN (Y Exchange Notation)** to represent the game state:

```json
{
  "size": 3,
  "turn": 0,
  "players": ["B", "R"],
  "layout": "B/BR/.R."
}
```

## ⏺️ Local endpoints

These endpoints allow external bots to play against our bots.

### Create game

POST /games

Request:
{
  "size": 5,
  "bot_id": "random_bot"
}

Creates a local active game in memory and selects which of our bots will play.

---

### Get state

GET /games/{gameId}

Returns the current state of a local active game.

---

### Play turn

POST /games/{gameId}/play

Request:
{
  "position": { ...YEN... }
}

Receives a new position proposed by the opponent, detects the move that was played, and delegates to gamey to:
- validate the move
- apply the opponent's move
- compute our bot's response
- return the updated state

---

### Stateless mode

POST /play

Request:
{
  "position": { ...YEN... },
  "bot_id": "random_bot"
}

Receives a position and a bot, computes a move, and returns the updated position without storing state in memory.

---

### Health Check

GET /health

Checks whether the service is running.

---

## 🌍 Remote endpoints

These endpoints allow one of our bots to play against another team's API.

---

### Connect to an existing remote game

POST /remote-games/connect

Request:
{
  "base_url": "http://rival-team:4001",
  "game_id": "abc123",
  "local_bot_id": "random_bot",
  "our_player_index": 0
}

Creates a local session that points to an already existing game in another team's API.

---

### Create a remote game

POST /remote-games/create

Request:
{
  "base_url": "http://rival-team:4001",
  "size": 5,
  "remote_bot_id": "heuristic_bot",
  "local_bot_id": "random_bot",
  "our_player_index": 0
}

Asks the rival API to create a game and stores a local session associated with it.

---

### Get a remote session

GET /remote-games/{sessionId}

Returns the information of a remote session stored locally.

---

### Play a remote turn

POST /remote-games/{sessionId}/play-turn

This endpoint:
1. retrieves the current state from the rival API
2. checks whether it is our turn
3. if it is our turn:
   - requests a move from gamey
   - builds the new position
   - sends it to the rival API
4. stores the most recent remote state

Possible responses:
- WAITING_OPPONENT → it is not our turn
- MOVE_SUBMITTED → move sent successfully
- GAME_FINISHED → the game is already over

---

## 🔄 Local game flow

1. A game is created (POST /games)
2. The opponent queries the state (GET /games/{id})
3. The opponent sends a move (POST /games/{id}/play)
4. The API:
   - detects the move
   - calls gamey
   - gets the bot response
5. Returns the updated state

---

## 🔄 Remote game flow

1. A remote session is created or connected (POST /remote-games/create or /connect)
2. The API retrieves the remote state
3. If it is our turn:
   - requests the move from gamey
   - builds the new position
   - sends it to the rival API
4. Stores the latest remote state
5. The process is repeated by calling /play-turn

---

## 🧩 Operating modes

This API supports two modes:

1. Interoperability server  
   Allows other teams to play against our bots.

2. Interoperability client  
   Allows our bots to play against another team's API.

This makes the system bidirectional:
- other bots can play against us
- we can play against others

---

## 📝 Persistence

At the moment, this API stores information in memory.

This implies:
- games are lost if the service restarts
- remote sessions are also lost if the service restarts

---

## 🚫 What this API does not do

This API does not handle:
- authentication
- users
- rankings
- statistics
- persistent match history

These responsibilities are handled by other services.

---

## 🔧 Environment variables

- PORT: API service port  
- GAMEY_BASE_URL: base URL of the Rust `gamey` service  
- GAMEY_API_VERSION: version of the `gamey` API  

Example:

PORT=4001  
GAMEY_BASE_URL=http://localhost:4000  
GAMEY_API_VERSION=v1  

---

## 🚀 Summary

This API:
- exposes HTTP endpoints for bots  
- uses YEN as the standard game format  
- delegates the logic to gamey  
- supports both local and remote games  
- enables full interoperability between teams  