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
  AlertTriangle,
} from "lucide-react";

export type AnnotationVariant =
  | "check"
  | "discoveredCheck"
  | "fork"
  | "pin"
  | "capture"
  | "promotion"
  | "castling";

export type AlertVariant =
  | "pinnedPiece"
  | "blockedPiece"
  | "checkBlockedPiece";

export type LabelVariant = AnnotationVariant | AlertVariant;

export interface GameLabelItem {
  id: string;
  variant: LabelVariant;
  createdAt: number;
}

const LABEL_PRIORITY: Record<LabelVariant, number> = {
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
};

const LABEL_TIMEOUT: Record<LabelVariant, number> = {
  check: 4000,
  discoveredCheck: 4000,
  fork: 4000,
  pin: 4000,
  capture: 4000,
  promotion: 4000,
  castling: 4000,
  checkBlockedPiece: 3000,
  pinnedPiece: 3000,
  blockedPiece: 3000,
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

  const containerClass = isAlert
    ? "flex items-center gap-2 px-4 py-2.5 bg-white border border-orange-200 rounded-lg shadow-md text-sm text-orange-700"
    : "flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-md text-sm text-gray-700";

  const dismissClass = isAlert
    ? "ml-2 text-orange-400 hover:text-orange-600"
    : "ml-2 text-gray-400 hover:text-gray-600";

  let body: React.ReactNode;
  if (isAlert) {
    body = <span>{t(`learning.${item.variant}`)}</span>;
  } else {
    const v = item.variant as AnnotationVariant;
    const Icon = TACTIC_ICONS[v];
    const desc = t(`learning.tactics.${v}Desc`);
    body = (
      <>
        <Icon size={16} className="flex-shrink-0 text-gray-500" />
        <div>
          <span className="font-semibold">{t(`learning.tactics.${v}`)}</span>
          {desc && (
            <span className="ml-1.5 text-gray-500 text-xs">{desc}</span>
          )}
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
    <div className="relative" style={{ minHeight: "44px" }}>
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
