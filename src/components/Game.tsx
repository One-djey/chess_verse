import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flag } from 'lucide-react';
import ChessBoard from './ChessBoard';
import GameOver from './GameOver';
import { GameState, Piece, Position, GameMode } from '../types/chess';
import { getInitialPieces, isValidMove, isInCheck, hasLegalMoves, wouldBeInCheck, getValidMoves } from '../utils/chess';
import { gameModes } from './GameModes';

export default function Game() {
  const { modeId } = useParams();
  const navigate = useNavigate();
  const gameMode = gameModes.find(mode => mode.id === modeId);

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
  }, [modeId, navigate, gameMode]);

  const handlePieceSelect = (piece: Piece) => {
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

    const newPieces = gameState.pieces.reduce<Piece[]>((acc, piece) => {
      if (piece.position.x === normalizedTarget.x && piece.position.y === normalizedTarget.y) {
        return acc;
      }

      if (piece === gameState.selectedPiece) {
        const updatedPiece = { ...piece, position: normalizedTarget };
        
        if (updatedPiece.type === 'pawn') {
          if ((updatedPiece.color === 'white' && normalizedTarget.y === 0) ||
              (updatedPiece.color === 'black' && normalizedTarget.y === 7)) {
            updatedPiece.type = 'queen';
          }
        }
        
        return [...acc, updatedPiece];
      }

      return [...acc, piece];
    }, []);

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
        <button
          onClick={handleResign}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          <Flag size={20} />
          Surrender
        </button>
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
        />
      </div>

      {gameState.gameOver && gameState.winner && (
        <GameOver
          winner={gameState.winner}
          duration={Date.now() - gameState.startTime}
          moveCount={gameState.moveCount[gameState.winner]}
          onReplay={handleReplay}
        />
      )}
    </div>
  );
}