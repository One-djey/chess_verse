import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flag, Settings } from 'lucide-react';
import ChessBoard from './ChessBoard';
import GameOver from './GameOver';
import GameSettings from './GameSettings';
import { GameState, Piece, Position, GameMode } from '../types/chess';
import { 
  getInitialPieces, 
  isValidMove, 
  isInCheck, 
  hasLegalMoves, 
  wouldBeInCheck, 
  getValidMoves,
  findCastlingMove
} from '../utils/chess';
import { gameModes } from './GameModes';
import { ChessAI } from '../services/ChessAI';

const STORAGE_KEY = 'chess_settings';

export default function Game() {
  const { modeId } = useParams();
  const navigate = useNavigate();
  const gameMode = gameModes.find(mode => mode.id === modeId);
  const aiRef = useRef<ChessAI | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Charger les settings depuis le localStorage
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    return savedSettings ? JSON.parse(savedSettings) : {
      aiEnabled: true,
      aiDifficulty: 5
    };
  });

  const [gameState, setGameState] = useState<GameState>({
    pieces: [],
    currentTurn: 'white',
    selectedPiece: null,
    validMoves: [],
    isCheck: false,
    startTime: Date.now(),
    moveCount: { white: 0, black: 0 },
    gameOver: false,
    winner: null,
    gameMode: gameMode || gameModes[0]
  });

  // Sauvegarder les settings dans le localStorage quand ils changent
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!modeId || !gameMode) {
      navigate('/');
      return;
    }

    // Initialize pieces based on game mode
    setGameState(prev => ({
      ...prev,
      pieces: getInitialPieces(gameMode),
      gameMode
    }));

    // Initialiser l'IA une seule fois
    const initAI = () => {
      if (!aiRef.current) {
        try {
          aiRef.current = new ChessAI();
        } catch (error) {
          console.error('Erreur lors de l\'initialisation de l\'IA:', error);
        }
      }
    };

    // Appeler l'initialisation une seule fois
    initAI();

    // Cleanup function
    return () => {
      if (aiRef.current) {
        aiRef.current.destroy();
        aiRef.current = null;
      }
    };
  }, [modeId, navigate, gameMode]);

  useEffect(() => {
    if (settings.aiEnabled && gameState.currentTurn === 'black' && !gameState.gameOver) {
      // Ajouter un délai avant le coup de l'IA
      setTimeout(() => {
        handleAIMove();
      }, 500);
    }
  }, [gameState.currentTurn, settings.aiEnabled, gameState.gameOver]);

  const handleAIMove = async () => {
    if (!aiRef.current) {
      setTimeout(() => handleAIMove(), 1000);
      return;
    }

    try {
      const move = await aiRef.current.getNextMove(gameState.pieces);
      
      // Vérifier que l'IA joue bien une pièce noire
      const piece = gameState.pieces.find(
        p => p.position.x === move.from.x && p.position.y === move.from.y && p.color === 'black'
      );
      
      if (!piece) {
        console.error('L\'IA essaie de jouer une pièce qui n\'est pas noire:', move);
        return;
      }

      // Calculer les coups valides
      const validMoves = getValidMoves(piece, gameState.pieces, gameState.gameMode);
      
      // Vérifier si le coup de l'IA est valide
      const isValidMove = validMoves.some(
        validMove => validMove.x === move.to.x && validMove.y === move.to.y
      );
      
      if (!isValidMove) {
        console.error('Le coup proposé par l\'IA n\'est pas valide:', move);
        return;
      }

      // Effectuer le mouvement
      const normalizedTarget = {
        x: ((move.to.x % 8) + 8) % 8,
        y: ((move.to.y % 8) + 8) % 8
      };

      // Vérifier si c'est un roque
      const castlingMove = findCastlingMove(piece, normalizedTarget, gameState.pieces, gameState.gameMode);

      // Identifier la pièce capturée par sa position
      const capturedPiece = gameState.pieces.find(p => 
        p.position.x === normalizedTarget.x && 
        p.position.y === normalizedTarget.y
      );

      // Créer une nouvelle liste en retirant la pièce capturée si elle existe
      let newPieces = capturedPiece 
        ? gameState.pieces.filter(p => p.id !== capturedPiece.id)
        : [...gameState.pieces];

      // Mettre à jour la pièce déplacée
      newPieces = newPieces.map(p => {
        if (p.id === piece.id) {
          // Gérer la promotion des pions
          const shouldPromote = p.type === 'pawn' && (
            (p.color === 'white' && normalizedTarget.y === 0) ||
            (p.color === 'black' && normalizedTarget.y === 7)
          );

          return {
            ...p,
            position: normalizedTarget,
            hasMoved: true,
            type: shouldPromote ? 'queen' : p.type
          };
        }
        return p;
      });

      // Gérer le roque si nécessaire
      if (castlingMove) {
        newPieces = newPieces.map(p => {
          if (p.id === castlingMove.rook.id) {
            return {
              ...p,
              position: castlingMove.rookTarget,
              hasMoved: true
            };
          }
          return p;
        });
      }

      const nextTurn = 'white';
      const nextIsCheck = isInCheck(nextTurn, newPieces, gameState.gameMode);
      const nextHasLegalMoves = hasLegalMoves(nextTurn, newPieces, gameState.gameMode);

      setGameState(prev => ({
        ...prev,
        pieces: newPieces,
        currentTurn: nextTurn,
        selectedPiece: null,
        validMoves: [],
        isCheck: nextIsCheck,
        moveCount: {
          ...prev.moveCount,
          black: prev.moveCount.black + 1,
        },
        gameOver: nextIsCheck && !nextHasLegalMoves,
        winner: nextIsCheck && !nextHasLegalMoves ? 'black' : null,
      }));
    } catch (error) {
      console.error("Erreur lors du mouvement de l'IA:", error);
    }
  };

  const handleSettingsChange = (newSettings: typeof settings) => {
    setSettings(newSettings);
    if (aiRef.current) {
      aiRef.current.setDifficulty(newSettings.aiDifficulty);
    }
  };

  const handlePieceSelect = (piece: Piece) => {
    // Empêcher la sélection des pièces noires si l'IA est activée
    if (settings.aiEnabled && piece.color === 'black') return;
    
    if (piece.color !== gameState.currentTurn) return;
    
    const validMoves = getValidMoves(piece, gameState.pieces, gameState.gameMode);
    
    setGameState(prev => ({
      ...prev,
      selectedPiece: piece,
      validMoves,
    }));
  };

  const handleMove = (target: Position) => {
    if (!gameState.selectedPiece) return;

    const normalizedTarget = {
      x: ((target.x % 8) + 8) % 8,
      y: ((target.y % 8) + 8) % 8
    };

    // Check if this is a castling move
    const castlingMove = findCastlingMove(
      gameState.selectedPiece, 
      normalizedTarget, 
      gameState.pieces, 
      gameState.gameMode
    );

    // Identifier la pièce capturée par sa position
    const capturedPiece = gameState.pieces.find(p => 
      p.position.x === normalizedTarget.x && 
      p.position.y === normalizedTarget.y
    );

    // Créer une nouvelle liste en retirant la pièce capturée si elle existe
    let newPieces = capturedPiece 
      ? gameState.pieces.filter(p => p.id !== capturedPiece.id)
      : [...gameState.pieces];

    // Mettre à jour la pièce déplacée
    newPieces = newPieces.map(p => {
      if (p.id === gameState.selectedPiece?.id) {
        // Gérer la promotion des pions
        const shouldPromote = p.type === 'pawn' && (
          (p.color === 'white' && normalizedTarget.y === 0) ||
          (p.color === 'black' && normalizedTarget.y === 7)
        );

        return {
          ...p,
          position: normalizedTarget,
          hasMoved: true,
          type: shouldPromote ? 'queen' : p.type
        };
      }
      return p;
    });

    // Gérer le roque si nécessaire
    if (castlingMove) {
      newPieces = newPieces.map(p => {
        if (p.id === castlingMove.rook.id) {
          return {
            ...p,
            position: castlingMove.rookTarget,
            hasMoved: true
          };
        }
        return p;
      });
    }

    const nextTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
    const nextIsCheck = isInCheck(nextTurn, newPieces, gameState.gameMode);
    const nextHasLegalMoves = hasLegalMoves(nextTurn, newPieces, gameState.gameMode);

    setGameState(prev => ({
      ...prev,
      pieces: newPieces,
      currentTurn: nextTurn,
      selectedPiece: null,
      validMoves: [],
      isCheck: nextIsCheck,
      moveCount: {
        ...prev.moveCount,
        [prev.currentTurn]: prev.moveCount[prev.currentTurn] + 1,
      },
      gameOver: nextIsCheck && !nextHasLegalMoves,
      winner: nextIsCheck && !nextHasLegalMoves ? prev.currentTurn : null,
    }));
  };

  const handleResign = () => {
    setGameState(prev => ({
      ...prev,
      gameOver: true,
      winner: prev.currentTurn === 'white' ? 'black' : 'white',
    }));
  };

  const handleReplay = () => {
    setGameState({
      pieces: getInitialPieces(gameMode || gameModes[0]),
      currentTurn: 'white',
      selectedPiece: null,
      validMoves: [],
      isCheck: false,
      startTime: Date.now(),
      moveCount: { white: 0, black: 0 },
      gameOver: false,
      winner: null,
      gameMode: gameMode || gameModes[0]
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md px-4 py-2 flex justify-between items-center">
        <h1 className="text-xl font-bold">{gameState.gameMode.title}</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Settings size={20} />
            Settings
          </button>
          <button
            onClick={handleResign}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            <Flag size={20} />
            Surrender
          </button>
        </div>
      </nav>
      
      <div className="flex items-center justify-center p-8">
        <ChessBoard
          pieces={gameState.pieces}
          currentTurn={gameState.currentTurn}
          selectedPiece={gameState.selectedPiece}
          validMoves={gameState.validMoves}
          isCheck={gameState.isCheck}
          onPieceSelect={handlePieceSelect}
          onMove={handleMove}
          gameMode={gameState.gameMode}
          aiEnabled={settings.aiEnabled}
        />
      </div>

      <GameSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />

      {gameState.gameOver && gameState.winner && (
        <GameOver
          winner={gameState.winner}
          duration={Date.now() - gameState.startTime}
          moveCount={gameState.moveCount[gameState.winner]}
          onReplay={handleReplay}
          aiEnabled={settings.aiEnabled}
          aiDifficulty={settings.aiDifficulty}
        />
      )}
    </div>
  );
}
