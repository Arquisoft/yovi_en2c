# YOVI_EN2C API

API pública para interoperabilidad entre bots en el juego Y.

Este servicio permite la comunicación entre:
- bots externos que quieren jugar contra nuestros bots
- nuestros bots, cuando necesitan jugar contra la API de otro equipo

La API actúa como una capa intermedia entre clientes HTTP y el motor del juego (`gamey`), que es el responsable de aplicar reglas, validar jugadas y calcular movimientos.

---

## 🧠 ¿Qué es esta API?

Esta API es una **capa de interoperabilidad** cuyo objetivo es permitir partidas **bot vs bot entre equipos**.

No contiene la lógica del juego, sino que:
- recibe peticiones externas
- valida inputs básicos
- gestiona partidas activas
- delega la lógica al motor `gamey`
- puede actuar tanto como **servidor** como **cliente** de interoperabilidad

---

## 🧱 Arquitectura

### Modo servidor
BOT Externo -> API -> Gamey

En este modo, bots de otros equipos se conectan a nuestra API para jugar contra uno de nuestros bots.

### Modo cliente remoto
Nuestro Bot -> API -> API Rival -> Motor Rival

En este modo, nuestra API se conecta a la API de otro equipo, consulta el estado remoto y utiliza uno de nuestros bots para enviar jugadas a esa API externa.

---

## ⚙️ Responsabilidades

### API (este servicio)
- Exponer endpoints HTTP públicos
- Gestionar partidas activas locales (en memoria)
- Gestionar sesiones de partidas remotas (en memoria)
- Traducir peticiones al formato de `gamey`
- Orquestar el flujo de la partida
- Permitir que bots externos jueguen contra nuestros bots
- Permitir que nuestros bots jueguen contra la API de otro equipo

### gamey (Rust)
- Validar jugadas
- Aplicar movimientos
- Calcular jugadas del bot
- Detectar ganador
- Trabajar con formato YEN

---

## 📦 Estructura de la API

src/
- app.ts -> Configuración de Express, middlewares y registro de rutas
- server.ts -> Punto de entrada del servicio

src/config/
- env.ts -> Variables de entorno

src/routes/
- games.routes.ts -> Rutas para partidas locales expuestas a bots externos
- play.routes.ts -> Ruta stateless
- health.routes.ts -> Health check
- remote-games.routes.ts -> Rutas para gestionar partidas remotas contra otras APIs

src/controllers/
- games.controller.ts -> Controller de partidas locales
- play.controller.ts -> Controller del endpoint stateless
- health.controller.ts -> Controller de health check
- remote-games.controller.ts -> Controller de sesiones remotas

src/services/
- interop.service.ts -> Lógica principal de interop local
- remote-interop.service.ts -> Lógica de interop cuando jugamos contra otra API

src/clients/
- gamey.client.ts -> Cliente HTTP hacia `gamey`
- remote-interop.client.ts -> Cliente HTTP hacia la API de otro equipo

src/store/
- active-games.store.ts -> Almacenamiento en memoria de partidas locales activas
- remote-game-sessions.store.ts -> Almacenamiento en memoria de sesiones remotas

src/models/
- active-game.model.ts -> Modelo interno de partida local
- remote-game-session.model.ts -> Modelo interno de sesión remota

src/dtos/
- *.dto.ts -> Tipos de entrada y salida de la API
- remote-connect.dto.ts -> DTO para conectarse a una partida remota existente
- remote-create.dto.ts -> DTO para crear una partida remota
- remote-session.dto.ts -> DTOs de respuesta de sesiones remotas

src/utils/
- ids.ts -> Generación de IDs
- yen.ts -> Lógica auxiliar de notación YEN

src/openapi/
- openapi.yaml -> Documentación de la API

---

## 🎮 Formato de juego: YEN

La API usa **YEN (Y Exchange Notation)** para representar el estado del juego:

```json
{
  "size": 3,
  "turn": 0,
  "players": ["B", "R"],
  "layout": "B/BR/.R."
}
```

## ⏺️ Endpoints locales

Estos endpoints permiten que bots externos jueguen contra nuestros bots.

### Crear partida

POST /games

Request:
{
  "size": 5,
  "bot_id": "random_bot"
}

Crea una partida local activa en memoria y selecciona qué bot nuestro jugará.

---

### Obtener estado

GET /games/{gameId}

Devuelve el estado actual de una partida local activa.

---

### Jugar turno

POST /games/{gameId}/play

Request:
{
  "position": { ...YEN... }
}

Recibe una nueva posición propuesta por el rival, detecta la jugada realizada y delega en gamey para:
- validar la jugada
- aplicar la jugada del rival
- calcular la respuesta de nuestro bot
- devolver el nuevo estado

---

### Modo stateless

POST /play

Request:
{
  "position": { ...YEN... },
  "bot_id": "random_bot"
}

Recibe una posición y un bot, calcula una jugada y devuelve la nueva posición sin guardar estado en memoria.

---

### Health Check

GET /health

Comprueba si el servicio está activo.

---

## 🌍 Endpoints remotos

Estos endpoints permiten que uno de nuestros bots juegue contra la API de otro equipo.

---

### Conectarse a una partida remota existente

POST /remote-games/connect

Request:
{
  "base_url": "http://equipo-rival:4001",
  "game_id": "abc123",
  "local_bot_id": "random_bot",
  "our_player_index": 0
}

Crea una sesión local que apunta a una partida ya existente en la API de otro equipo.

---

### Crear una partida remota

POST /remote-games/create

Request:
{
  "base_url": "http://equipo-rival:4001",
  "size": 5,
  "remote_bot_id": "heuristic_bot",
  "local_bot_id": "random_bot",
  "our_player_index": 0
}

Pide a la API rival que cree una partida y guarda localmente una sesión asociada.

---

### Obtener una sesión remota

GET /remote-games/{sessionId}

Devuelve la información de una sesión remota guardada localmente.

---

### Jugar un turno remoto

POST /remote-games/{sessionId}/play-turn

Este endpoint:
1. consulta el estado actual en la API rival
2. comprueba si es nuestro turno
3. si es nuestro turno:
   - pide jugada a gamey
   - construye la nueva posición
   - la envía a la API rival
4. guarda el estado remoto más reciente

Posibles respuestas:
- WAITING_OPPONENT → no es nuestro turno
- MOVE_SUBMITTED → jugada enviada correctamente
- GAME_FINISHED → la partida ya ha terminado

---

## 🔄 Flujo de una partida local

1. Se crea una partida (POST /games)
2. El rival consulta estado (GET /games/{id})
3. El rival envía jugada (POST /games/{id}/play)
4. La API:
   - detecta la jugada
   - llama a gamey
   - obtiene la respuesta del bot
5. Devuelve el nuevo estado

---

## 🔄 Flujo de una partida remota

1. Se crea o conecta una sesión remota (POST /remote-games/create o /connect)
2. La API consulta el estado remoto
3. Si es nuestro turno:
   - pide la jugada a gamey
   - construye la nueva posición
   - la envía a la API rival
4. Guarda el estado remoto más reciente
5. Se repite el proceso llamando a /play-turn

---

## 🧩 Modos de funcionamiento

Esta API soporta dos modos:

1. Servidor de interoperabilidad
   Permite que otros equipos jueguen contra nuestros bots.

2. Cliente de interoperabilidad
   Permite que nuestros bots jueguen contra la API de otro equipo.

Esto hace que el sistema sea bidireccional:
- otros bots pueden jugar contra nosotros
- nosotros podemos jugar contra otros

---

## 📝 Persistencia

Actualmente, esta API almacena la información en memoria.

Esto implica:
- las partidas se pierden si el servicio se reinicia
- las sesiones remotas también

---

## 🚫 Qué no hace esta API

Esta API no gestiona:
- autenticación
- usuarios
- rankings
- estadísticas
- historial persistente

Estas responsabilidades están separadas en otros servicios.

---

## 🔧 Variables de entorno

- PORT: puerto del servicio API
- GAMEY_BASE_URL: URL base del servicio Rust gamey
- GAMEY_API_VERSION: versión de la API de gamey

Ejemplo:

PORT=4001
GAMEY_BASE_URL=http://localhost:4000
GAMEY_API_VERSION=v1

---

## 🚀 Resumen

Esta API:
- expone endpoints HTTP para bots
- usa YEN como formato estándar
- delega la lógica en gamey
- soporta partidas locales y remotas
- permite interoperabilidad completa entre equipos