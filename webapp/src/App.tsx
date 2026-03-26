import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './LoginForm';
import Game from './Game';
import Home from './Home';
import GameFinished from "./GameFinished";
import RegistrationForm from './RegistrationForm';
import Stats from './Stats';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/register" element={<RegistrationForm />} />
        <Route path="/home" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/game/finished" element={<GameFinished />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
