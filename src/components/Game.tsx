import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flag } from 'lucide-react';
import ChessBoard from './ChessBoard';
import GameOver from './GameOver';
import { GameState, Piece, Position } from '../types/chess';
import { initialPieces, isValidMove, isInCheck, hasLegalMoves, wouldBeInCheck } from '../utils/chess';

export default function Game() {
  const { modeId } = useParams();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState>({
    pieces: initialPieces,
    currentTurn: 'white',
    selectedPiece: null,
    validMoves: [],
    isCheck: false,
    startTime: Date.now(),
    moveCount: { white: 0, black: 0 },
    gameOver: false,
    winner: null,
  });

  useEffect(() => {
    if (!modeId) {
      navigate('/');
    }
  }, [modeId, navigate]);

  const handlePieceSelect = (piece: Piece) => {
    if (piece.color !== gameState.currentTurn) return;

    const validMoves = Array(8)
      .fill(null)
      .flatMap((_, y) =>
        Array(8)
          .fill(null)
          .map((_, x) => ({ x, y }))
          .filter(pos => 
            isValidMove(piece, pos, gameState.pieces) && 
            !wouldBeInCheck(piece, pos, gameState.pieces)
          )
      );

    setGameState(prev => ({
      ...prev,
      selectedPiece: piece,
      validMoves,
    }));
  };

  const handleMove = (target: Position) => {
    if (!gameState.selectedPiece) return;

    // Create a new array of pieces with the move applied
    const newPieces = gameState.pieces.reduce<Piece[]>((acc, piece) => {
      // Skip the captured piece if there is one
      if (piece.position.x === target.x && piece.position.y === target.y) {
        return acc;
      }

      // Update the moved piece's position
      if (piece === gameState.selectedPiece) {
        const updatedPiece = { ...piece, position: target };
        
        // Handle pawn promotion
        if (updatedPiece.type === 'pawn') {
          if ((updatedPiece.color === 'white' && target.y === 0) ||
              (updatedPiece.color === 'black' && target.y === 7)) {
            updatedPiece.type = 'queen';
          }
        }
        
        return [...acc, updatedPiece];
      }

      // Keep other pieces unchanged
      return [...acc, piece];
    }, []);

    const nextTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
    const nextIsCheck = isInCheck(nextTurn, newPieces);
    const nextHasLegalMoves = hasLegalMoves(nextTurn, newPieces);

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
      gameOver: nextIsCheck && !nextHasLegalMoves, // Échec et mat
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
      pieces: initialPieces,
      currentTurn: 'white',
      selectedPiece: null,
      validMoves: [],
      isCheck: false,
      startTime: Date.now(),
      moveCount: { white: 0, black: 0 },
      gameOver: false,
      winner: null,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md px-4 py-2 flex justify-between items-center">
        <h1 className="text-xl font-bold">Échecs</h1>
        <button
          onClick={handleResign}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          <Flag size={20} />
          Abandonner
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