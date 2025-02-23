import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GameModes from './components/GameModes';
import Game from './components/Game';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GameModes />} />
        <Route path="/game/:modeId" element={<Game />} />
      </Routes>
    </Router>
  );
}

export default App;