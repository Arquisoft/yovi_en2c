// App.tsx
import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './ThemeProvider';
import LoginForm from './LoginForm';
import Game from './Game';
import Home from './Home';
import GameFinished from "./GameFinished";
import RegistrationForm from './RegistrationForm';
import SelectDifficulty from './SelectDifficulty';
import Instructions from './Instructions';
import Statistics from './Statistics';
import UserProfile from './UserProfile';
import Social from './Social';

function App() {
  return (
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginForm />} />
            <Route path="/register" element={<RegistrationForm />} />
            <Route path="/home" element={<Home />} />
            <Route path="/game" element={<Game />} />
            <Route path="/game/finished" element={<GameFinished />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/profile/:username" element={<UserProfile />} />
            <Route path="/select-difficulty" element={<SelectDifficulty />} />
            <Route path="/instructions" element={<Instructions />} />
            <Route path="/social" element={<Social />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
  );
}

export default App;