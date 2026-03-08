/* NOSONAR */
// Sonar is confusing I18n with credentials 
export type Lang = "es" | "en";

export type Dict = Record<string, string>;

export const translations: Record<Lang, Dict> = {
  es: {
    // Common
    "app.brand": "GameY",
    "common.home": "Home",
    "common.game": "Juego",
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
    "home.start": "Empezar partida",
    "home.goBoard": "Ir al tablero",
    "home.changeUser": "Cambiar usuario",
    "home.card1.title": "✨ Modo rápido",
    "home.card1.text": "Entra al juego y crea una partida.",
    "home.card1.pill": "Tip: “Nueva partida”",
    "home.card2.title": "🧠 Futuro",
    "home.card2.text": "Smart bot, historial, ranking,...",
    "home.card2.pill": "Estate preparado!",
    "home.card3.title": "🤖 Distintos bots!",
    "home.card3.text": "Algunos son más listos que otros",
    "home.card3.pill": "Diferentes dificultades",

    // Game
    "game.new": "Nueva partida",
    "game.send": "Enviar jugada",
    "game.sending": "Enviando…",
    "game.debug": "Debug YEN",
    "game.check": "Comprobar conexión GameY",
    "game.ok": "Conectado correctamente → {msg}",
    "game.fail": "Error de conexión → {msg}",
    "game.back": "Volver a Home",

    // Game Ends
    "game.finished.win": "Partida terminada: Has ganado",
    "game.finished.lost": "Partida terminada: Has perdido",
    "game.finished.draw": "Partida terminada: Empate",
    "game.finished.back": "Volver al juego",
  },

  en: {
    // Common
    "app.brand": "GameY",
    "common.home": "Home",
    "common.game": "Game",
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
    "home.start": "Start game",
    "home.goBoard": "Go to board",
    "home.changeUser": "Change user",
    "home.card1.title": "✨ Quick mode",
    "home.card1.text": "Jump into the game and create a match.",
    "home.card1.pill": "Tip: “New game”",
    "home.card2.title": "🧠 Future",
    "home.card2.text": "Smart bot, history, ranking...",
    "home.card2.pill": "Be prepared!",
    "home.card3.title": "🤖 Different bots!",
    "home.card3.text": "Some are smarter than others",
    "home.card3.pill": "Different difficultites",

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
    "game.finished.back": "Back to game",
  },
};