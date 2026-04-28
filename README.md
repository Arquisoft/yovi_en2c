# yovi_en2c — Game Y at UniOvi

<p align="center">
  <img src="https://raw.githubusercontent.com/Arquisoft/yovi_en2c/master/webapp/img/logo.png" alt="YOVI Logo" width="220"/>
</p>

<p align="center">
  <a href="https://github.com/arquisoft/yovi_en2c/actions/workflows/release-deploy.yml">
    <img src="https://github.com/arquisoft/yovi_en2c/actions/workflows/release-deploy.yml/badge.svg" alt="Release — Test, Build, Publish, Deploy"/>
  </a>
  <a href="https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_en2c">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_en2c&metric=alert_status" alt="Quality Gate Status"/>
  </a>
  <a href="https://sonarcloud.io/summary/new_code?id=Arquisoft_yovi_en2c">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=Arquisoft_yovi_en2c&metric=coverage" alt="Coverage"/>
  </a>
  <img src="https://img.shields.io/badge/deployed-April%202026-success" alt="Deployed April 2026"/>
  <img src="https://img.shields.io/badge/status-live-brightgreen" alt="Status: Live"/>
</p>

<p align="center">
  <strong>YOVI</strong> is a fully deployed web platform for playing <strong>Game Y</strong> — an abstract strategy board game where two players compete to connect all three sides of a triangular board. Developed as part of the Software Architecture (ASW) course at the University of Oviedo.
</p>

<p align="center">
  🎮 <strong><a href="https://yovi.13.63.89.84.sslip.io">Play now → yovi.13.63.89.84.sslip.io</a></strong>
</p>

---

## 👥 Contributors

<table align="center">
  <tr>
    <td align="center">
      <a href="https://github.com/AnaPB8">
        <img src="https://github.com/AnaPB8.png" width="80" style="border-radius:50%"/><br/>
        <strong>Ana Pérez Bango</strong>
      </a><br/>
      <a href="mailto:UO294100@uniovi.es">UO294100@uniovi.es</a>
    </td>
    <td align="center">
      <a href="https://github.com/Adrigarsu">
        <img src="https://github.com/Adrigarsu.png" width="80" style="border-radius:50%"/><br/>
        <strong>Adriana García Suárez</strong>
      </a><br/>
      <a href="mailto:UO300042@uniovi.es">UO300042@uniovi.es</a>
    </td>
  </tr>
</table>

---

## What is Game Y?

Game Y is an abstract two-player strategy game played on a **triangular board**. Each player takes turns placing pieces of their colour. The first player to form a **connected group that simultaneously touches all three sides** of the triangle wins.

```
        B          ← Blue (B) piece
       . B
      B B ·
     · · B ·
    · · · B ·
```

Blue wins by connecting the top, left, and right edges with a single connected group. Simple rules, deep strategy.

---

## Features

| Feature | Description |
|---------|-------------|
|  **AI opponents** | Six difficulty levels from random to Monte Carlo Tree Search |
|  **Real-time multiplayer** | Private rooms with shareable codes via Socket.IO |
|  **Admin panel** | Manage users, roles, and account data |
|  **User profiles** | Editable name, bio, location, and preferred language |
|  **Social** | Friend requests, friend list, and user search |
|  **Notifications** | In-app friend request and welcome notifications |
|  **Statistics** | Match history, personal stats, and top-10 ranking |
|  **Hint system** | AI-powered move suggestions during gameplay |
|  **Internationalization** | English and Spanish |
|  **Themes** | Dark and light mode, persisted per user |
|  **Bot interop API** | External bots can compete against our AI via REST |
|  **Monitoring** | Prometheus metrics + Grafana dashboard |

---

##  Architecture

YOVI follows an **eight-service microservices architecture** with Nginx as the single public entry point.

```
Browser / External Bot
         │
         ▼
   Nginx (80 / 443)
         │
         ├── /              → webapp:80         React SPA
         ├── /api/*         → gateway:8080      REST API
         ├── /socket.io/*   → multiplayer:7000  WebSocket (Socket.IO)
         └── /interop/*     → botapi:4001       Bot interoperability API

Gateway routes internally to:
         ├── authentication:5000   register · login · verify
         ├── users:3000            profiles · friends · notifications · admin · game results
         ├── gamey:4000            game logic · bot moves · hints
         └── multiplayer:7000      room management (REST)

Multiplayer and BotAPI also call:
         └── gamey:4000            game/new · pvp/move · pvb/move · ybot/choose
```

> **Key architectural decisions**: Rust was chosen for the game engine for memory safety and performance.
> Socket.IO powers real-time multiplayer with automatic reconnection. JWT with role claims enables
> stateless admin authorization without extra database lookups. See the
> [Arc42 architecture docs](https://arquisoft.github.io/yovi_en2c/) and
> [Architecture Decision Records](https://github.com/Arquisoft/yovi_en2c/wiki/Architecture-Decision-Record)
> for full rationale on all 16 architectural decisions.

### Project structure

```
yovi_en2c/
├── webapp/          # React + TypeScript SPA (Vite)
├── gateway/         # Node.js + Express API gateway        (port 8080)
├── authentication/  # Node.js + Express JWT auth service   (port 5000)
├── users/           # Node.js + Express user management    (port 3000)
├── gamey/           # Rust + Axum game engine              (port 4000)
├── multiplayer/     # Node.js + Socket.IO PvP service      (port 7000)
├── botapi/          # Node.js + TypeScript interop API     (port 4001)
├── nginx/           # Reverse proxy config + TLS certs
├── tests/load/      # k6 load test scripts
└── docs/            # Arc42 architecture documentation
```

---

## AI Bot Strategies

| Bot ID | Algorithm | Difficulty |
|--------|-----------|------------|
| `random_bot` | Random valid move | — |
| `heuristic_bot` | Side connection heuristic | Easy |
| `minimax_bot` | Minimax (depth 3) | Medium |
| `alfa_beta_bot` | Minimax + alpha-beta pruning | Hard |
| `monte_carlo_hard` | Monte Carlo Tree Search | Expert |
| `monte_carlo_extreme` | MCTS (more iterations) | Extreme |

All strategies implement the `YBot` Rust trait — adding a new strategy requires only a new struct and
one registration call. See the [Bot Implementations wiki page](https://github.com/Arquisoft/yovi_en2c/wiki/Bot-Implementations).

---

## Game State — YEN Notation

All game state is exchanged in **YEN (Y Exchange Notation)**, a JSON format inspired by chess FEN:

```json
{
  "size": 5,
  "turn": 0,
  "players": ["B", "R"],
  "layout": "B/BR/.R./..../....."
}
```

- `size` — board edge length (size 7 → 28 total cells)
- `turn` — index into `players` array (0 = Blue's turn)
- `players` — token characters; Blue (`B`) always moves first
- `layout` — rows separated by `/`; `.` = empty, `B`/`R` = occupied

---

## Bot Interoperability API

External bots can compete against our AI at:
**`https://yovi.13.63.89.84.sslip.io/interop`**

**Create a game and play:**

```bash
# 1. Create a game against random_bot
curl -X POST "https://yovi.13.63.89.84.sslip.io/interop/games" \
  -H "Content-Type: application/json" \
  -d '{"size": 5, "bot_id": "random_bot"}'
# → {"game_id": "...", "position": {...YEN...}, "status": "ONGOING"}

# 2. Play a move (send updated YEN with your piece placed)
curl -X POST "https://yovi.13.63.89.84.sslip.io/interop/games/{game_id}/play" \
  -H "Content-Type: application/json" \
  -d '{"position": {...YEN with your move...}}'
# → {"position": {...YEN after bot response...}, "status": "ONGOING"}

# 3. Stateless move (no session required)
curl "https://yovi.13.63.89.84.sslip.io/interop/play?position={YEN_JSON}&bot_id=heuristic_bot"
```

Full OpenAPI 3.1 spec at [`botapi/src/openapi/openapi.yaml`](botapi/src/openapi/openapi.yaml).

---

## Running the Project

### With Docker (recommended)

Requires [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).

**1. Create a `.env` file at the project root:**

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/yovi
JWT_SECRET=your_secret_key_here
JWT_EXPIRES=24h
```

**2. Build and start all services:**

```bash
docker-compose up --build
```

**3. Open the app:** [http://localhost](http://localhost)

| Service | URL |
|---------|-----|
| Web application | http://localhost |
| Bot interop API | http://localhost/interop |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:9091 (`admin` / `admin`) |

---

### Without Docker (local development)

Requires [Node.js ≥ 20](https://nodejs.org/) and [Rust](https://www.rust-lang.org/).

```bash
# Start all backend services
cd users          && npm install && npm start          # :3000
cd authentication && npm install && npm start          # :5000
cd gateway        && npm install && npm start          # :8080
cd multiplayer    && npm install && npm start          # :7000
cd botapi         && npm install && npm run build && npm start  # :4001
cd gamey          && cargo run -- --mode server --port 4000    # :4000

# Start the frontend
cd webapp && npm install && npm run dev                # :5173
```

---

## Testing

### Unit and integration tests

```bash
cd users          && npm test    # Jest + mongodb-memory-server
cd authentication && npm test    # Vitest + Supertest
cd gateway        && npm test    # Vitest + Supertest
cd multiplayer    && npm test    # Jest + socket.io-client
cd botapi         && npm test    # Vitest + Supertest
cd gamey          && cargo test  # unit + integration + property-based (proptest)
```

### End-to-end tests

```bash
cd webapp && npm run test:e2e    # Playwright
```

### Load tests (k6)

```bash
# Requires k6: https://k6.io/docs/getting-started/installation/

./tests/load/run_load_tests.sh                                      # local
./tests/load/run_load_tests.sh https://yovi.13.63.89.84.sslip.io/api  # production
```

| Scenario | VUs | p95 threshold |
|----------|-----|---------------|
| Registration | 50 | < 2 000 ms |
| Login | 50 | < 1 500 ms |
| Start game | 20 | < 3 000 ms |

See the [Load Testing Guide](https://github.com/Arquisoft/yovi_en2c/wiki/Load-Testing-Guide) and [Load Testing Results](https://github.com/Arquisoft/yovi_en2c/wiki/Load-Testing-Results).

---

## Monitoring

Prometheus scrapes metrics from gateway, users, and gamey every 15 seconds. The **"Yovi Services Overview"**
Grafana dashboard shows request rate, p95 latency, and error rate for all three services in real time.

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:9091

See the [Monitoring wiki page](https://github.com/Arquisoft/yovi_en2c/wiki/Monitoring:-Prometheus-&-Grafana).

---

## Documentation

| Resource | Link |
|----------|------|
| 📖 Arc42 Architecture Docs | [arquisoft.github.io/yovi_en2c](https://arquisoft.github.io/yovi_en2c/) |
| 📝 GitHub Wiki | [wiki home](https://github.com/Arquisoft/yovi_en2c/wiki) |
| 🧠 Architecture Decision Records | [16 ADRs documented](https://github.com/Arquisoft/yovi_en2c/wiki/Architecture-Decision-Record-(ADR)) |
| 🔌 Bot API OpenAPI spec | [openapi.yaml](botapi/src/openapi/openapi.yaml) |
| 🚀 CI/CD Pipeline | [pipeline docs](https://github.com/Arquisoft/yovi_en2c/wiki/CI-CD-Pipeline) |
| 🧪 Usability Testing | [usability results](https://github.com/Arquisoft/yovi_en2c/wiki/Usability-Test) |

---

## License

This project is developed for educational purposes as part of the ASW course at the University of Oviedo.
