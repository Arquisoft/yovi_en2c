# yovi_en2c - Game Y at UniOvi

[![Release — Test, Build, Publish, Deploy](https://github.com/arquisoft/yovi_en2c/actions/workflows/release-deploy.yml/badge.svg)](https://github.com/arquisoft/yovi_en2c/actions/workflows/release-deploy.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_en2c&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_en2c)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_en2c&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_en2c)

**YOVI** is a web platform for playing **Game Y** — an abstract strategy board game where players compete to connect all three sides of a triangular board. The project is developed as part of the Software Architecture (ASW) course at the University of Oviedo.

🎮 **Play here:** [http://13.60.227.214/](http://13.60.227.214/)

---

## Project Structure

The project follows a **microservices architecture** with five independent services orchestrated via Docker Compose:

```
yovi_en2c/
├── webapp/          # React + TypeScript frontend (SPA)
├── users/           # Node.js + Express user management service
├── authentication/  # Node.js + Express JWT authentication service
├── gateway/         # Node.js + Express API gateway
├── gamey/           # Rust game engine and bot service
└── docs/            # Architecture documentation (Arc42 + ADRs)
```

---

## Features

- **User registration and login** with JWT-based authentication
- **Play Game Y vs AI bot** with 5 difficulty levels
- **Variable board size** configurable by the user
- **Match history and game results** stored in MongoDB
- **Internationalization (i18n)** — English and Spanish supported
- **Public REST API** for external bots using YEN notation
- **Monitoring** with Prometheus and Grafana

---

## Components

### Webapp (`webapp/`)

A single-page application (SPA) built with [Vite](https://vitejs.dev/), [React](https://reactjs.org/), and TypeScript.

- `src/App.tsx` — Main router with all application routes
- `src/LoginForm.tsx` — Login form with JWT token handling
- `src/RegistrationForm.tsx` — User registration form
- `src/Home.tsx` — Home dashboard with session verification
- `src/Game.tsx` — Main game board component
- `src/SelectDifficulty.tsx` — Bot difficulty selection screen
- `src/GameFinished.tsx` — End of game screen (win/loss/draw)
- `src/i18n/` — Internationalization module (ES/EN)
- `Dockerfile` — Docker image definition

### Users Service (`users/`)

A REST API built with [Node.js](https://nodejs.org/) and [Express](https://expressjs.com/), connected to MongoDB.

- `users-service.js` — Main service file
- `models/User.js` — Mongoose user schema
- `models/GameResult.js` — Mongoose game result schema
- `db.js` — MongoDB connection setup

**Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/createuser` | Create a new user |
| `GET` | `/users/:username` | Get user by username |
| `GET` | `/users` | List all users |
| `POST` | `/gameresult` | Save a game result |
| `GET` | `/history/:username` | Get match history for a user |
| `GET` | `/ranking` | Top 10 players by wins |
| `GET` | `/health` | Health check |

### Authentication Service (`authentication/`)

A Node.js service responsible for JWT token generation and validation.

- `auth-service.js` — Main service file

**Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/register` | Validate credentials and create user via users service |
| `POST` | `/login` | Authenticate user and return JWT |
| `GET` | `/verify` | Verify a JWT token |
| `GET` | `/health` | Health check |

### Gateway (`gateway/`)

A Node.js + Express API gateway — the single entry point for all external requests. Routes traffic to the appropriate internal service.

- `gateway-service.js` — Main gateway file

**Routes:**

| Method | Route | Forwards to |
|--------|-------|-------------|
| `POST` | `/game/new` | gamey — create new game |
| `POST` | `/game/pvb/move` | gamey — player vs bot move |
| `POST` | `/game/bot/choose` | gamey — bot move selection |
| `GET` | `/game/status` | gamey — health check |
| `POST` | `/register` | authentication service |
| `POST` | `/login` | authentication service |
| `GET` | `/verify` | authentication service |

### Game Engine (`gamey/`)

A [Rust](https://www.rust-lang.org/) service implementing all Game Y logic: move validation, win condition detection, and AI bot strategies.

- `src/main.rs` — Binary entry point (CLI and server modes)
- `src/lib.rs` — Library exports
- `src/core/` — Core game types: board, coordinates (barycentric), players, moves
- `src/bot/` — Bot trait (`YBot`), registry, and all strategy implementations
- `src/notation/` — YEN (Y Exchange Notation) serialization/deserialization
- `src/game_server/` — Axum HTTP server with REST endpoints
- `Cargo.toml` — Project manifest

**Available bot strategies:**

| Bot ID | Difficulty | Algorithm |
|--------|-----------|-----------|
| `random_bot` | — | Random valid move |
| `heuristic_bot` | Easy | Side connection heuristic |
| `minimax_bot` | Medium | Minimax (depth 3) |
| `alfa_beta_bot` | Hard | Minimax with alpha-beta pruning |
| `monte_carlo_hard` | Expert | Monte Carlo Tree Search |
| `monte_carlo_extreme` | Extreme | Monte Carlo Tree Search (more iterations) |

**Game API endpoints (prefix `/v1`):**

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/status` | Health check |
| `POST` | `/game/new` | Create a new game, returns YEN |
| `POST` | `/v1/game/pvb/{bot_id}` | Player move + bot response |
| `POST` | `/v1/ybot/choose/{bot_id}` | Request bot move coordinates |

All game state is exchanged in **YEN (Y Exchange Notation)** — a JSON format inspired by chess FEN:

```json
{
  "size": 5,
  "turn": 0,
  "players": ["B", "R"],
  "layout": "B/BR/.R./..../....."
}
```

---

## Running the Project

### With Docker (recommended)

Requires [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).

**1. Set up environment variables:**

Create a `.env` file in the root directory:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/yovi
JWT_SECRET=your_secret_key_here
JWT_EXPIRES=24h
```

**2. Build and start all services:**

```bash
docker-compose up --build
```

**3. Access the application:**

| Service | URL |
|---------|-----|
| Web application | http://localhost |
| Gateway API | http://localhost:8080 |
| Users service | http://localhost:3000 |
| Auth service | http://localhost:5000 |
| Game engine | http://localhost:4000 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:9091 |

---

### Without Docker (local development)

You need [Node.js](https://nodejs.org/), [npm](https://www.npmjs.com/), and [Rust](https://www.rust-lang.org/) installed.

**1. Users service:**

```bash
cd users
npm install
npm start
# Available at http://localhost:3000
```

**2. Authentication service:**

```bash
cd authentication
npm install
npm start
# Available at http://localhost:5000
```

**3. Gateway:**

```bash
cd gateway
npm install
npm start
# Available at http://localhost:8080
```

**4. Game engine:**

```bash
cd gamey
cargo run -- --mode server --port 4000
# Available at http://localhost:4000
```

**5. Web application:**

```bash
cd webapp
npm install
npm run dev
# Available at http://localhost:5173
```

---