import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { P2PProvider } from "./context/P2PContext";
import { InstallProvider } from "./context/InstallContext";
import { SkinProvider } from "./context/SkinContext";
import { BoardSkinProvider } from "./context/BoardSkinContext";

import "./i18n";

const ModeSelect = React.lazy(() => import("./components/ModeSelect"));
const GameModes = React.lazy(() => import("./components/GameModes"));
const Game = React.lazy(() => import("./components/Game"));
const P2PLobby = React.lazy(() => import("./components/P2PLobby"));
const ProfilePage = React.lazy(() => import("./components/ProfilePage"));
const MentionsLegales = React.lazy(
  () => import("./components/legal/MentionsLegales"),
);
const PolitiqueConfidentialite = React.lazy(
  () => import("./components/legal/PolitiqueConfidentialite"),
);
const CGU = React.lazy(() => import("./components/legal/CGU"));
const ColiseumGame = React.lazy(() => import("./components/ColiseumGame"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <SkinProvider>
      <BoardSkinProvider>
        <InstallProvider>
          <P2PProvider>
            <Router>
              <ScrollToTop />
              <React.Suspense
                fallback={
                  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<ModeSelect />} />
                  <Route path="/local" element={<GameModes />} />
                  <Route path="/p2p" element={<P2PLobby />} />
                  <Route path="/game/coliseum" element={<ColiseumGame />} />
                  <Route path="/game/:modeId" element={<Game />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route
                    path="/legal/mentions-legales"
                    element={<MentionsLegales />}
                  />
                  <Route
                    path="/legal/confidentialite"
                    element={<PolitiqueConfidentialite />}
                  />
                  <Route path="/legal/cgu" element={<CGU />} />
                </Routes>
              </React.Suspense>
            </Router>
            <Analytics />
          </P2PProvider>
        </InstallProvider>
      </BoardSkinProvider>
    </SkinProvider>
  );
}

export default App;
