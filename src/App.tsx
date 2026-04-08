import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import ModeSelect from './components/ModeSelect';
import GameModes from './components/GameModes';
import Game from './components/Game';
import P2PLobby from './components/P2PLobby';
import { P2PProvider } from './context/P2PContext';
import { InstallProvider } from './context/InstallContext';
import './i18n';

function App() {
  return (
    <InstallProvider>
    <P2PProvider>
      <Router>
        <Routes>
          <Route path="/" element={<ModeSelect />} />
          <Route path="/local" element={<GameModes />} />
          <Route path="/p2p" element={<P2PLobby />} />
          <Route path="/game/:modeId" element={<Game />} />
        </Routes>
      </Router>
      <Analytics />
    </P2PProvider>
    </InstallProvider>
  );
}

export default App;
