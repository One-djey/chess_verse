import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Skull, Swords } from "lucide-react";
import NavBar from "./NavBar";
import GameOver from "./GameOver";
import ChessBoard from "./ChessBoard";
import GameLabels, {
  type CaptureContext,
  type GameLabelItem,
  type LabelVariant,
} from "./GameLabels";
import { PromotionPicker } from "./PromotionPicker";
import { useZombieHordeGame } from "../hooks/useZombieHordeGame";
import { getValidMoves, isSquareUnderAttack } from "../utils/chess/moves";
import { detectTactic, type MoveContext } from "../utils/chess/tactics";
import type { LocalSettings } from "../hooks/useChessGame";
import { ChessAI } from "../services/ChessAI";
import { BoardSkinContext } from "../context/BoardSkinContext";
import { getBoardSkinDef, resolveEffectiveBoardSkin } from "../utils/boardSkin";
import { useBoardSkin } from "../hooks/useBoardSkin";
import type { GameMode, Piece, PieceType, Position } from "../types/chess";
import { useSkin } from "../hooks/useSkin";
import { resolveEffectivePieceSkin } from "../utils/pieceImage";

const _zombieBoardDef = getBoardSkinDef("apocalypse");
const ZOMBIE_BOARD_STYLE: CSSProperties = _zombieBoardDef.ground
  ? {
      backgroundImage: `url(${_zombieBoardDef.ground})`,
      backgroundRepeat: "repeat",
      backgroundSize: "1000px 1000px",
    }
  : {};

const CLASSIC_MODE: GameMode = {
  id: "classic",
  title: "Classic",
  description: "",
  image: "",
  rules: {},
};

const SETTINGS_KEY = "chess_settings";
const DEFAULT_SETTINGS: LocalSettings = {
  aiEnabled: false,
  aiDifficulty: 5,
  flipBoard: false,
  showDangerIndicator: false,
  showHint: false,
  showMoveAnnotations: false,
};

function loadSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: LocalSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {
    // storage unavailable — ignore
    void e;
  }
}

/** Simulate the white move to get nextPieces for annotation context. */
function computeNextPiecesForAnnotation(
  pieces: Piece[],
  piece: Piece,
  target: Position,
  enPassantTarget: Position | undefined,
  promotionType?: PieceType,
): Piece[] {
  const from = piece.position;
  const captured =
    pieces.find(
      (p) =>
        p.color !== piece.color &&
        p.position.x === target.x &&
        p.position.y === target.y,
    ) ?? null;
  const isEpCapture =
    !!enPassantTarget &&
    piece.type === "pawn" &&
    target.x === enPassantTarget.x &&
    target.y === enPassantTarget.y &&
    !captured;

  let result = captured
    ? pieces.filter((p) => p.id !== captured.id)
    : [...pieces];
  if (isEpCapture) {
    result = result.filter(
      (p) => !(p.position.x === target.x && p.position.y === from.y),
    );
  }
  const finalType: PieceType =
    piece.type === "pawn" && target.y === 0
      ? (promotionType ?? "queen")
      : piece.type;
  return result.map((p) =>
    p.id === piece.id
      ? { ...p, type: finalType, position: target, hasMoved: true }
      : p,
  );
}

function WaveStatusBar({
  wave,
  zombiesKilled,
  isThinking,
}: {
  wave: number;
  zombiesKilled: number;
  isThinking: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 text-white text-sm font-medium">
      <div className="flex items-center gap-1.5">
        <Swords size={14} className="text-amber-400" />
        <span>
          {t("zombieHorde.wave")} {Math.max(wave, 1)}
          {wave >= 10 ? " 🔥" : ""}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Skull size={14} className="text-green-400" />
        <span>
          {zombiesKilled} {t("zombieHorde.zombiesKilled")}
        </span>
      </div>
      {isThinking && (
        <div className="ml-auto flex items-center gap-2 text-red-400 animate-pulse">
          <Skull size={14} />
          <span>{t("zombieHorde.hordeThinking")}</span>
        </div>
      )}
    </div>
  );
}

export default function ZombieHordeGame() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { skin } = useSkin();
  const effectiveSkin = resolveEffectivePieceSkin(skin, "zombie");
  const { boardSkin, setBoardSkin } = useBoardSkin();
  const effectiveBoardSkin = resolveEffectiveBoardSkin(boardSkin, "apocalypse");
  const zombieBoardStyle =
    effectiveBoardSkin === "apocalypse" ? ZOMBIE_BOARD_STYLE : {};

  const {
    state,
    enPassantTarget,
    handlePieceSelect,
    handleMove,
    handlePromotion,
    handleSurrender,
    handleRestart,
    getDuration,
  } = useZombieHordeGame();

  const [gameOverVisible, setGameOverVisible] = useState(true);

  // ── Settings ────────────────────────────────────────────────────────────────

  const [settings, setSettings] = useState<LocalSettings>(loadSettings);

  const handleSettingsChange = useCallback(
    (partial: {
      aiEnabled: boolean;
      aiDifficulty: number;
      flipBoard: boolean;
    }) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        saveSettings(next);
        return next;
      });
    },
    [],
  );

  // ── Movable pieces ───────────────────────────────────────────────────────────

  const movablePieceIds = useMemo(() => {
    const ids = new Set<string>();
    if (
      state.gameOver ||
      state.wave.isZombiesThinking ||
      state.pendingPromotion
    )
      return ids;
    state.pieces
      .filter((p) => p.color === "white")
      .forEach((p) => {
        if (
          getValidMoves(p, state.pieces, CLASSIC_MODE, enPassantTarget).length >
          0
        )
          ids.add(p.id);
      });
    return ids;
  }, [
    state.pieces,
    state.gameOver,
    state.wave.isZombiesThinking,
    state.pendingPromotion,
    enPassantTarget,
  ]);

  // ── Danger indicator ─────────────────────────────────────────────────────────

  const endangeredPieceIds = useMemo<Set<string>>(() => {
    if (!settings.showDangerIndicator) return new Set();
    const ids = new Set<string>();
    state.pieces
      .filter((p) => p.color === "white")
      .forEach((p) => {
        if (
          isSquareUnderAttack(p.position, "black", state.pieces, CLASSIC_MODE)
        ) {
          ids.add(p.id);
        }
      });
    return ids;
  }, [settings.showDangerIndicator, state.pieces]);

  const dangerousValidMoves = useMemo<Set<string>>(() => {
    if (!settings.showDangerIndicator || !state.selectedPiece) return new Set();
    const result = new Set<string>();
    state.validMoves.forEach((move) => {
      if (isSquareUnderAttack(move, "black", state.pieces, CLASSIC_MODE)) {
        result.add(`${move.x},${move.y}`);
      }
    });
    return result;
  }, [
    settings.showDangerIndicator,
    state.selectedPiece,
    state.validMoves,
    state.pieces,
  ]);

  // ── Hint move ────────────────────────────────────────────────────────────────

  const hintAiRef = useRef<ChessAI | null>(null);
  const [hintMove, setHintMove] = useState<{
    from: Position;
    to: Position;
  } | null>(null);

  useEffect(() => {
    hintAiRef.current = new ChessAI();
    return () => {
      hintAiRef.current?.destroy();
    };
  }, []);

  // Hint is available when the option is on and it's the player's turn
  const canShowHint =
    settings.showHint && !state.gameOver && !state.wave.isZombiesThinking;

  useEffect(() => {
    setHintMove(null);
    if (!canShowHint) return;

    let cancelled = false;

    const tryHint = (retriesLeft: number) => {
      if (cancelled) return;
      const ai = hintAiRef.current;
      if (!ai || !ai.ready) {
        if (retriesLeft > 0) setTimeout(() => tryHint(retriesLeft - 1), 600);
        return;
      }
      // getHintMove with "white" generates a white-to-move FEN — works without a black king
      ai.getHintMove(state.pieces, "white", enPassantTarget)
        .then((move) => {
          if (!cancelled) setHintMove(move);
        })
        .catch(() => {
          if (!cancelled && retriesLeft > 0)
            setTimeout(() => tryHint(retriesLeft - 1), 600);
        });
    };

    tryHint(12);
    return () => {
      cancelled = true;
    };
  }, [canShowHint, state.moveCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Labels / annotations ─────────────────────────────────────────────────────

  const labelIdRef = useRef(0);
  const [gameLabels, setGameLabels] = useState<GameLabelItem[]>([]);

  const addLabel = useCallback(
    (variant: LabelVariant, captureContext?: CaptureContext): string => {
      labelIdRef.current += 1;
      const id = String(labelIdRef.current);
      setGameLabels((prev) => [
        ...prev,
        { id, variant, createdAt: Date.now(), captureContext },
      ]);
      return id;
    },
    [],
  );

  const dismissLabel = useCallback((id: string) => {
    setGameLabels((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const triggerAnnotation = useCallback(
    (ctx: MoveContext) => {
      if (!settings.showMoveAnnotations) return;
      const tag = detectTactic(ctx);
      if (!tag) return;
      if (tag === "capture" && ctx.capturedPiece) {
        const sq = `${String.fromCharCode(97 + ctx.to.x)}${8 - ctx.to.y}`;
        addLabel("capture", {
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
    [settings.showMoveAnnotations, addLabel, t],
  );

  // ── Wrapped move handlers with annotation support ────────────────────────────

  const handleMoveWithAnnotations = useCallback(
    (to: Position) => {
      const { selectedPiece, pieces } = state;
      // Pawn promotion path: just forward, annotation happens in handlePromotionWithAnnotations
      if (
        selectedPiece?.type === "pawn" &&
        to.y === 0 &&
        selectedPiece.color === "white"
      ) {
        handleMove(to);
        return;
      }
      if (selectedPiece && settings.showMoveAnnotations) {
        const capturedPiece =
          pieces.find(
            (p) =>
              p.color !== selectedPiece.color &&
              p.position.x === to.x &&
              p.position.y === to.y,
          ) ?? null;
        const isEpCapture =
          !!enPassantTarget &&
          selectedPiece.type === "pawn" &&
          to.x === enPassantTarget.x &&
          to.y === enPassantTarget.y &&
          !capturedPiece;
        const effectiveCaptured = isEpCapture
          ? (pieces.find(
              (p) =>
                p.color !== selectedPiece.color &&
                p.position.x === to.x &&
                p.position.y === selectedPiece.position.y,
            ) ?? null)
          : capturedPiece;
        const nextPieces = computeNextPiecesForAnnotation(
          pieces,
          selectedPiece,
          to,
          enPassantTarget,
        );
        triggerAnnotation({
          piece: selectedPiece,
          from: selectedPiece.position,
          to,
          capturedPiece: effectiveCaptured,
          wasPromotion: false,
          wasCastling:
            selectedPiece.type === "king" &&
            Math.abs(selectedPiece.position.x - to.x) === 2,
          wasEnPassant: isEpCapture,
          prevPieces: pieces,
          nextPieces,
          gameMode: CLASSIC_MODE,
        });
      }
      handleMove(to);
    },
    [
      state,
      enPassantTarget,
      settings.showMoveAnnotations,
      triggerAnnotation,
      handleMove,
    ],
  );

  const handlePromotionWithAnnotations = useCallback(
    (promotionType: PieceType) => {
      const { pendingPromotion, pieces } = state;
      if (pendingPromotion && settings.showMoveAnnotations) {
        const capturedPiece =
          pieces.find(
            (p) =>
              p.color !== pendingPromotion.piece.color &&
              p.position.x === pendingPromotion.to.x &&
              p.position.y === pendingPromotion.to.y,
          ) ?? null;
        const nextPieces = computeNextPiecesForAnnotation(
          pieces,
          pendingPromotion.piece,
          pendingPromotion.to,
          enPassantTarget,
          promotionType,
        );
        triggerAnnotation({
          piece: pendingPromotion.piece,
          from: pendingPromotion.piece.position,
          to: pendingPromotion.to,
          capturedPiece,
          wasPromotion: true,
          wasCastling: false,
          wasEnPassant: false,
          prevPieces: pieces,
          nextPieces,
          gameMode: CLASSIC_MODE,
        });
      }
      handlePromotion(promotionType);
    },
    [
      state,
      enPassantTarget,
      settings.showMoveAnnotations,
      triggerAnnotation,
      handlePromotion,
    ],
  );

  // ── Navigation helpers ───────────────────────────────────────────────────────

  const handleReplay = () => {
    handleRestart();
    setGameOverVisible(true);
  };

  const handleMainMenu = () => navigate("/local");
  const isVictory = state.winner === "white";

  const breadcrumbs = [
    { label: t("modeSelect.local"), path: "/local" },
    { label: t("modes.zombie-horde.title") },
  ];

  return (
    <BoardSkinContext.Provider
      value={{ boardSkin: effectiveBoardSkin, setBoardSkin }}
    >
      <div
        className={`h-screen overflow-hidden flex flex-col ${zombieBoardStyle.backgroundImage ? "" : "bg-gray-100"}`}
        style={zombieBoardStyle}
      >
        <NavBar
          breadcrumbs={breadcrumbs}
          onSurrender={!state.gameOver ? handleSurrender : undefined}
          onShowResult={
            state.gameOver && !gameOverVisible
              ? () => setGameOverVisible(true)
              : undefined
          }
          gameSettings={settings}
          onGameSettingsChange={handleSettingsChange}
          gameMode="zombie-horde"
        />

        <WaveStatusBar
          wave={state.wave.currentWave}
          zombiesKilled={state.wave.zombiesKilled}
          isThinking={state.wave.isZombiesThinking}
        />

        {/* Interaction blocker while zombies think */}
        <div className="flex-1 overflow-hidden relative">
          {state.wave.isZombiesThinking && (
            <div className="absolute inset-0 z-50 cursor-not-allowed" />
          )}

          {/* Promotion picker floats above board */}
          <div style={{ height: 0, overflow: "visible", position: "relative" }}>
            {state.pendingPromotion && (
              <div className="flex justify-center">
                <PromotionPicker
                  color="white"
                  onSelect={handlePromotionWithAnnotations}
                />
              </div>
            )}
          </div>

          <div className="h-full flex items-center justify-center p-2">
            <ChessBoard
              pieces={state.pieces}
              currentTurn="white"
              selectedPiece={state.selectedPiece}
              validMoves={state.validMoves}
              isCheck={state.isCheck}
              onPieceSelect={(piece: Piece) => handlePieceSelect(piece)}
              onMove={handleMoveWithAnnotations}
              gameMode={CLASSIC_MODE}
              lockedColor="white"
              skin={effectiveSkin}
              movablePieceIds={movablePieceIds}
              hintMove={settings.showHint ? hintMove : null}
              endangeredPieceIds={endangeredPieceIds}
              dangerousValidMoves={dangerousValidMoves}
            />
          </div>

          <GameLabels items={gameLabels} onDismiss={dismissLabel} />
        </div>

        {state.gameOver && gameOverVisible && (
          <GameOver
            winner={isVictory ? "white" : "black"}
            duration={getDuration()}
            moveCount={state.moveCount}
            aiEnabled={!isVictory}
            onReplay={handleReplay}
            returnPath="/local"
            onMainMenu={handleMainMenu}
            onDismiss={() => setGameOverVisible(false)}
          />
        )}
      </div>
    </BoardSkinContext.Provider>
  );
}
