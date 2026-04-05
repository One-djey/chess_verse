import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ModeSelect from './components/ModeSelect';
import GameModes from './components/GameModes';
import Game from './components/Game';
import P2PLobby from './components/P2PLobby';
import { P2PProvider } from './context/P2PContext';

function App() {
  return (
    <P2PProvider>
      <Router>
        <Routes>
          <Route path="/" element={<ModeSelect />} />
          <Route path="/local" element={<GameModes />} />
          <Route path="/p2p" element={<P2PLobby />} />
          <Route path="/game/:modeId" element={<Game />} />
        </Routes>
      </Router>
    </P2PProvider>
  );
}

export default App;