# YOVI_EN2C API

API pública para interoperabilidad entre bots en el juego Y.

Este servicio permite que bots externos jueguen contra los bots implementados en nuestro sistema, actuando como una capa intermedia entre clientes HTTP y el motor del juego (`gamey`).

---

## 🧠 ¿Qué es esta API?

Esta API es una **capa de interoperabilidad** cuyo objetivo es permitir partidas **bot vs bot entre equipos**.

No contiene la lógica del juego, sino que:
- recibe peticiones externas
- valida inputs básicos
- gestiona partidas activas
- delega la lógica al motor `gamey`

---

## 🧱 Arquitectura

BOT Externo -> API -> Gamey

---

## ⚙️ Responsabilidades

### API (este servicio)
- Exponer endpoints HTTP públicos
- Gestionar partidas activas (en memoria)
- Traducir peticiones al formato de `gamey`
- Orquestar el flujo de la partida

### gamey (Rust)
- Validar jugadas
- Aplicar movimientos
- Calcular jugadas del bot
- Detectar ganador
- Trabajar con formato YEN

---

## 📦 Estructura de la api
src/
- app.ts -> Configuración de Express y middlewares
- server.ts -> Punto de entrada

src/config/
- env.ts -> Variables de entorno

src/routes/
- games.routes.ts -> Rutas de partidas
- play.routes.ts -> Ruta stateless
- health.routes.ts -> Health check

src/controllers/
- games.controller.ts
- play.controller.ts
- health.controller.ts

src/services/
- interop.service.ts -> Lógica principal de interop

src/clients/
- gamey.client.ts -> Cliente HTTP hacia gamey

src/store/
- active-games.store.ts # Almacenamiento en memoria

src/models/
- active-game.model.ts

src/dtos/
- *.dto.ts -> Tipos de entrada/salida

src/utils/
- ids.ts -> Archivo para generación de IDs
- yen.ts -> Lógica de notación YEN

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

---

## ⏺️ Endpoints

### Crear partida
POST /games

```json
{
  "size": 5,
  "bot_id": "random_bot"
}
```

### Obtener estado
GET /games/{gameId}

### Jugar turno
POST /games/{gameId}/play

```json
{
  "position": { ...YEN... }
}
```

### Modo stateless
POST /play

```json
{
  "position": { ...YEN... },
  "bot_id": "random_bot"
}
```

### Health Check
GET /health

---
## 🔄 Flujo de una partida
1. Se crea una partida (/games)
2. El rival consulta estado (GET /games/{id})
3. El rival envía jugada (POST /games/{id}/play)
4. La API:
    - detecta la jugada
    - llama a gamey
    - obtiene la respuesta del bot
5. Devuelve el nuevo estado

---
## 🔧 Variables de entorno
- PORT: puerto del servicio API
- GAMEY_BASE_URL: URL base del servicio Rust gamey
- GAMEY_API_VERSION: versión de la API de gamey