/* NOSONAR */
// Sonar is confusing I18n with credentials 
export type Lang = "es" | "en";

export type Dict = Record<string, string>;

export const translations: Record<Lang, Dict> = {
  es: {
    // Common
    "app.brand": "GameY",
    "common.home": "Inicio",
    "common.game": "Nuevo Juego",
    "common.logout": "Salir",
    "common.language": "Idioma",
    "common.user": "Usuario",

    // Register
    "register.title": "GameY",
    "register.label": "¿Cómo te llamas?",
    "register.placeholder": "Nombre de usuario",
    "register.button": "¡Vamos!",
    "register.loading": "Entrando…",
    "register.error.empty": "Por favor, introduce un nombre de usuario.",
    "register.error.server": "Error del servidor",
    "register.error.network": "Error de red",
    "registration.aria": "Registro de usuario",
    "registration.username": "Usuario",
    "registration.email": "Correo electrónico",
    "registration.password": "Contraseña", //NOSONAR
    "registration.repeatPassword": "Repetir contraseña", //NOSONAR
    "registration.error.repeatPassword": "Debes repetir la contraseña.", //NOSONAR
    "registration.button": "Registrarse",
    "registration.loading": "Registrando…",
    "registration.error.username": "El nombre de usuario es obligatorio.",
    "registration.error.password": "La contraseña es obligatoria.", //NOSONAR
    "registration.error.generic": "Error de registro",
    "registration.error.network": "Error de red",
    "registration.goLogin": "¿Ya tienes cuenta? Volver al login",

    // Login
    "login.aria": "Inicio de sesión",
    "login.username": "Usuario",
    "login.password": "Contraseña", //NOSONAR
    "login.button": "Iniciar sesión",
    "login.loading": "Entrando…",
    "login.error.username": "Por favor, introduce un nombre de usuario.",
    "login.error.password": "Por favor, introduce una contraseña.", //NOSONAR
    "login.error.invalid": "Error de inicio de sesión",
    "login.error.network": "Error de red",
    "login.goRegister": "¿No tienes cuenta? Regístrate",

    // Home
    "home.badge": "Estás en Gamey - Yovi_EN2C",
    "home.welcome": "Hola {username}",
    "home.subtitle":
      "Juega al juego Y",
    "home.quickgame": "Partida rapida",
    "home.goBoard": "Ir al tablero",
    "home.changeUser": "Cambiar usuario",
    "home.card1.title": "📘 Instrucciones",
    "home.card1.text": "Aprende cómo se juega antes de empezar una partida.",
    "home.instructions": "Instrucciones",
    "home.card2.title": "✨ Futuro",
    "home.card2.text": "Smart bot, historial, ranking,...",
    "home.card2.pill": "Estate preparado!",
    "home.card3.title": "🤖 Distintos bots!",
    "home.card3.text": "Algunos son más listos que otros",
    "home.card3.pill": "Diferentes dificultades",
    "home.selectDifficulty": "Seleccionar dificultad",


    // Game
    "game.new": "Nueva partida",
    "game.send": "Enviar jugada",
    "game.sending": "Enviando…",
    "game.debug": "Debug YEN",
    "game.check": "Comprobar conexión GameY",
    "game.ok": "Conectado correctamente → {msg}",
    "game.fail": "Error de conexión → {msg}",
    "game.back": "Volver al Inicio",

    // Game Ends
    "game.finished.win": "Partida terminada: Has ganado",
    "game.finished.lost": "Partida terminada: Has perdido",
    "game.finished.draw": "Partida terminada: Empate",
    "game.finished.back": "Volver al Inicio",

    // Dificultades
    "difficulty.title": "Selecciona la dificultad",
    "difficulty.subtitle": "Elige el nivel del bot",
    "difficulty.random": "Muy fácil",
    "difficulty.easy": "Fácil",
    "difficulty.medium": "Medio",
    "difficulty.hard": "Difícil",
    "difficulty.expert": "Experto",
    "difficulty.extreme": "Extremo",
    "difficulty.start": "Jugar",

    // Tamaño del tablero
    "boardsize.title": "Tamaño del tablero",
    "boardsize.subtitle": "Elige el tamaño o introduce uno personalizado",
    "boardsize.custom.placeholder": "Tamaño personalizado",
    "boardsize.warning.small": "El tablero es muy pequeño, la partida puede no ser divertida",
    "boardsize.warning.large": "Los tableros grandes pueden ralentizar la respuesta del bot",
  
    // Instructions
    "instructions.title": "Instrucciones",
    "instructions.subtitle": "Aprende las reglas básicas de GameY y elige la dificultad que mejor se adapte a ti",
    "instructions.howToPlay.title": "Cómo se juega",
    "instructions.howToPlay.p1": "GameY es un juego por turnos. Tú colocas tus fichas azules y el bot coloca las rojas.",
    "instructions.howToPlay.p2": "El objetivo es conectar los lados del tablero formando un camino continuo con tus fichas.",
    "instructions.howToPlay.p3": "Solo necesitas pulsar una celda vacía para colocar tu ficha. Después, el bot responderá con su jugada.",
    "instructions.difficulty.title": "Dificultades",
    "instructions.difficulty.p1": "El juego dispone de varias dificultades. Las más bajas son más accesibles y las más altas toman decisiones mejores y pueden tardar un poco más en responder.",
    "instructions.difficulty.p2": "Puedes elegir la dificultad antes de comenzar la partida, así como el tamaño del tablero.",
    "instructions.board.title": "Tamaño del tablero",
    "instructions.board.p1": "Puedes jugar en distintos tamaños de tablero. Los tableros pequeños suelen ser más rápidos y sencillos.",
    "instructions.board.p2": "Los tableros más grandes ofrecen partidas más largas y complejas, aunque algunos bots pueden tardar más en calcular su movimiento.",
    "instructions.back": "Volver al inicio",

    //Estadisticas
    "stats.title": "Mis Estadísticas",
    "stats.subtitle": "Resumen de partidas de {username}",
    "stats.totalGames": "Partidas jugadas",
    "stats.wins": "Victorias",
    "stats.losses": "Derrotas",
    "stats.winRate": "Tasa de victoria",
    "stats.winRateBar": "Ratio Victoria / Derrota",
    "stats.gameMode": "Partidas por modo",
    "stats.pvb": "vs Bot",
    "stats.pvp": "vs Jugador",
    "stats.lastFive": "Últimas 5 partidas",
    "stats.opponent": "Rival",
    "stats.result": "Resultado",
    "stats.board": "Tablero",
    "stats.mode": "Modo",
    "stats.date": "Fecha",
    "stats.win": "Victoria",
    "stats.loss": "Derrota",
    "stats.loading": "Cargando…",
    "stats.refresh": "Actualizar",
    "stats.retry": "Reintentar",
    "stats.empty": "Aún no tienes partidas registradas.",
    "stats.playFirst": "¡Juega tu primera partida!",
    "stats.error.generic": "Error al cargar las estadísticas",
    "stats.error.network": "Error de red",
    "common.stats": "Estadísticas",

    //Timer
    "timer.title": "Tiempo por turno",
    "timer.subtitle": "El jugador pierde si no mueve a tiempo. 0 = sin límite.",
    "timer.noLimit": "Sin límite",
    "timer.custom.placeholder": "Segundos personalizados (5–300)",
    "timer.warning.short": "El tiempo mínimo recomendado es 5 segundos",
    "timer.warning.long": "El tiempo máximo recomendado es 300 segundos",
    "timer.botThinking": "El bot está pensando…",
    "timer.yourTurn": "Tu turno",
    "timer.timeout.lost": "¡Se acabó el tiempo! Has perdido",
    "timer.timeout.description": "No realizaste un movimiento a tiempo.",

    //Pistas
    "game.hint": "💡 Pista",
    "game.hintLoading": "Calculando…",

  },

  en: {
    // Common
    "app.brand": "GameY",
    "common.home": "Home",
    "common.game": "New Game",
    "common.logout": "Logout",
    "common.language": "Language",
    "common.user": "User",

    // Register
    "register.title": "GameY",
    "register.label": "What’s your name?",
    "register.placeholder": "Username",
    "register.button": "Let’s go!",
    "register.loading": "Entering…",
    "register.error.empty": "Please enter a username.",
    "register.error.server": "Server error",
    "register.error.network": "Network error",
    "registration.aria": "User registration",
    "registration.username": "Username",
    "registration.email": "Email",
    "registration.password": "Password", //NOSONAR
    "registration.repeatPassword": "Repeat password", //NOSONAR
    "registration.error.repeatPassword": "Repeat password is required.", //NOSONAR
    "registration.button": "Register",
    "registration.loading": "Loading...",
    "registration.error.username": "Username is mandatory.",
    "registration.error.password": "Password is mandatory.", //NOSONAR
    "registration.error.generic": "Registration failed",
    "registration.error.network": "Network error",
    "registration.goLogin": "Already have an account? Back to login",

    // Login
    "login.aria": "User login",
    "login.username": "Username",
    "login.password": "Password", //NOSONAR
    "login.button": "Login",
    "login.loading": "Loading...",
    "login.error.username": "Please enter a username.",
    "login.error.password": "Please enter a password.", //NOSONAR
    "login.error.invalid": "Login failed",
    "login.error.network": "Network error",
    "login.goRegister": "Don’t have an account? Register",

    // Home
    "home.badge": "You are in Gamey - Yovi_EN2C",
    "home.welcome": "Hello {username}",
    "home.subtitle": "Play the Game of Y",
    "home.quickgame": "Start quick game",
    "home.goBoard": "Go to board",
    "home.changeUser": "Change user",
    "home.card1.title": "📘 Instructions",
    "home.card1.text": "Learn how to play before starting a match.",
    "home.instructions": "Instructions",
    "home.card2.title": "✨ Future",
    "home.card2.text": "Smart bot, history, ranking...",
    "home.card2.pill": "Be prepared!",
    "home.card3.title": "🤖 Different bots!",
    "home.card3.text": "Some are smarter than others",
    "home.card3.pill": "Different difficultites",
    "home.selectDifficulty": "Select difficulty",

    // Game
    "game.new": "New game",
    "game.send": "Send move",
    "game.sending": "Sending…",
    "game.debug": "Debug YEN",
    "game.check": "Check GameY connection",
    "game.ok": "Connected → {msg}",
    "game.fail": "Connection error → {msg}",
    "game.back": "Back To Home",

    // Game Ends
    "game.finished.win": "Game Finished: You win",
    "game.finished.lost": "Game Finished: You lost",
    "game.finished.draw": "Game Finished: Draw",
    "game.finished.back": "Back to Home",

    // Difficulties
    "difficulty.title": "Select Difficulty",
    "difficulty.subtitle": "Choose the bot level",
    "difficulty.random": "Very easy",
    "difficulty.easy": "Easy",
    "difficulty.medium": "Medium",
    "difficulty.hard": "Hard",
    "difficulty.expert": "Expert",
    "difficulty.extreme": "Extreme ",
    "difficulty.start": "Play",

    //Board size
    "boardsize.title": "Board Size",
    "boardsize.subtitle": "Choose a size or enter a custom one",
    "boardsize.custom.placeholder": "Custom size",
    "boardsize.warning.small": "Board too small, the game may not be fun",
    "boardsize.warning.large": "Large boards may cause slow bot responses",
  
    // Instructions
    "instructions.title": "Instructions",
    "instructions.subtitle": "Learn the basic rules of GameY and choose the difficulty that fits you best",
    "instructions.howToPlay.title": "How to play",
    "instructions.howToPlay.p1": "GameY is a turn-based game. You place blue pieces and the bot places red pieces.",
    "instructions.howToPlay.p2": "Your goal is to connect the sides of the board by building a continuous path with your pieces.",
    "instructions.howToPlay.p3": "You only need to click an empty cell to place your piece. Then the bot will answer with its move.",
    "instructions.difficulty.title": "Difficulties",
    "instructions.difficulty.p1": "The game includes several difficulty levels. Lower levels are more accessible, while higher ones make better decisions and may take a little longer to respond.",
    "instructions.difficulty.p2": "You can choose the difficulty before starting a match, as well as the board size.",
    "instructions.board.title": "Board size",
    "instructions.board.p1": "You can play on different board sizes. Smaller boards are usually faster and easier.",
    "instructions.board.p2": "Larger boards offer longer and more complex matches, although some bots may take longer to calculate their move.",
    "instructions.back": "Back to home",

    //Stats
    "stats.title": "My Statistics",
    "stats.subtitle": "Game summary for {username}",
    "stats.totalGames": "Games played",
    "stats.wins": "Wins",
    "stats.losses": "Losses",
    "stats.winRate": "Win rate",
    "stats.winRateBar": "Win / Loss ratio",
    "stats.gameMode": "Games by mode",
    "stats.pvb": "vs Bot",
    "stats.pvp": "vs Player",
    "stats.lastFive": "Last 5 games",
    "stats.opponent": "Opponent",
    "stats.result": "Result",
    "stats.board": "Board",
    "stats.mode": "Mode",
    "stats.date": "Date",
    "stats.win": "Win",
    "stats.loss": "Loss",
    "stats.loading": "Loading…",
    "stats.refresh": "Refresh",
    "stats.retry": "Retry",
    "stats.empty": "You have no recorded games yet.",
    "stats.playFirst": "Play your first game!",
    "stats.error.generic": "Failed to load statistics",
    "stats.error.network": "Network error",
    "common.stats": "Statistics",

    //Timer
    "timer.title": "Turn Timer",
    "timer.subtitle": "Player loses if they don't move in time. 0 = no limit.",
    "timer.noLimit": "No limit",
    "timer.custom.placeholder": "Custom seconds (5–300)",
    "timer.warning.short": "Minimum recommended time is 5 seconds",
    "timer.warning.long": "Maximum recommended time is 300 seconds",
    "timer.botThinking": "Bot is thinking…",
    "timer.yourTurn": "Your turn",
    "timer.timeout.lost": "Time's up! You lost",
    "timer.timeout.description": "You didn't make a move in time.",

    //HInts
    "game.hint": "💡 Hint",
    "game.hintLoading": "Thinking…",
  },
};