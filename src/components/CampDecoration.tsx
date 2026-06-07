import {
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";

interface DesktopCampProps {
  src: string;
  angle: 90 | -90;
  order: number;
  zoneHeight: number;
}

function DesktopCamp({ src, angle, order, zoneHeight }: DesktopCampProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [wrapperWidth, setWrapperWidth] = useState(0);
  const [imgStyle, setImgStyle] = useState<CSSProperties>({ opacity: 0 });

  const compute = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !zoneHeight) return;
    const Z = zoneHeight;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    // Pre-rotation: CSS width → visual height, CSS height → visual width
    const preW = Z;
    const preH = (Z * H) / W;
    setWrapperWidth(preH);
    setImgStyle({
      width: preW,
      height: "auto",
      transform: `rotate(${angle}deg)`,
      transformOrigin: "center",
      maxWidth: "none",
      opacity: 1,
    });
  }, [angle, zoneHeight]);

  useEffect(() => {
    compute();
  }, [compute]);

  return (
    <div
      className="hidden md:flex items-center justify-center pointer-events-none flex-shrink-0"
      style={{ width: wrapperWidth || undefined, alignSelf: "stretch", order }}
    >
      <img
        ref={imgRef}
        src={src}
        style={imgStyle}
        alt=""
        draggable={false}
        onLoad={compute}
      />
    </div>
  );
}

export interface CampDecorationProps {
  campTop?: string;
  campBottom?: string;
  children?: ReactNode;
}

/**
 * Wraps board content with decorative camp images placed in the flex flow.
 * Desktop: flex-row — camps left/right of the board, overflow clipped toward screen edges.
 * Mobile: flex-col — camps above/below the board.
 * Zone height is measured directly on this container and passed to DesktopCamp for scaling.
 */
export function CampDecoration({
  campTop,
  campBottom,
  children,
}: CampDecorationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoneHeight, setZoneHeight] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      if (h > 0) setZoneHeight(h);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col md:flex-row items-center justify-center w-full flex-1 overflow-hidden"
    >
      {/* Mobile: above board (order 1) / Desktop: right of board (order 3) */}
      {campTop && (
        <>
          <img
            src={campTop}
            className="md:hidden w-full pointer-events-none"
            style={{ height: "auto", display: "block", order: 1 }}
            alt=""
            draggable={false}
          />
          <DesktopCamp
            src={campTop}
            angle={-90}
            order={3}
            zoneHeight={zoneHeight}
          />
        </>
      )}

      {/* Board content — always in the middle */}
      <div
        className="flex flex-col items-center justify-center flex-shrink-0 p-2 sm:p-4"
        style={{ order: 2 }}
      >
        {children}
      </div>

      {/* Mobile: below board (order 3) / Desktop: left of board (order 1) */}
      {campBottom && (
        <>
          <img
            src={campBottom}
            className="md:hidden w-full pointer-events-none"
            style={{ height: "auto", display: "block", order: 3 }}
            alt=""
            draggable={false}
          />
          <DesktopCamp
            src={campBottom}
            angle={90}
            order={1}
            zoneHeight={zoneHeight}
          />
        </>
      )}
    </div>
  );
}

export interface SideCampProps {
  src: string;
  angle: 90 | -90;
  /** Which screen edge this camp sits against */
  side: "left" | "right";
  /** Available lateral width in px (sideMargin) — camp overflows toward the screen edge */
  width: number;
  /** Zone height in px — used to scale the image so it fills the full height */
  zoneHeight: number;
}

/**
 * Absolutely-positioned camp for the "side" layout (wide screens with panels).
 * Sits behind all siblings (z-index: -1). Requires the parent to have
 * `position: relative` and `isolation: isolate` to establish a local stacking context.
 */
export function SideCamp({
  src,
  angle,
  side,
  width,
  zoneHeight,
}: SideCampProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgStyle, setImgStyle] = useState<CSSProperties>({ opacity: 0 });

  const compute = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !zoneHeight) return;
    setImgStyle({
      width: zoneHeight,
      height: "auto",
      maxWidth: "none",
      transform: `rotate(${angle}deg)`,
      transformOrigin: "center",
      opacity: 1,
    });
  }, [angle, zoneHeight]);

  useEffect(() => {
    compute();
  }, [compute]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        width,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        // board-adjacent edge stays flush: right-align for left camp, left-align for right camp
        justifyContent: side === "left" ? "flex-end" : "flex-start",
        zIndex: -1,
        pointerEvents: "none",
      }}
    >
      <img
        ref={imgRef}
        src={src}
        style={imgStyle}
        alt=""
        draggable={false}
        onLoad={compute}
      />
    </div>
  );
}
