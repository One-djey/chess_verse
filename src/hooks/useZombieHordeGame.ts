import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameMode, Piece, PieceColor, PieceType, Position } from "../types/chess";
import type { ZombieHordeState } from "../types/zombieHorde";
import {
  getValidMoves,
  isInCheck,
  hasLegalMoves,
  findCastlingMove,
  getPieceAt,
} from "../utils/chess/moves";
import { getInitialPieces } from "../utils/chess/board";
import {
  countActiveZombies,
  getSpawnableSquares,
  buildWavePieces,
  shouldSpawnWave,
} from "../utils/chess/zombieWaves";
import { ZombieAIPool } from "../services/ZombieAIPool";
import { recordGame } from "../services/statsService";

const CLASSIC_MODE: GameMode = {
  id: "classic",
  title: "Classic",
  description: "",
  image: "",
  rules: {},
};

// White-only initial pieces (no black pieces for zombie horde start)
function getInitialWhitePieces(): Piece[] {
  return getInitialPieces(CLASSIC_MODE).filter((p) => p.color === "white");
}

function makeInitialState(): ZombieHordeState {
  return {
    pieces: getInitialWhitePieces(),
    selectedPiece: null,
    validMoves: [],
    isCheck: false,
    gameOver: false,
    winner: null,
    wave: {
      currentWave: 0,
      zombiesKilled: 0,
      playerMovesSinceLastSpawn: 0,
      isZombiesThinking: false,
    },
    pendingPromotion: null,
    startTime: Date.now(),
    firstMoveTime: null,
    moveCount: 0,
  };
}

// ── Move application helpers ─────────────────────────────────────────────────

interface PlayerMoveResult {
  newPieces: Piece[];
  newEnPassantTarget: Position | undefined;
  capturedZombies: number;
}

function applyPlayerMove(
  pieces: Piece[],
  piece: Piece,
  target: Position,
  promotionType: PieceType | undefined,
  enPassantTarget: Position | undefined,
): PlayerMoveResult {
  const from = piece.position;
  const captured = getPieceAt(target, pieces);

  const isEpCapture =
    !!enPassantTarget &&
    piece.type === "pawn" &&
    target.x === enPassantTarget.x &&
    target.y === enPassantTarget.y &&
    captured === null;

  let newPieces = captured ? pieces.filter((p) => p.id !== captured.id) : [...pieces];

  if (isEpCapture) {
    // The en-passant captured pawn sits at (target.x, from.y)
    newPieces = newPieces.filter(
      (p) => !(p.position.x === target.x && p.position.y === from.y),
    );
  }

  // Apply promotion if needed
  const finalType: PieceType =
    piece.type === "pawn" && target.y === 0 ? (promotionType ?? "queen") : piece.type;

  newPieces = newPieces.map((p) =>
    p.id === piece.id ? { ...p, type: finalType, position: target, hasMoved: true } : p,
  );

  // Move rook for castling
  const castlingMove = findCastlingMove(piece, target, pieces, CLASSIC_MODE);
  if (castlingMove) {
    newPieces = newPieces.map((p) =>
      p.id === castlingMove.rook.id
        ? { ...p, position: castlingMove.rookTarget, hasMoved: true }
        : p,
    );
  }

  // En passant target for the NEXT move (if white pawn double-pushed)
  let newEnPassantTarget: Position | undefined;
  if (piece.type === "pawn" && Math.abs(target.y - from.y) === 2) {
    newEnPassantTarget = { x: target.x, y: (from.y + target.y) / 2 };
  }

  const capturedZombies =
    (captured?.color === "black" ? 1 : 0) + (isEpCapture ? 1 : 0);

  return { newPieces, newEnPassantTarget, capturedZombies };
}

function applyZombieMoves(
  pieces: Piece[],
  zombiePieces: Piece[],
  moveMap: Map<string, { from: Position; to: Position }>,
): Piece[] {
  let result = [...pieces];

  for (const zombie of zombiePieces) {
    const move = moveMap.get(zombie.id);
    if (!move) continue;

    const occupant = result.find(
      (p) => p.position.x === move.to.x && p.position.y === move.to.y,
    );

    if (occupant) {
      if (occupant.color === ("black" as PieceColor)) continue; // collision with another zombie
      // Capture white piece
      result = result.filter((p) => p.id !== occupant.id);
    }

    result = result.map((p) =>
      p.id === zombie.id ? { ...p, position: move.to, hasMoved: true } : p,
    );
  }

  return result;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useZombieHordeGame() {
  const { i18n } = useTranslation();
  const [state, setState] = useState<ZombieHordeState>(makeInitialState);
  const [enPassantTarget, setEnPassantTarget] = useState<Position | undefined>(
    undefined,
  );
  const [totalZombiesSpawned, setTotalZombiesSpawned] = useState(0);

  const poolRef = useRef<ZombieAIPool | null>(null);
  const gameEndRecordedRef = useRef(false);
  // Refs to avoid stale closures in async zombie phase
  const stateRef = useRef(state);
  const epRef = useRef(enPassantTarget);
  const spawnedRef = useRef(totalZombiesSpawned);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    epRef.current = enPassantTarget;
  }, [enPassantTarget]);
  useEffect(() => {
    spawnedRef.current = totalZombiesSpawned;
  }, [totalZombiesSpawned]);

  // Pool lifecycle
  useEffect(() => {
    poolRef.current = new ZombieAIPool(8);
    return () => {
      poolRef.current?.destroy();
    };
  }, []);

  // Record game on end (once)
  useEffect(() => {
    if (!state.gameOver || gameEndRecordedRef.current) return;
    gameEndRecordedRef.current = true;
    recordGame({
      mode: "zombie-horde",
      playType: "local",
      winner: state.winner === "white" ? "white" : "black",
      duration: getDuration(),
      moveCount: state.moveCount,
      pieceMoves: {},
      piecesLost: {},
      playerColor: "white",
      hour: new Date().getHours(),
      language: i18n.language,
      zombieHordeWon: state.winner === "white",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.gameOver]);

  function getDuration(): number {
    if (!state.firstMoveTime) return 0;
    return Date.now() - state.firstMoveTime;
  }

  // ── Zombie AI phase (async) ──────────────────────────────────────────────────

  const runZombiePhase = useCallback(
    async (pieces: Piece[], currentWave: number, zombiesKilled: number) => {
      const pool = poolRef.current;
      if (!pool) return;

      const zombiePieces = pieces.filter((p) => p.color === "black");

      if (zombiePieces.length === 0) {
        setState((prev) => ({
          ...prev,
          wave: { ...prev.wave, isZombiesThinking: false },
        }));
        return;
      }

      let moveMap: Map<string, { from: Position; to: Position }>;
      try {
        moveMap = await pool.getMovesForAllZombies(pieces, zombiePieces);
      } catch {
        // Pool-level failure: zombies don't move this turn
        moveMap = new Map();
      }

      const piecesAfterZombies = applyZombieMoves(pieces, zombiePieces, moveMap);

      const nowInCheck = isInCheck("white", piecesAfterZombies, CLASSIC_MODE);
      const hasLegal = hasLegalMoves(
        "white",
        piecesAfterZombies,
        CLASSIC_MODE,
        epRef.current,
      );

      if (nowInCheck && !hasLegal) {
        setState((prev) => ({
          ...prev,
          pieces: piecesAfterZombies,
          isCheck: true,
          gameOver: true,
          winner: "zombie",
          wave: {
            ...prev.wave,
            currentWave,
            zombiesKilled,
            isZombiesThinking: false,
          },
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        pieces: piecesAfterZombies,
        isCheck: nowInCheck,
        wave: {
          ...prev.wave,
          currentWave,
          zombiesKilled,
          isZombiesThinking: false,
        },
      }));
    },
    [],
  );

  // ── White move execution ─────────────────────────────────────────────────────

  const executeWhiteMove = useCallback(
    async (
      piece: Piece,
      to: Position,
      promotionType: PieceType | undefined,
      currentPieces: Piece[],
      currentEnPassantTarget: Position | undefined,
      currentSpawned: number,
      currentWave: number,
      currentZombiesKilled: number,
      currentPlayerMovesSinceLastSpawn: number,
      currentMoveCount: number,
      currentFirstMoveTime: number | null,
    ) => {
      const { newPieces, newEnPassantTarget, capturedZombies } = applyPlayerMove(
        currentPieces,
        piece,
        to,
        promotionType,
        currentEnPassantTarget,
      );

      const newZombiesKilled = currentZombiesKilled + capturedZombies;
      const newMoveCount = currentMoveCount + 1;
      const newPlayerMoves = currentPlayerMovesSinceLastSpawn + 1;
      const newFirstMoveTime = currentFirstMoveTime ?? Date.now();

      // Victory check: wave 10+ completed and all zombies eliminated
      if (currentWave >= 10 && countActiveZombies(newPieces) === 0) {
        setState((prev) => ({
          ...prev,
          pieces: newPieces,
          selectedPiece: null,
          validMoves: [],
          moveCount: newMoveCount,
          firstMoveTime: newFirstMoveTime,
          wave: {
            ...prev.wave,
            currentWave,
            zombiesKilled: newZombiesKilled,
            playerMovesSinceLastSpawn: newPlayerMoves,
            isZombiesThinking: false,
          },
          gameOver: true,
          winner: "white",
        }));
        setEnPassantTarget(newEnPassantTarget);
        return;
      }

      // Spawn check
      let piecesAfterSpawn = newPieces;
      let nextWave = currentWave;
      let newTotalSpawned = currentSpawned;
      let movesSinceLastSpawn = newPlayerMoves;

      const activeAfterMove = countActiveZombies(newPieces);
      const nextWaveToSpawn = currentWave + 1;
      if (shouldSpawnWave(nextWaveToSpawn, activeAfterMove, newPlayerMoves)) {
        const spawnableSquares = getSpawnableSquares(nextWaveToSpawn, newPieces);
        const newZombies = buildWavePieces(nextWaveToSpawn, spawnableSquares, newTotalSpawned);
        piecesAfterSpawn = [...newPieces, ...newZombies];
        nextWave = nextWaveToSpawn;
        newTotalSpawned += newZombies.length;
        movesSinceLastSpawn = 0;
      }

      // Set state with white move applied, mark zombies as thinking
      setState((prev) => ({
        ...prev,
        pieces: piecesAfterSpawn,
        selectedPiece: null,
        validMoves: [],
        isCheck: false,
        moveCount: newMoveCount,
        firstMoveTime: newFirstMoveTime,
        wave: {
          currentWave: nextWave,
          zombiesKilled: newZombiesKilled,
          playerMovesSinceLastSpawn: movesSinceLastSpawn,
          isZombiesThinking: true,
        },
      }));
      setEnPassantTarget(newEnPassantTarget);
      setTotalZombiesSpawned(newTotalSpawned);

      // Run zombie AI
      await runZombiePhase(piecesAfterSpawn, nextWave, newZombiesKilled);
    },
    [runZombiePhase],
  );

  // ── Public handlers ──────────────────────────────────────────────────────────

  const handlePieceSelect = useCallback(
    (piece: Piece) => {
      if (state.gameOver || state.wave.isZombiesThinking || state.pendingPromotion) return;
      if (piece.color !== "white") return;

      const moves = getValidMoves(piece, state.pieces, CLASSIC_MODE, enPassantTarget);
      setState((prev) => ({ ...prev, selectedPiece: piece, validMoves: moves }));
    },
    [state, enPassantTarget],
  );

  const handleMove = useCallback(
    (to: Position) => {
      const { selectedPiece, pieces } = state;
      if (!selectedPiece || state.gameOver || state.wave.isZombiesThinking) return;

      // Pawn promotion
      if (selectedPiece.type === "pawn" && to.y === 0 && selectedPiece.color === "white") {
        setState((prev) => ({
          ...prev,
          pendingPromotion: { piece: selectedPiece, to },
        }));
        return;
      }

      // Mark thinking immediately (synchronous setState) so handlePieceSelect
      // and handleMove guards see the flag as soon as act() flushes, without
      // depending on async microtasks from executeWhiteMove.
      setState((prev) => ({
        ...prev,
        selectedPiece: null,
        validMoves: [],
        wave: { ...prev.wave, isZombiesThinking: true },
      }));

      void executeWhiteMove(
        selectedPiece,
        to,
        undefined,
        pieces,
        enPassantTarget,
        totalZombiesSpawned,
        state.wave.currentWave,
        state.wave.zombiesKilled,
        state.wave.playerMovesSinceLastSpawn,
        state.moveCount,
        state.firstMoveTime,
      );
    },
    [state, enPassantTarget, totalZombiesSpawned, executeWhiteMove],
  );

  const handlePromotion = useCallback(
    (promotionType: PieceType) => {
      const { pendingPromotion, pieces } = state;
      if (!pendingPromotion) return;
      setState((prev) => ({ ...prev, pendingPromotion: null }));
      void executeWhiteMove(
        pendingPromotion.piece,
        pendingPromotion.to,
        promotionType,
        pieces,
        enPassantTarget,
        totalZombiesSpawned,
        state.wave.currentWave,
        state.wave.zombiesKilled,
        state.wave.playerMovesSinceLastSpawn,
        state.moveCount,
        state.firstMoveTime,
      );
    },
    [state, enPassantTarget, totalZombiesSpawned, executeWhiteMove],
  );

  const handleSurrender = useCallback(() => {
    setState((prev) => ({
      ...prev,
      gameOver: true,
      winner: "zombie",
      wave: { ...prev.wave, isZombiesThinking: false },
    }));
  }, []);

  const handleRestart = useCallback(() => {
    gameEndRecordedRef.current = false;
    setState(makeInitialState());
    setEnPassantTarget(undefined);
    setTotalZombiesSpawned(0);
  }, []);

  return {
    state,
    enPassantTarget,
    handlePieceSelect,
    handleMove,
    handlePromotion,
    handleSurrender,
    handleRestart,
    getDuration,
  };
}
