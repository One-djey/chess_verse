import React from "react";

import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGameLayout } from "../hooks/useGameLayout";
import GameLabels, {
  CaptureContext,
  GameLabelItem,
  LabelVariant,
  LegendaryMeta,
} from "./GameLabels";
import { PromotionPicker } from "./PromotionPicker";
import { detectLegendaryPattern } from "../utils/chess/legendaryPatterns";
import ChessBoard from "./ChessBoard";
import GameOver from "./GameOver";
import NavBar from "./NavBar";
import P2PStatusBar from "./P2PStatusBar";
import {
  Piece,
  Position,
  PieceColor,
} from "../types/chess";
import {
  getValidMoves,
  hasRawMoves,
  hasLegalMoves,
  isInCheck,
  applyMoveToState,
  normalizePos,
  isSquareUnderAttack,
  detectTactic,
  MoveContext,
  getSmartFallbackMove,
  isDrawByRepetition,
  isDrawBy50Moves,
} from "../utils/chess";
import { detectScholarsMate } from "../utils/chess/tactics";
import { resolveGameMode } from "../utils/gameLogic";
import { useP2P } from "../hooks/useP2P";
import { useChessGame } from "../hooks/useChessGame";
import { useP2PGame } from "../hooks/useP2PGame";
import { useSkin } from "../hooks/useSkin";
import { useBoardSkinStyle } from "../hooks/useBoardSkinStyle";
import { useBoardSkin } from "../hooks/useBoardSkin";
import { getBoardSkinDef } from "../utils/boardSkin";
import { CampDecoration, SideCamp } from "./CampDecoration";
import { recordGame } from "../services/statsService";
import type { PlayType } from "../services/statsService";
import type { PieceType } from "../types/chess";

// NOTE: The following pure functions were extracted to utility modules (REC-001):
// - detectScholarsMate → src/utils/chess/tactics.ts
// - resolveGameMode    → src/utils/gameLogic.ts
//
// Two items from the original REC-001 report were intentionally NOT extracted:
//
// 1. "Session stats accumulation" (sessionStatsRef, hintsFollowedRef, wasPromotedRef):
//    These refs are React-managed — their lifecycle is tied to the component mount/unmount
//    and to useEffect reset triggers. Extracting them would require threading the ref
//    objects through every handler, coupling a utility to React.RefObject<T> and making
//    the API awkward. The logic itself (increment counters, spread into recordGame) has
//    no testable invariant beyond what statsService.test.ts already covers.
//
// 2. "AI move validation chain" (the applyMove / trigger closure inside the AI useEffect):
//    This closure calls chess.setGameState, chess.gameStateRef, addLabel, triggerAnnotation
//    and chess.aiRef — all of which are React state/refs. It is not a pure function and
//    cannot be extracted without re-designing the whole AI interaction as a service with
//    callbacks. The correctness of the chain is tested indirectly through useChessGame
//    integration tests; isolated unit testing would require a full mock of game state.

export default function Game() {
  const { modeId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const p2p = useP2P();
  const { skin } = useSkin();
  // Ref updated on every render so the cleanup always reads the *current* P2P state,
  // avoiding the stale-closure problem of capturing p2p.isP2PMode at first-render time.
  const isActiveP2PRef = React.useRef(false);
  isActiveP2PRef.current = modeId === "p2p" && p2p.isP2PMode;

  // ── Session stats tracking ─────────────────────────────────────────────────
  // Accumulates per-piece move/capture counts during the current game.
  // Flushed to statsService when the game ends; reset on each new game.
  // NOTE: the reset effect (tied to chess.gameState.startTime) is declared
  // after `chess` is initialised below, to avoid a TDZ error.
  const sessionStatsRef = React.useRef<{
    pieceMoves: Partial<Record<PieceType, number>>;
    piecesLost: Partial<Record<PieceType, number>>;
  }>({ pieceMoves: {}, piecesLost: {} });

  /** Number of times the player followed the hint suggestion this game. */
  const hintsFollowedRef = React.useRef(0);
  /** Whether the player promoted a pawn during this game. */
  const wasPromotedRef = React.useRef(false);

  // If we enter a non-P2P game while P2P state is still active (e.g. user navigated
  // away via the NavBar without going through handleLeaveP2P), clean up the stale state.
  // Also clean up on unmount so the WebRTC room is closed immediately when leaving,
  // even via NavBar/browser-back, without waiting for the next game to mount.
  React.useEffect(() => {
    if (modeId !== "p2p" && p2p.isP2PMode) {
      p2p.leaveRoom();
    }
    return () => {
      if (isActiveP2PRef.current) p2p.leaveRoom();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gameMode = resolveGameMode(modeId, p2p.gameMode);

  const chess = useChessGame({
    modeId,
    navigate,
    gameMode,
    isP2PMode: p2p.isP2PMode,
    p2pInitialPieces: p2p.initialPieces,
  });

  const p2pGame = useP2PGame({
    isP2PMode: p2p.isP2PMode,
    role: p2p.role,
    playerColor: p2p.playerColor,
    actions: p2p.actions,
    room: p2p.room,
    gameMode,
    setGameState: chess.setGameState,
    gameStateRef: chess.gameStateRef,
    chessResetGame: chess.resetGame,
  });

  // Reset session stats whenever a new game starts (startTime changes).
  // Declared here (after `chess`) to avoid a temporal dead zone error.
  React.useEffect(() => {
    sessionStatsRef.current = { pieceMoves: {}, piecesLost: {} };
    hintsFollowedRef.current = 0;
    wasPromotedRef.current = false;
  }, [chess.gameState.startTime]);

  // ── Game-over modal visibility ────────────────────────────────────────────
  // Tracks whether the GameOver modal is shown. Automatically opens when the
  // game ends; can be dismissed by the user to inspect the final board state.
  const [gameOverVisible, setGameOverVisible] = React.useState(false);

  React.useEffect(() => {
    if (chess.gameState.gameOver) setGameOverVisible(true);
  }, [chess.gameState.gameOver]);

  // ── AI move trigger ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (
      !chess.aiEnabled ||
      chess.gameState.currentTurn !== "black" ||
      chess.gameState.gameOver
    )
      return;

    let cancelled = false;

    const clearAiThinking = () => {
      if (aiThinkingInitTimerRef.current) {
        clearTimeout(aiThinkingInitTimerRef.current);
        aiThinkingInitTimerRef.current = null;
      }
      if (aiThinkingIntervalRef.current) {
        clearInterval(aiThinkingIntervalRef.current);
        aiThinkingIntervalRef.current = null;
      }
      if (aiThinkingLabelIdRef.current) {
        dismissLabel(aiThinkingLabelIdRef.current);
        aiThinkingLabelIdRef.current = null;
      }
      aiThinkingIndexRef.current = 0;
    };

    const applyMove = (move: {
      from: { x: number; y: number };
      to: { x: number; y: number };
      promotionType?: PieceType;
    }) => {
      clearAiThinking();
      // Don't apply an in-flight AI move if the game is already over
      // (e.g. the player resigned while the engine was computing).
      if (chess.gameStateRef.current.gameOver) return;
      const currentPieces = chess.gameStateRef.current.pieces;
      const piece = currentPieces.find(
        (p) =>
          p.position.x === move.from.x &&
          p.position.y === move.from.y &&
          p.color === "black",
      );
      if (!piece) return;
      const valid = getValidMoves(
        piece,
        currentPieces,
        chess.gameStateRef.current.gameMode,
        chess.gameStateRef.current.enPassantTarget,
      ).some((v) => v.x === move.to.x && v.y === move.to.y);
      if (!valid) {
        // Stockfish suggested a move that violates special-mode rules
        // (e.g. assimilation, borderless). Use the smart fallback chain.
        console.warn(
          "[AI] Illegal move suggested by Stockfish — activating smart fallback.",
          move,
        );
        const fallback = getSmartFallbackMove(
          currentPieces,
          chess.gameStateRef.current.gameMode,
        );
        if (fallback) {
          applyMove(fallback);
        } else {
          chess.setGameState((prev) => {
            if (prev.gameOver) return prev;
            const inCheck = isInCheck(
              prev.currentTurn,
              prev.pieces,
              prev.gameMode,
            );
            return {
              ...prev,
              gameOver: true,
              winner: inCheck
                ? prev.currentTurn === "white"
                  ? "black"
                  : "white"
                : null,
              drawReason: inCheck ? undefined : "stalemate",
            };
          });
        }
        return;
      }
      // Track AI captures: the piece being taken is a human (white) piece
      const aiCaptured = currentPieces.find(
        (p) =>
          p.color !== piece.color &&
          p.position.x === move.to.x &&
          p.position.y === move.to.y,
      );
      if (aiCaptured && aiCaptured.type !== "pawn") {
        const t = aiCaptured.type as PieceType;
        sessionStatsRef.current.piecesLost[t] =
          (sessionStatsRef.current.piecesLost[t] ?? 0) + 1;
      }
      chess.setGameState((prev) => {
        const nextState = applyMoveToState(
          prev,
          piece,
          move.to,
          move.promotionType,
        );
        const capturedPiece =
          prev.pieces.find(
            (p) =>
              p.color !== piece.color &&
              p.position.x === move.to.x &&
              p.position.y === move.to.y,
          ) ?? null;
        triggerAnnotation({
          piece,
          from: piece.position,
          to: move.to,
          capturedPiece,
          wasPromotion:
            piece.type === "pawn" && (move.to.y === 0 || move.to.y === 7),
          wasCastling:
            piece.type === "king" &&
            Math.abs(piece.position.x - move.to.x) === 2,
          wasEnPassant:
            piece.type === "pawn" &&
            !!prev.enPassantTarget &&
            move.to.x === prev.enPassantTarget.x &&
            move.to.y === prev.enPassantTarget.y &&
            !capturedPiece,
          prevPieces: prev.pieces,
          nextPieces: nextState.pieces,
          gameMode: prev.gameMode,
        });
        if (chess.settings.showMoveAnnotations) {
          const movingColor = prev.currentTurn;
          const gm = prev.gameMode;
          const nextPieces = nextState.pieces;
          const nextEP = nextState.enPassantTarget;
          setTimeout(() => {
            const nextColor: PieceColor =
              movingColor === "white" ? "black" : "white";
            const nextHint = detectLegendaryPattern(nextPieces, nextColor, gm, nextEP);
            if (nextHint && nextHint.movesAway === 1) {
              addLabel("legendary", nextHint);
              return;
            }
            const post = detectLegendaryPattern(nextPieces, movingColor, gm, nextEP);
            if (post && post.movesAway === 2) addLabel("legendary", post);
          }, 0);
        }
        return nextState;
      });
    };

    const trigger = async (retriesLeft: number) => {
      if (cancelled) return;

      // AI instance not created yet — wait
      if (!chess.aiRef.current) {
        if (retriesLeft > 0) setTimeout(() => trigger(retriesLeft - 1), 1000);
        return;
      }

      // AI instance exists but Stockfish not yet ready — wait without restarting
      if (!chess.aiRef.current.ready) {
        if (retriesLeft > 0) setTimeout(() => trigger(retriesLeft - 1), 1200);
        return;
      }

      try {
        const move = await chess.aiRef.current.getNextMove(
          chess.gameStateRef.current.pieces,
          chess.gameStateRef.current.enPassantTarget,
          chess.gameStateRef.current.halfMoveClock,
        );
        if (!cancelled) applyMove(move);
      } catch (e) {
        console.error("AI move failed:", e);
        if (cancelled) return;
        if (retriesLeft > 0) {
          // Reinitialise the engine before retrying
          chess.aiRef.current?.restart?.();
          setTimeout(() => trigger(retriesLeft - 1), 1000);
        } else {
          // All retries exhausted — use the smart fallback chain instead of a
          // purely random move; AI stays enabled for future turns.
          console.warn(
            "[AI] All retries exhausted — activating smart fallback.",
          );
          if (!cancelled) {
            const fallback = getSmartFallbackMove(
              chess.gameStateRef.current.pieces,
              chess.gameStateRef.current.gameMode,
            );
            if (fallback) {
              applyMove(fallback);
            } else {
              chess.setGameState((prev) => {
                if (prev.gameOver) return prev;
                const inCheck = isInCheck(
                  prev.currentTurn,
                  prev.pieces,
                  prev.gameMode,
                );
                return {
                  ...prev,
                  gameOver: true,
                  winner: inCheck
                    ? prev.currentTurn === "white"
                      ? "black"
                      : "white"
                    : null,
                  drawReason: inCheck ? undefined : "stalemate",
                };
              });
            }
          }
        }
      }
    };

    aiThinkingIndexRef.current = 0;
    aiThinkingInitTimerRef.current = setTimeout(() => {
      const msgs = t("aiThinking.messages", { returnObjects: true });
      const messages = Array.isArray(msgs) ? (msgs as string[]) : [];
      if (messages.length === 0) return;
      const idx = aiThinkingIndexRef.current % messages.length;
      aiThinkingLabelIdRef.current = addLabel("ai_thinking", messages[idx]);
      aiThinkingIndexRef.current++;
      aiThinkingIntervalRef.current = setInterval(() => {
        if (aiThinkingLabelIdRef.current)
          dismissLabel(aiThinkingLabelIdRef.current);
        const nextIdx = aiThinkingIndexRef.current % messages.length;
        aiThinkingLabelIdRef.current = addLabel(
          "ai_thinking",
          messages[nextIdx],
        );
        aiThinkingIndexRef.current++;
      }, 8000);
    }, 5000);

    const id = setTimeout(() => trigger(5), 500);
    return () => {
      cancelled = true;
      clearTimeout(id);
      if (aiThinkingInitTimerRef.current) {
        clearTimeout(aiThinkingInitTimerRef.current);
        aiThinkingInitTimerRef.current = null;
      }
      if (aiThinkingIntervalRef.current) {
        clearInterval(aiThinkingIntervalRef.current);
        aiThinkingIntervalRef.current = null;
      }
      if (aiThinkingLabelIdRef.current) {
        dismissLabel(aiThinkingLabelIdRef.current);
        aiThinkingLabelIdRef.current = null;
      }
    };
  }, [chess.gameState.currentTurn, chess.aiEnabled, chess.gameState.gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // Safety net: catch any checkmate/stalemate that applyMoveToState might have missed.
  // Also checks for repetition and 50-move rule draws.
  // Runs after every turn change or board update. In P2P the host is authoritative.
  React.useEffect(() => {
    if (chess.gameState.gameOver) return;
    if (chess.gameState.pieces.length === 0) return;
    if (p2p.isP2PMode) return;

    // Check for draw by repetition or 50-move rule
    if (isDrawByRepetition(chess.gameState.positionHistory ?? {})) {
      chess.setGameState((prev) => {
        if (prev.gameOver) return prev;
        return {
          ...prev,
          gameOver: true,
          winner: null,
          drawReason: "repetition",
        };
      });
      return;
    }
    if (isDrawBy50Moves(chess.gameState.halfMoveClock ?? 0)) {
      chess.setGameState((prev) => {
        if (prev.gameOver) return prev;
        return {
          ...prev,
          gameOver: true,
          winner: null,
          drawReason: "fifty-moves",
        };
      });
      return;
    }

    if (
      !hasLegalMoves(
        chess.gameState.currentTurn,
        chess.gameState.pieces,
        chess.gameState.gameMode,
        chess.gameState.enPassantTarget,
      )
    ) {
      const inCheck = chess.gameState.isCheck;
      const loser = chess.gameState.currentTurn;
      chess.setGameState((prev) => {
        if (prev.gameOver) return prev;
        return {
          ...prev,
          gameOver: true,
          winner: inCheck ? (loser === "white" ? "black" : "white") : null,
          drawReason: inCheck ? undefined : "stalemate",
        };
      });
    }
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    chess.gameState.currentTurn,
    chess.gameState.pieces,
    chess.gameState.gameMode,
    chess.gameState.gameOver,
    chess.gameState.enPassantTarget,
    chess.gameState.positionHistory,
    chess.gameState.halfMoveClock,
    p2p.isP2PMode,
  ]);

  // ── Movable pieces ────────────────────────────────────────────────────────
  // Only pieces with at least one legal move get the blue glow.
  const movablePieceIds = React.useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    if (
      p2p.isP2PMode &&
      p2p.playerColor &&
      chess.gameState.currentTurn !== p2p.playerColor
    ) {
      return ids;
    }
    chess.gameState.pieces
      .filter((p) => p.color === chess.gameState.currentTurn)
      .forEach((p) => {
        if (
          getValidMoves(
            p,
            chess.gameState.pieces,
            chess.gameState.gameMode,
            chess.gameState.enPassantTarget,
          ).length > 0
        ) {
          ids.add(p.id);
        }
      });
    return ids;
  }, [
    chess.gameState.pieces,
    chess.gameState.currentTurn,
    chess.gameState.gameMode,
    chess.gameState.enPassantTarget,
    p2p.isP2PMode,
    p2p.playerColor,
  ]);

  // ── Danger indicator ──────────────────────────────────────────────────────
  const endangeredPieceIds = React.useMemo<Set<string>>(() => {
    if (!chess.settings.showDangerIndicator) return new Set();
    // Don't show danger for opponent pieces during AI turn (avoids brief flash at turn change)
    if (chess.aiEnabled && chess.gameState.currentTurn !== "white")
      return new Set();
    const opp = chess.gameState.currentTurn === "white" ? "black" : "white";
    const ids = new Set<string>();
    chess.gameState.pieces
      .filter((p) => p.color === chess.gameState.currentTurn)
      .forEach((p) => {
        if (
          isSquareUnderAttack(
            p.position,
            opp,
            chess.gameState.pieces,
            chess.gameState.gameMode,
          )
        ) {
          ids.add(p.id);
        }
      });
    return ids;
  }, [
    chess.settings.showDangerIndicator,
    chess.gameState.pieces,
    chess.gameState.currentTurn,
    chess.gameState.gameMode,
    chess.aiEnabled,
  ]);

  // ── Hint (auto-calculated at the start of each turn) ─────────────────────
  const [hintMove, setHintMove] = React.useState<{
    from: Position;
    to: Position;
  } | null>(null);

  // Hint is available when the option is on, not in P2P, and it's the human's turn
  const canShowHint =
    chess.settings.showHint &&
    !p2p.isP2PMode &&
    !chess.gameState.gameOver &&
    (!chess.aiEnabled || chess.gameState.currentTurn === "white");

  React.useEffect(() => {
    setHintMove(null);
    if (!canShowHint) return;

    let cancelled = false;

    const tryHint = (retriesLeft: number) => {
      if (cancelled) return;
      if (!chess.aiRef.current) {
        // Engine not ready yet — retry shortly
        if (retriesLeft > 0) setTimeout(() => tryHint(retriesLeft - 1), 600);
        return;
      }
      chess.aiRef.current
        .getHintMove(
          chess.gameState.pieces,
          chess.gameState.currentTurn,
          chess.gameState.enPassantTarget,
          chess.gameState.halfMoveClock,
        )
        .then((move) => {
          if (!cancelled) setHintMove(move);
        })
        .catch((e) => {
          console.error("Hint failed:", e);
          if (!cancelled && retriesLeft > 0)
            setTimeout(() => tryHint(retriesLeft - 1), 600);
        });
    };

    tryHint(12); // up to 13 attempts (~7s window) to cover Stockfish init delay
    return () => {
      cancelled = true;
    };
  }, [chess.gameState.currentTurn, canShowHint, chess.gameState.startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dangerous valid moves (for orange overlay on risky destinations) ───────
  const dangerousValidMoves = React.useMemo<Set<string>>(() => {
    if (!chess.settings.showDangerIndicator || !chess.gameState.selectedPiece)
      return new Set();
    const opp = chess.gameState.currentTurn === "white" ? "black" : "white";
    const result = new Set<string>();
    chess.gameState.validMoves.forEach((move) => {
      const nx = ((move.x % 8) + 8) % 8;
      const ny = ((move.y % 8) + 8) % 8;
      if (
        isSquareUnderAttack(
          { x: nx, y: ny },
          opp,
          chess.gameState.pieces,
          chess.gameState.gameMode,
        )
      ) {
        result.add(`${nx},${ny}`);
      }
    });
    return result;
  }, [
    chess.settings.showDangerIndicator,
    chess.gameState.selectedPiece,
    chess.gameState.validMoves,
    chess.gameState.pieces,
    chess.gameState.currentTurn,
    chess.gameState.gameMode,
  ]);

  // ── Labels (annotations + alerts) ─────────────────────────────────────────
  const labelIdRef = React.useRef(0);
  const [gameLabels, setGameLabels] = React.useState<GameLabelItem[]>([]);

  const addLabel = React.useCallback(
    (
      variant: LabelVariant,
      metaOrMessage?: LegendaryMeta | string,
      captureContext?: CaptureContext,
    ): string => {
      labelIdRef.current += 1;
      const id = String(labelIdRef.current);
      const isMsg = typeof metaOrMessage === "string";
      setGameLabels((prev) => [
        ...prev,
        {
          id,
          variant,
          createdAt: Date.now(),
          legendaryMeta: isMsg ? undefined : metaOrMessage,
          message: isMsg ? metaOrMessage : undefined,
          captureContext,
        },
      ]);
      return id;
    },
    [],
  );

  const dismissLabel = React.useCallback((id: string) => {
    setGameLabels((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const aiThinkingInitTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const aiThinkingIntervalRef = React.useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const aiThinkingLabelIdRef = React.useRef<string | null>(null);
  const aiThinkingIndexRef = React.useRef(0);

  const triggerAnnotation = React.useCallback(
    (ctx: MoveContext) => {
      if (!chess.settings.showMoveAnnotations) return;
      const tag = detectTactic(ctx);
      if (!tag) return;
      if (tag === "capture" && ctx.capturedPiece) {
        const sq = `${String.fromCharCode(97 + ctx.to.x)}${8 - ctx.to.y}`;
        addLabel("capture", undefined, {
          pieceName: t(`profile.pieces.${ctx.piece.type}`).toLowerCase(),
          pieceColor: t(`chess.colors.${ctx.piece.color}`),
          capturedName: t(
            `profile.pieces.${ctx.capturedPiece.type}`,
          ).toLowerCase(),
          capturedColor: t(`chess.colors.${ctx.capturedPiece.color}`),
          square: sq,
        });
      } else {
        addLabel(tag as LabelVariant);
      }
    },
    [chess.settings.showMoveAnnotations, addLabel, t],
  );

  // ── Analytics ─────────────────────────────────────────────────────────────
  const playType = p2p.isP2PMode ? "multiplayer" : "local";

  React.useEffect(() => {
    if (chess.gameState.pieces.length === 0) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "game_start",
      game_mode: chess.gameState.gameMode.id,
      play_type: playType,
      ai_enabled: chess.aiEnabled,
      ...(chess.aiEnabled && { ai_difficulty: chess.settings.aiDifficulty }),
    });
  }, [chess.gameState.startTime]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!chess.gameState.gameOver) return;
    const {
      winner,
      surrenderedBy,
      drawReason,
      moveCount,
      startTime,
      gameMode,
      moves,
    } = chess.gameState;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "game_end",
      game_mode: gameMode.id,
      play_type: playType,
      result: winner ? `${winner}_wins` : "draw",
      end_reason: surrenderedBy ? "surrender" : (drawReason ?? "checkmate"),
      duration_seconds: Math.round((Date.now() - startTime) / 1000),
      move_count: moveCount.white + moveCount.black,
    });

    // ── Record stats ──
    const playerColor: PieceColor = p2p.isP2PMode
      ? (p2p.playerColor ?? "white")
      : "white";
    const isWin = winner !== null && winner === playerColor;
    const totalMoves = moveCount.white + moveCount.black;
    const statsPlayType: PlayType = p2p.isP2PMode
      ? "p2p"
      : chess.aiEnabled
        ? "ai"
        : "local";
    recordGame({
      mode: gameMode.id,
      playType: statsPlayType,
      winner,
      surrenderedBy,
      drawReason,
      duration: Date.now() - startTime,
      moveCount: totalMoves,
      aiDifficulty: chess.aiEnabled ? chess.settings.aiDifficulty : undefined,
      pieceMoves: { ...sessionStatsRef.current.pieceMoves },
      piecesLost: { ...sessionStatsRef.current.piecesLost },
      playerColor,
      hour: new Date().getHours(),
      isQuickWin: isWin && totalMoves < 10,
      wasPromoted: wasPromotedRef.current,
      wasScholarsMate:
        isWin && playerColor === "white" && detectScholarsMate(moves),
      hintsFollowedInGame: hintsFollowedRef.current,
      language: i18n.language,
    });
  }, [chess.gameState.gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── User action handlers ───────────────────────────────────────────────────
  const handlePieceSelect = (piece: Piece) => {
    if (chess.pendingPromotion) return;
    if (
      p2p.isP2PMode
        ? piece.color !== p2p.playerColor
        : chess.aiEnabled && piece.color === "black"
    )
      return;
    if (piece.color !== chess.gameState.currentTurn) return;
    const moves = getValidMoves(
      piece,
      chess.gameState.pieces,
      chess.gameState.gameMode,
      chess.gameState.enPassantTarget,
    );
    if (moves.length === 0) {
      let variant: LabelVariant;
      if (chess.gameState.isCheck) {
        variant = "checkBlockedPiece";
      } else if (
        !hasRawMoves(piece, chess.gameState.pieces, chess.gameState.gameMode)
      ) {
        variant = "blockedPiece";
      } else {
        variant = "pinnedPiece";
      }
      addLabel(variant);
    }
    chess.setGameState((prev) => ({
      ...prev,
      selectedPiece: piece,
      validMoves: moves,
    }));
  };

  const applyMoveWithAnnotations = (
    piece: Piece,
    target: Position,
    promotionType?: PieceType,
  ) => {
    chess.setGameState((prev) => {
      const nextState = applyMoveToState(prev, piece, target, promotionType);
      const capturedPiece =
        prev.pieces.find(
          (p) =>
            p.color !== piece.color &&
            p.position.x === target.x &&
            p.position.y === target.y,
        ) ?? null;
      triggerAnnotation({
        piece,
        from: piece.position,
        to: target,
        capturedPiece,
        wasPromotion:
          piece.type === "pawn" && (target.y === 0 || target.y === 7),
        wasCastling:
          piece.type === "king" && Math.abs(piece.position.x - target.x) === 2,
        wasEnPassant:
          piece.type === "pawn" &&
          !!prev.enPassantTarget &&
          target.x === prev.enPassantTarget.x &&
          target.y === prev.enPassantTarget.y &&
          !capturedPiece,
        prevPieces: prev.pieces,
        nextPieces: nextState.pieces,
        gameMode: prev.gameMode,
      });
      if (chess.settings.showMoveAnnotations) {
        const movingColor = prev.currentTurn;
        const gm = prev.gameMode;
        const nextPieces = nextState.pieces;
        const nextEP = nextState.enPassantTarget;
        setTimeout(() => {
          const nextColor: PieceColor =
            movingColor === "white" ? "black" : "white";
          const nextHint = detectLegendaryPattern(nextPieces, nextColor, gm, nextEP);
          if (nextHint && nextHint.movesAway === 1) {
            addLabel("legendary", nextHint);
            return;
          }
          const post = detectLegendaryPattern(nextPieces, movingColor, gm, nextEP);
          if (post && post.movesAway === 2) addLabel("legendary", post);
        }, 0);
      }
      return nextState;
    });
  };

  const confirmPromotion = (type: PieceType) => {
    const pending = chess.pendingPromotion;
    if (!pending) return;
    chess.setPendingPromotion(null);
    const { piece, target } = pending;
    wasPromotedRef.current = true;

    if (p2p.isP2PMode && p2p.role === "guest") {
      p2p.actions?.sendMoveProposal({
        type: "move_proposal",
        pieceId: piece.id,
        from: piece.position,
        to: target,
        promotionType: type,
      });
      return;
    }

    if (p2p.isP2PMode && p2p.role === "host") {
      p2pGame.seqRef.current++;
      p2p.actions?.sendMoveConfirm({
        type: "move_confirm",
        pieceId: piece.id,
        from: piece.position,
        to: target,
        seq: p2pGame.seqRef.current,
        promotionType: type,
      });
    }

    applyMoveWithAnnotations(piece, target, type);
  };

  const handleMove = (target: Position) => {
    const { selectedPiece } = chess.gameState;
    if (!selectedPiece) return;
    if (chess.pendingPromotion) return;
    const norm = normalizePos(target.x, target.y);

    // ── Track hint following ──
    if (
      hintMove &&
      selectedPiece.position.x === hintMove.from.x &&
      selectedPiece.position.y === hintMove.from.y &&
      norm.x === hintMove.to.x &&
      norm.y === hintMove.to.y
    ) {
      hintsFollowedRef.current += 1;
    }

    // ── Track piece stats (non-pawn only) ──
    if (selectedPiece.type !== "pawn") {
      const t = selectedPiece.type as PieceType;
      sessionStatsRef.current.pieceMoves[t] =
        (sessionStatsRef.current.pieceMoves[t] ?? 0) + 1;
    }
    const capturedForStats = chess.gameState.pieces.find(
      (p) =>
        p.color !== selectedPiece.color &&
        p.position.x === norm.x &&
        p.position.y === norm.y,
    );
    if (capturedForStats && capturedForStats.type !== "pawn") {
      const t = capturedForStats.type as PieceType;
      sessionStatsRef.current.piecesLost[t] =
        (sessionStatsRef.current.piecesLost[t] ?? 0) + 1;
    }

    // ── Intercept human pawn promotion — show picker before applying ──
    const isHumanPromotion =
      selectedPiece.type === "pawn" &&
      ((selectedPiece.color === "white" && norm.y === 0) ||
        (selectedPiece.color === "black" && norm.y === 7));

    if (isHumanPromotion) {
      chess.setPendingPromotion({ piece: selectedPiece, target: norm });
      chess.setGameState((prev) => ({
        ...prev,
        selectedPiece: null,
        validMoves: [],
      }));
      return;
    }

    if (p2p.isP2PMode && p2p.role === "guest") {
      p2p.actions?.sendMoveProposal({
        type: "move_proposal",
        pieceId: selectedPiece.id,
        from: selectedPiece.position,
        to: norm,
      });
      chess.setGameState((prev) => ({
        ...prev,
        selectedPiece: null,
        validMoves: [],
      }));
      return;
    }

    if (p2p.isP2PMode && p2p.role === "host") {
      p2pGame.seqRef.current++;
      p2p.actions?.sendMoveConfirm({
        type: "move_confirm",
        pieceId: selectedPiece.id,
        from: selectedPiece.position,
        to: norm,
        seq: p2pGame.seqRef.current,
      });
    }

    applyMoveWithAnnotations(selectedPiece, norm);
  };

  const handleResign = () => {
    const myColor: PieceColor = p2p.isP2PMode
      ? (p2p.playerColor ?? "white")
      : chess.gameState.currentTurn;
    if (p2p.isP2PMode) p2p.actions?.sendResign({ type: "resign" });
    chess.setGameState((prev) => ({
      ...prev,
      gameOver: true,
      winner: myColor === "white" ? "black" : "white",
      surrenderedBy: myColor,
    }));
  };

  const returnPath = p2p.isP2PMode ? "/p2p" : "/local";
  const handleLeaveP2P = () => {
    p2p.leaveRoom();
    navigate(returnPath);
  };

  // ── Board orientation ──────────────────────────────────────────────────────
  const lockedColor: PieceColor | null = p2p.isP2PMode
    ? p2p.playerColor
    : chess.aiEnabled
      ? "white"
      : null;
  const boardFlipped = p2p.isP2PMode
    ? p2p.playerColor === "black"
    : !chess.aiEnabled && chess.settings.flipBoard
      ? chess.gameState.currentTurn === "black"
      : false;
  const rotatePieces =
    !p2p.isP2PMode && !chess.aiEnabled && !chess.settings.flipBoard;

  const playTypeLabel = p2p.isP2PMode
    ? t("modeSelect.multiplayer")
    : t("modeSelect.local");

  const { layout, overlayOutside, sideMargin, boardSize } = useGameLayout();
  const boardSkinStyle = useBoardSkinStyle();
  const { boardSkin } = useBoardSkin();
  const campSkinDef = getBoardSkinDef(boardSkin);
  // When camp decorations are present, always use CampDecoration (flex flow) so the camps
  // extend naturally toward screen edges — the "side" layout constrains them to sideMargin.
  const hasCamps = !!(campSkinDef.campTop || campSkinDef.campBottom);

  return (
    <div
      className={`h-screen overflow-hidden flex flex-col ${boardSkinStyle.backgroundImage ? "" : "bg-gray-100"}`}
      style={boardSkinStyle}
    >
      <NavBar
        breadcrumbs={[
          { label: playTypeLabel, path: p2p.isP2PMode ? "/p2p" : "/local" },
          { label: t(`modes.${chess.gameState.gameMode.id}.title`) },
        ]}
        onSurrender={!chess.gameState.gameOver ? handleResign : undefined}
        onShowResult={
          chess.gameState.gameOver && !gameOverVisible
            ? () => setGameOverVisible(true)
            : undefined
        }
        gameSettings={!p2p.isP2PMode ? chess.settings : null}
        onGameSettingsChange={
          !p2p.isP2PMode ? chess.handleSettingsChange : undefined
        }
      />

      {p2p.isP2PMode && (
        <P2PStatusBar
          connectionState={p2p.connectionState}
          playerColor={p2p.playerColor}
          currentTurn={chess.gameState.currentTurn}
          onLeave={handleLeaveP2P}
        />
      )}

      {layout === "side" && !hasCamps ? (
        <div
          className="flex-1 flex flex-row items-center p-2 sm:p-4 min-h-0 relative"
          style={{ isolation: "isolate" }}
        >
          {campSkinDef.campBottom && (
            <SideCamp
              src={campSkinDef.campBottom}
              angle={90}
              side="left"
              width={sideMargin}
              zoneHeight={boardSize}
            />
          )}
          {campSkinDef.campTop && (
            <SideCamp
              src={campSkinDef.campTop}
              angle={-90}
              side="right"
              width={sideMargin}
              zoneHeight={boardSize}
            />
          )}
          {/* Left panel — PromotionPicker */}
          <div className="flex-1 flex flex-col items-center justify-start pt-3 min-w-0">
            {chess.pendingPromotion && (
              <PromotionPicker
                color={chess.pendingPromotion.piece.color}
                onSelect={confirmPromotion}
              />
            )}
          </div>

          <ChessBoard
            pieces={chess.gameState.pieces}
            currentTurn={chess.gameState.currentTurn}
            selectedPiece={chess.gameState.selectedPiece}
            validMoves={chess.gameState.validMoves}
            isCheck={chess.gameState.isCheck}
            onPieceSelect={handlePieceSelect}
            onMove={handleMove}
            gameMode={chess.gameState.gameMode}
            lockedColor={lockedColor}
            flipped={boardFlipped}
            rotateBlackPieces={rotatePieces}
            movablePieceIds={movablePieceIds}
            endangeredPieceIds={endangeredPieceIds}
            hintMove={hintMove}
            dangerousValidMoves={dangerousValidMoves}
            skin={skin}
            peerSkin={p2p.peerSkin ?? undefined}
          />

          {/* Right panel — GameLabels */}
          <div className="flex-1 flex flex-col items-center justify-start pt-3 min-w-0">
            <GameLabels items={gameLabels} onDismiss={dismissLabel} />
          </div>
        </div>
      ) : overlayOutside ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <CampDecoration
            campTop={campSkinDef.campTop}
            campBottom={campSkinDef.campBottom}
          >
            {/* Zero-height overlay: PromotionPicker floats above the board without shifting it */}
            <div style={{ height: 0, overflow: "visible", width: "100%" }}>
              <div
                style={{
                  transform: "translateY(-100%) translateY(-12px)",
                  pointerEvents: chess.pendingPromotion ? "auto" : "none",
                }}
              >
                {chess.pendingPromotion && (
                  <PromotionPicker
                    color={chess.pendingPromotion.piece.color}
                    onSelect={confirmPromotion}
                  />
                )}
              </div>
            </div>

            <ChessBoard
              pieces={chess.gameState.pieces}
              currentTurn={chess.gameState.currentTurn}
              selectedPiece={chess.gameState.selectedPiece}
              validMoves={chess.gameState.validMoves}
              isCheck={chess.gameState.isCheck}
              onPieceSelect={handlePieceSelect}
              onMove={handleMove}
              gameMode={chess.gameState.gameMode}
              lockedColor={lockedColor}
              flipped={boardFlipped}
              rotateBlackPieces={rotatePieces}
              movablePieceIds={movablePieceIds}
              endangeredPieceIds={endangeredPieceIds}
              hintMove={hintMove}
              dangerousValidMoves={dangerousValidMoves}
              skin={skin}
              peerSkin={p2p.peerSkin ?? undefined}
            />

            {/* Zero-height overlay: labels float below the board without shifting it */}
            <div style={{ height: 0, overflow: "visible", width: "100%" }}>
              <div style={{ paddingTop: "12px" }}>
                <GameLabels items={gameLabels} onDismiss={dismissLabel} />
              </div>
            </div>
          </CampDecoration>
        </div>
      ) : (
        /* Gray zone: not enough top/bottom margin — overlays render inside the board */
        <div className="flex-1 overflow-hidden flex flex-col">
          <CampDecoration
            campTop={campSkinDef.campTop}
            campBottom={campSkinDef.campBottom}
          >
            <div className="relative">
              <div className="absolute inset-x-0 top-0 z-[60] flex justify-center">
                {chess.pendingPromotion && (
                  <PromotionPicker
                    color={chess.pendingPromotion.piece.color}
                    onSelect={confirmPromotion}
                  />
                )}
              </div>

              <ChessBoard
                pieces={chess.gameState.pieces}
                currentTurn={chess.gameState.currentTurn}
                selectedPiece={chess.gameState.selectedPiece}
                validMoves={chess.gameState.validMoves}
                isCheck={chess.gameState.isCheck}
                onPieceSelect={handlePieceSelect}
                onMove={handleMove}
                gameMode={chess.gameState.gameMode}
                lockedColor={lockedColor}
                flipped={boardFlipped}
                rotateBlackPieces={rotatePieces}
                movablePieceIds={movablePieceIds}
                endangeredPieceIds={endangeredPieceIds}
                hintMove={hintMove}
                dangerousValidMoves={dangerousValidMoves}
                skin={skin}
                peerSkin={p2p.peerSkin ?? undefined}
              />

              <div className="absolute inset-x-0 bottom-0 z-[60]">
                <GameLabels items={gameLabels} onDismiss={dismissLabel} />
              </div>
            </div>
          </CampDecoration>
        </div>
      )}

      {chess.gameState.gameOver && gameOverVisible && (
        <GameOver
          winner={chess.gameState.winner}
          drawReason={chess.gameState.drawReason}
          surrenderedBy={chess.gameState.surrenderedBy}
          duration={Date.now() - chess.gameState.startTime}
          moveCount={
            chess.gameState.winner
              ? chess.gameState.moveCount[chess.gameState.winner]
              : chess.gameState.moveCount.white +
                chess.gameState.moveCount.black
          }
          onReplay={chess.handleReplay}
          aiEnabled={chess.aiEnabled}
          aiDifficulty={chess.settings.aiDifficulty}
          isP2PMode={p2p.isP2PMode}
          playerColor={p2p.playerColor}
          rematchState={p2pGame.rematchState}
          peerLeft={p2pGame.peerLeft}
          onRematch={p2pGame.handleRematch}
          onAcceptRematch={p2pGame.handleAcceptRematch}
          onDeclineRematch={p2pGame.handleDeclineRematch}
          onMainMenu={p2p.isP2PMode ? handleLeaveP2P : undefined}
          returnPath={returnPath}
          onDismiss={() => setGameOverVisible(false)}
        />
      )}
    </div>
  );
}
