# Gateway Service

Gateway for the GameY application.

## Responsibilities
- Acts as a single entry point for the web application
- Routes requests to:
  - users-service
  - Gamey
- Manages game sessions
- Uses YEN notation as the game state format

## Run on local
```bash
npm install
npm start
