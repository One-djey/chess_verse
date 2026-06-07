import React from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  ShieldAlert,
  Zap,
  GitFork,
  Pin,
  Crosshair,
  TrendingUp,
  ArrowLeftRight,
  Trophy,
  Brain,
} from "lucide-react";

export type AnnotationVariant =
  | "check"
  | "discoveredCheck"
  | "fork"
  | "pin"
  | "capture"
  | "promotion"
  | "castling";

export type AlertVariant = "pinnedPiece" | "blockedPiece" | "checkBlockedPiece";

export type LabelVariant =
  | AnnotationVariant
  | AlertVariant
  | "legendary"
  | "ai_thinking";

export interface LegendaryMeta {
  patternId: string;
  type: "mate" | "attack";
  move: { from: { x: number; y: number }; to: { x: number; y: number } };
  movesAway: 1 | 2;
  pieceType: string;
}

export interface CaptureContext {
  pieceName: string;
  pieceColor: string;
  capturedName: string;
  capturedColor: string;
  square: string;
}

export interface GameLabelItem {
  id: string;
  variant: LabelVariant;
  createdAt: number;
  legendaryMeta?: LegendaryMeta;
  message?: string;
  captureContext?: CaptureContext;
}

const LABEL_PRIORITY: Record<LabelVariant, number> = {
  legendary: 110,
  check: 100,
  discoveredCheck: 90,
  checkBlockedPiece: 80,
  fork: 70,
  pin: 60,
  promotion: 50,
  capture: 40,
  castling: 30,
  pinnedPiece: 25,
  blockedPiece: 20,
  ai_thinking: 15,
};

const LABEL_TIMEOUT: Record<LabelVariant, number> = {
  legendary: 9000,
  check: 6000,
  discoveredCheck: 6000,
  fork: 6000,
  pin: 6000,
  capture: 6000,
  promotion: 6000,
  castling: 6000,
  checkBlockedPiece: 5500,
  pinnedPiece: 5500,
  blockedPiece: 5500,
  ai_thinking: 60000,
};

const ALERT_VARIANTS = new Set<LabelVariant>([
  "pinnedPiece",
  "blockedPiece",
  "checkBlockedPiece",
]);

const TACTIC_ICONS: Record<
  AnnotationVariant,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  check: ShieldAlert,
  discoveredCheck: Zap,
  fork: GitFork,
  pin: Pin,
  capture: Crosshair,
  promotion: TrendingUp,
  castling: ArrowLeftRight,
};

const MAX_VISIBLE = 5;
const EXIT_MS = 300;

function squareLabel(x: number, y: number): string {
  return `${String.fromCharCode(97 + x)}${8 - y}`;
}

function SingleLabel({
  item,
  onDismiss,
}: {
  item: GameLabelItem;
  onDismiss: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [exiting, setExiting] = React.useState(false);
  const exitingRef = React.useRef(false);

  const handleDismiss = React.useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    setTimeout(() => onDismiss(item.id), EXIT_MS);
  }, [item.id, onDismiss]);

  React.useEffect(() => {
    const remaining = Math.max(
      0,
      LABEL_TIMEOUT[item.variant] - (Date.now() - item.createdAt),
    );
    const id = setTimeout(handleDismiss, remaining);
    return () => clearTimeout(id);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAlert = ALERT_VARIANTS.has(item.variant);
  const isLegendary = item.variant === "legendary";
  const isAiThinking = item.variant === "ai_thinking";

  let containerClass: string;
  let dismissClass: string;

  if (isLegendary) {
    containerClass =
      "flex items-start gap-2 px-4 py-2.5 bg-white border border-amber-300 rounded-lg shadow-md text-sm text-amber-800";
    dismissClass =
      "ml-auto text-amber-400 hover:text-amber-600 mt-0.5 flex-shrink-0";
  } else if (isAiThinking) {
    containerClass =
      "flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg shadow-md text-sm text-blue-700";
    dismissClass = "ml-auto text-blue-400 hover:text-blue-600 flex-shrink-0";
  } else if (isAlert) {
    containerClass =
      "flex items-center gap-2 px-4 py-2.5 bg-white border border-orange-200 rounded-lg shadow-md text-sm text-orange-700";
    dismissClass =
      "ml-auto text-orange-400 hover:text-orange-600 flex-shrink-0";
  } else {
    containerClass =
      "flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-md text-sm text-gray-700";
    dismissClass = "ml-auto text-gray-400 hover:text-gray-600 flex-shrink-0";
  }

  let body: React.ReactNode;

  if (isAiThinking) {
    body = (
      <>
        <Brain
          size={16}
          className="flex-shrink-0 text-blue-500 animate-pulse"
        />
        <span className="italic">{item.message ?? ""}</span>
      </>
    );
  } else if (isLegendary && item.legendaryMeta) {
    const meta = item.legendaryMeta;
    const square = squareLabel(meta.move.to.x, meta.move.to.y);
    const pieceName = t(`learning.legendary.pieces.${meta.pieceType}`, {
      defaultValue: meta.pieceType,
    });
    const patternName = t(
      `learning.legendary.patterns.${meta.patternId}.name`,
      { defaultValue: meta.patternId },
    );
    const inventor = t(
      `learning.legendary.patterns.${meta.patternId}.inventor`,
      { defaultValue: "" },
    );

    let msgKey: string;
    if (meta.type === "attack") msgKey = "attack1";
    else if (meta.movesAway === 1) msgKey = "mate1";
    else msgKey = "mate2";

    const msg = t(`learning.legendary.${msgKey}`, {
      name: patternName,
      piece: pieceName,
      square,
    });

    body = (
      <>
        <Trophy size={16} className="flex-shrink-0 text-amber-500 mt-0.5" />
        <div>
          <span className="font-semibold">{msg}</span>
          {inventor && (
            <div className="text-xs italic text-amber-600 mt-0.5">
              {t("learning.legendary.by", { inventor })}
            </div>
          )}
        </div>
      </>
    );
  } else if (isAlert) {
    body = <span>{t(`learning.${item.variant}`)}</span>;
  } else {
    const v = item.variant as AnnotationVariant;
    const Icon = TACTIC_ICONS[v];
    const desc =
      v === "capture" && item.captureContext
        ? t("learning.tactics.captureDesc", item.captureContext)
        : t(`learning.tactics.${v}Desc`);
    body = (
      <>
        <Icon size={16} className="flex-shrink-0 text-gray-500" />
        <div>
          <span className="font-semibold">{t(`learning.tactics.${v}`)}</span>
          {desc && <span className="ml-1.5 text-gray-500 text-xs">{desc}</span>}
        </div>
      </>
    );
  }

  return (
    <div
      className={containerClass}
      style={{
        transition: `opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms ease`,
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateY(-16px)" : "translateY(0)",
        willChange: "opacity, transform",
      }}
    >
      {body}
      <button onClick={handleDismiss} className={dismissClass}>
        <X size={14} />
      </button>
    </div>
  );
}

export default function GameLabels({
  items,
  onDismiss,
}: {
  items: GameLabelItem[];
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;

  const sorted = [...items]
    .sort(
      (a, b) =>
        LABEL_PRIORITY[b.variant] - LABEL_PRIORITY[a.variant] ||
        b.createdAt - a.createdAt,
    )
    .slice(0, MAX_VISIBLE);

  return (
    <div
      className="relative w-full max-w-sm mx-auto"
      style={{ minHeight: "44px" }}
    >
      {sorted.map((item, index) => {
        const isFirst = index === 0;
        const yOffset = index * 8;
        const scale = Math.max(0.88, 1 - index * 0.03);
        const opacity = Math.max(0.3, 1 - index * 0.18);

        return (
          <div
            key={item.id}
            className={isFirst ? "relative" : "absolute inset-x-0 top-0"}
            style={
              isFirst
                ? { zIndex: MAX_VISIBLE }
                : {
                    zIndex: MAX_VISIBLE - index,
                    transform: `translateY(${yOffset}px) scale(${scale})`,
                    transformOrigin: "top center",
                    opacity,
                    pointerEvents: "none",
                    transition: `transform ${EXIT_MS}ms ease, opacity ${EXIT_MS}ms ease`,
                  }
            }
          >
            <SingleLabel item={item} onDismiss={onDismiss} />
          </div>
        );
      })}
    </div>
  );
}
