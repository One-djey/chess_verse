import { useState, useCallback, useRef, useEffect } from "react";
import type { Piece, Position, PieceType } from "../types/chess";
import type { Arena, ColiseumGameState } from "../types/coliseum";
import { generateColiseumArena } from "../utils/chess/coliseumGenerator";
import {
  getColiseumLegalMoves,
  isColiseumInCheck,
  applyColiseumMove,
  hasNoLegalMoves,
} from "../utils/chess/coliseumMoves";
import { recordGame } from "../services/statsService";

export function arenaToChessPieces(arena: Arena): Piece[] {
  const COLORS: ("white" | "black")[] = ["white", "black"];
  return arena.pieces.map((ap, i) => ({
    id: `coliseum-${ap.player}-${ap.piece}-${i}`,
    type: ap.piece,
    color: COLORS[ap.player],
    position: { x: ap.x, y: ap.y },
    hasMoved: false,
  }));
}

function createInitialState(arena: Arena): ColiseumGameState {
  return {
    arena,
    pieces: arenaToChessPieces(arena),
    currentTurn: "white",
    selectedPiece: null,
    validMoves: [],
    isCheck: false,
    gameOver: false,
    winner: null,
    moveCount: { white: 0, black: 0 },
    moves: [],
  };
}

export function useColiseumGame() {
  const startTimeRef = useRef<number>(Date.now());
  const recordedRef = useRef<boolean>(false);
  const [state, setState] = useState<ColiseumGameState>(() => {
    const arena = generateColiseumArena(2);
    return createInitialState(arena);
  });
  const [generating, setGenerating] = useState(false);

  const regenerate = useCallback(() => {
    setGenerating(true);
    recordedRef.current = false;
    setTimeout(() => {
      const arena = generateColiseumArena(2);
      startTimeRef.current = Date.now();
      setState(createInitialState(arena));
      setGenerating(false);
    }, 50);
  }, []);

  const handlePieceSelect = useCallback((piece: Piece) => {
    setState((prev) => {
      if (prev.gameOver) return prev;
      if (piece.color !== prev.currentTurn) return prev;
      if (prev.selectedPiece?.id === piece.id) {
        return { ...prev, selectedPiece: null, validMoves: [] };
      }
      const validMoves = getColiseumLegalMoves(piece, prev.pieces, prev.arena);
      return { ...prev, selectedPiece: piece, validMoves };
    });
  }, []);

  const handleDeselect = useCallback(() => {
    setState((prev) => ({ ...prev, selectedPiece: null, validMoves: [] }));
  }, []);

  const handleMove = useCallback((to: Position) => {
    setState((prev) => {
      if (!prev.selectedPiece || prev.gameOver) return prev;
      const isLegal = prev.validMoves.some((m) => m.x === to.x && m.y === to.y);
      if (!isLegal) return prev;

      const newPieces = applyColiseumMove(prev.selectedPiece, to, prev.pieces);
      const opponent = prev.currentTurn === "white" ? "black" : "white";
      const opponentInCheck = isColiseumInCheck(
        opponent,
        newPieces,
        prev.arena,
      );
      const opponentHasNoMoves = hasNoLegalMoves(
        opponent,
        newPieces,
        prev.arena,
      );

      const gameOver = opponentHasNoMoves;
      const winner: "white" | "black" | null = opponentHasNoMoves
        ? opponentInCheck
          ? prev.currentTurn
          : null // stalemate
        : null;

      return {
        ...prev,
        pieces: newPieces,
        currentTurn: opponent,
        selectedPiece: null,
        validMoves: [],
        isCheck: opponentInCheck,
        gameOver,
        winner,
        moveCount: {
          ...prev.moveCount,
          [prev.currentTurn]: prev.moveCount[prev.currentTurn] + 1,
        },
        moves: [
          ...prev.moves,
          {
            piece: prev.selectedPiece,
            from: prev.selectedPiece.position,
            to,
            capturedPiece:
              prev.pieces.find(
                (p) => p.position.x === to.x && p.position.y === to.y,
              ) ?? null,
            wasPromotion: false,
          },
        ],
      };
    });
  }, []);

  const applyAIMove = useCallback((from: Position, to: Position) => {
    setState((prev) => {
      if (prev.gameOver || prev.currentTurn !== "black") return prev;
      const piece = prev.pieces.find(
        (p) => p.position.x === from.x && p.position.y === from.y && p.color === "black",
      );
      if (!piece) return prev;

      const legalMoves = getColiseumLegalMoves(piece, prev.pieces, prev.arena);
      if (!legalMoves.some((m) => m.x === to.x && m.y === to.y)) return prev;

      const newPieces = applyColiseumMove(piece, to, prev.pieces);
      const opponentInCheck = isColiseumInCheck("white", newPieces, prev.arena);
      const opponentHasNoMoves = hasNoLegalMoves("white", newPieces, prev.arena);
      const gameOver = opponentHasNoMoves;
      const winner: "white" | "black" | null = opponentHasNoMoves
        ? opponentInCheck
          ? "black"
          : null
        : null;

      return {
        ...prev,
        pieces: newPieces,
        currentTurn: "white",
        selectedPiece: null,
        validMoves: [],
        isCheck: opponentInCheck,
        gameOver,
        winner,
        moveCount: { ...prev.moveCount, black: prev.moveCount.black + 1 },
        moves: [
          ...prev.moves,
          {
            piece,
            from: piece.position,
            to,
            capturedPiece:
              prev.pieces.find((p) => p.position.x === to.x && p.position.y === to.y) ??
              null,
            wasPromotion: false,
          },
        ],
      };
    });
  }, []);

  const handleSurrender = useCallback((color: "white" | "black") => {
    setState((prev) => ({
      ...prev,
      gameOver: true,
      winner: color === "white" ? "black" : "white",
      surrenderedBy: color,
    }));
  }, []);

  const getDuration = useCallback(() => Date.now() - startTimeRef.current, []);

  const getTotalMoveCount = useCallback(
    () => state.moveCount.white + state.moveCount.black,
    [state.moveCount],
  );

  // Record game stats when game ends
  useEffect(() => {
    if (!state.gameOver || recordedRef.current) return;

    recordedRef.current = true;

    // Build piece move count for white player
    const pieceMoves: Partial<Record<PieceType, number>> = {};
    state.moves.forEach((move) => {
      if (move.piece.color === "white") {
        pieceMoves[move.piece.type] = (pieceMoves[move.piece.type] ?? 0) + 1;
      }
    });

    // Count white pieces captured
    const piecesLost: Partial<Record<PieceType, number>> = {};
    state.moves.forEach((move) => {
      if (move.capturedPiece && move.capturedPiece.color === "white") {
        piecesLost[move.capturedPiece.type] =
          (piecesLost[move.capturedPiece.type] ?? 0) + 1;
      }
    });

    const totalMoves = state.moveCount.white + state.moveCount.black;
    const isWin = state.winner !== null && state.winner === "white";

    recordGame({
      mode: "coliseum",
      playType: "local",
      winner: state.winner,
      surrenderedBy: state.surrenderedBy,
      drawReason: state.winner ? undefined : "stalemate",
      duration: Date.now() - startTimeRef.current,
      moveCount: totalMoves,
      pieceMoves,
      piecesLost,
      playerColor: "white",
      hour: new Date().getHours(),
      isQuickWin: isWin && totalMoves < 10,
      language: localStorage.getItem("chessverse_language") ?? undefined,
    });
  }, [
    state.gameOver,
    state.winner,
    state.surrenderedBy,
    state.moveCount,
    state.moves,
  ]);

  return {
    state,
    generating,
    handlePieceSelect,
    handleDeselect,
    handleMove,
    handleSurrender,
    applyAIMove,
    regenerate,
    getDuration,
    getTotalMoveCount,
  };
}
