import {
  Piece,
  PieceColor,
  PieceType,
  Position,
  GameMode,
  CastlingMove,
  GameState,
  MoveRecord,
} from "../../types/chess";
import { BOARD_SIZE } from "./board";
import { getPieceCapabilities, applyAssimilationCapture } from "./assimilation";

// ── Small shared helpers ─────────────────────────────────────────────────────

export const normalizePos = (x: number, y: number): Position => ({
  x: ((x % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE,
  y: ((y % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE,
});

export const switchTurn = (color: PieceColor): PieceColor =>
  color === "white" ? "black" : "white";

// ── Board lookup ─────────────────────────────────────────────────────────────

export const getPieceAt = (
  position: Position,
  pieces: Piece[],
): Piece | null => {
  const { x, y } = normalizePos(position.x, position.y);
  return pieces.find((p) => p.position.x === x && p.position.y === y) ?? null;
};

// ── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Borderless mode: white may not cross the bottom edge (y=7→8),
 * black may not cross the top edge (y=0→-1).
 */
function crossesForbiddenEdge(
  start: Position,
  target: Position,
  color: PieceColor,
): boolean {
  if (target.y === start.y) return false; // purely horizontal — no vertical crossing
  if (color === "white")
    return (start.y <= 7 && target.y > 7) || (start.y > 7 && target.y <= 7);
  return (start.y >= 0 && target.y < 0) || (start.y < 0 && target.y >= 0);
}

function isPathClear(
  start: Position,
  end: Position,
  pieces: Piece[],
  gameMode: GameMode,
): boolean {
  if (!gameMode.rules?.borderless) {
    const dx = Math.sign(end.x - start.x);
    const dy = Math.sign(end.y - start.y);
    let x = start.x + dx,
      y = start.y + dy;
    while (x !== end.x || y !== end.y) {
      if (getPieceAt({ x, y }, pieces)) return false;
      x += dx;
      y += dy;
    }
    return true;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const mover = getPieceAt(start, pieces);
  if (!mover) return false;
  if (crossesForbiddenEdge(start, end, mover.color)) return false;

  for (let i = 1; i < steps; i++) {
    const x = start.x + Math.round((dx * i) / steps);
    const y = start.y + Math.round((dy * i) / steps);
    if (getPieceAt({ x, y }, pieces)) return false;
  }
  return true;
}

// ── Per-type move validation ─────────────────────────────────────────────────

/**
 * Checks whether `piece` (at its current position) can reach `target` using
 * the rules of the given `type`. Shared guards (boundary, ally blocking, etc.)
 * are handled by the caller (`isValidMove`).
 */
function isValidMoveForSingleType(
  type: PieceType,
  piece: Piece,
  target: Position,
  pieces: Piece[],
  gameMode: GameMode,
): boolean {
  const dx = target.x - piece.position.x;
  const dy = target.y - piece.position.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const targetPiece = getPieceAt(normalizePos(target.x, target.y), pieces);

  switch (type) {
    case "pawn": {
      const dir = piece.color === "white" ? -1 : 1;
      const startRank = piece.color === "white" ? 6 : 1;
      if (dx === 0) {
        if (dy === dir && !targetPiece) return true;
        if (piece.position.y === startRank && dy === 2 * dir && !targetPiece)
          return !getPieceAt(
            { x: piece.position.x, y: piece.position.y + dir },
            pieces,
          );
      }
      return absDx === 1 && dy === dir && targetPiece !== null;
    }
    case "knight":
      return (absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2);
    case "bishop":
      return (
        absDx === absDy && isPathClear(piece.position, target, pieces, gameMode)
      );
    case "rook":
      return (
        (dx === 0 || dy === 0) &&
        isPathClear(piece.position, target, pieces, gameMode)
      );
    case "queen":
      return (
        (absDx === absDy || dx === 0 || dy === 0) &&
        isPathClear(piece.position, target, pieces, gameMode)
      );
    case "king":
      return absDx <= 1 && absDy <= 1;
    default:
      return false;
  }
}

// ── Move validation ──────────────────────────────────────────────────────────

export const isValidMove = (
  piece: Piece,
  target: Position,
  pieces: Piece[],
  gameMode: GameMode,
): boolean => {
  if (!gameMode.rules?.borderless) {
    if (target.x < 0 || target.x > 7 || target.y < 0 || target.y > 7)
      return false;
  }

  const norm = normalizePos(target.x, target.y);
  const targetPiece = getPieceAt(norm, pieces);
  if (targetPiece?.color === piece.color) return false;
  if (
    !gameMode.rules?.borderless &&
    piece.position.x === norm.x &&
    piece.position.y === norm.y
  )
    return false;
  if (
    gameMode.rules?.borderless &&
    crossesForbiddenEdge(piece.position, target, piece.color)
  )
    return false;

  const capabilities = gameMode.rules?.assimilation
    ? getPieceCapabilities(piece)
    : [piece.type];
  return capabilities.some((type) =>
    isValidMoveForSingleType(type, piece, target, pieces, gameMode),
  );
};

// ── Check detection ──────────────────────────────────────────────────────────

export const isInCheck = (
  color: PieceColor,
  pieces: Piece[],
  gameMode: GameMode,
): boolean => {
  const king = pieces.find((p) => p.type === "king" && p.color === color);
  if (!king) return false;
  if (!gameMode.rules?.borderless) {
    return pieces.some(
      (p) =>
        p.color !== color && isValidMove(p, king.position, pieces, gameMode),
    );
  }
  // In borderless mode an attacker can reach the king through any edge.
  // Test all 9 virtual king positions (direct + 8 wrapped equivalents) so that
  // paths going "the other way around" are not missed. crossesForbiddenEdge
  // inside isValidMove naturally rejects wrap directions forbidden for each color.
  const { x: kx, y: ky } = king.position;
  return pieces.some((p) => {
    if (p.color === color) return false;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (
          isValidMove(
            p,
            { x: kx + di * BOARD_SIZE, y: ky + dj * BOARD_SIZE },
            pieces,
            gameMode,
          )
        )
          return true;
      }
    }
    return false;
  });
};

export const wouldBeInCheck = (
  piece: Piece,
  target: Position,
  pieces: Piece[],
  gameMode: GameMode,
): boolean => {
  const norm = normalizePos(target.x, target.y);
  const simulated = pieces
    .filter((p) => !(p.position.x === norm.x && p.position.y === norm.y))
    .map((p) => (p === piece ? { ...p, position: norm } : p));
  return isInCheck(piece.color, simulated, gameMode);
};

export const isSquareUnderAttack = (
  position: Position,
  attackerColor: PieceColor,
  pieces: Piece[],
  gameMode: GameMode,
): boolean => {
  const attackers = pieces.filter((p) => p.color === attackerColor);

  // In borderless mode, test all 9 virtual equivalents of the target square
  // (aligned with isInCheck) so that wrap-around attacks are not missed.
  const targets: Position[] = gameMode.rules?.borderless
    ? Array.from({ length: 3 }, (_, di) =>
        Array.from({ length: 3 }, (_, dj) => ({
          x: position.x + (di - 1) * BOARD_SIZE,
          y: position.y + (dj - 1) * BOARD_SIZE,
        })),
      ).flat()
    : [position];

  return attackers.some((p) => {
    const caps = gameMode.rules?.assimilation
      ? getPieceCapabilities(p)
      : [p.type];
    // Pawns attack diagonally even onto empty squares.
    if (caps.includes("pawn")) {
      const dir = p.color === "white" ? -1 : 1;
      for (const t of targets) {
        if (Math.abs(p.position.x - t.x) === 1 && t.y - p.position.y === dir)
          return true;
      }
    }
    // All non-pawn capabilities are correctly handled by isValidMove.
    if (caps.filter((t) => t !== "pawn").length === 0) return false;
    return targets.some((t) => isValidMove(p, t, pieces, gameMode));
  });
};

// ── Castling ─────────────────────────────────────────────────────────────────

export const getCastlingMoves = (
  king: Piece,
  pieces: Piece[],
  gameMode: GameMode,
): CastlingMove[] => {
  if (king.type !== "king" || king.hasMoved) return [];
  if (isInCheck(king.color, pieces, gameMode)) return [];

  const { y } = king.position;
  const opp = switchTurn(king.color);
  const moves: CastlingMove[] = [];

  const tryRook = (
    rookX: number,
    kingTargetX: number,
    rookTargetX: number,
    clearXs: number[],
  ) => {
    const rook = pieces.find(
      (p) =>
        p.type === "rook" &&
        p.color === king.color &&
        p.position.x === rookX &&
        p.position.y === y &&
        !p.hasMoved,
    );
    if (!rook) return;
    if (clearXs.some((x) => getPieceAt({ x, y }, pieces))) return;
    if (isSquareUnderAttack({ x: rookTargetX, y }, opp, pieces, gameMode))
      return;
    if (isSquareUnderAttack({ x: kingTargetX, y }, opp, pieces, gameMode))
      return;
    moves.push({
      kingTarget: { x: kingTargetX, y },
      rookTarget: { x: rookTargetX, y },
      rook,
    });
  };

  tryRook(7, 6, 5, [5, 6]); // kingside
  tryRook(0, 2, 3, [1, 2, 3]); // queenside

  return moves;
};

export const findCastlingMove = (
  king: Piece,
  target: Position,
  pieces: Piece[],
  gameMode: GameMode,
): CastlingMove | null => {
  if (king.type !== "king") return null;
  return (
    getCastlingMoves(king, pieces, gameMode).find(
      (m) => m.kingTarget.x === target.x && m.kingTarget.y === target.y,
    ) ?? null
  );
};

// ── Legal moves ──────────────────────────────────────────────────────────────

/**
 * Generates candidate target squares from the piece's movement patterns,
 * without applying validity checks (blockers, king safety, etc.).
 * Over-generation is acceptable — isValidMove + wouldBeInCheck trim the list.
 * The invariant is: every square that would pass isValidMove must appear here.
 */
function generateMoveCandidates(piece: Piece, gameMode: GameMode): Position[] {
  const borderless = !!gameMode.rules?.borderless;
  const xMin = borderless ? -8 : 0;
  const xMax = borderless ? 15 : 7;
  const yMin = borderless ? -8 : 0;
  const yMax = borderless ? 15 : 7;

  const seen = new Set<string>();
  const result: Position[] = [];

  const add = (x: number, y: number) => {
    if (x < xMin || x > xMax || y < yMin || y > yMax) return;
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ x, y });
  };

  const { x: px, y: py } = piece.position;
  const capabilities = gameMode.rules?.assimilation
    ? getPieceCapabilities(piece)
    : [piece.type];

  for (const type of capabilities) {
    switch (type) {
      case "king": {
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            if (dx !== 0 || dy !== 0) add(px + dx, py + dy);
        break;
      }
      case "knight": {
        for (const [dx, dy] of [
          [2, 1],
          [2, -1],
          [-2, 1],
          [-2, -1],
          [1, 2],
          [1, -2],
          [-1, 2],
          [-1, -2],
        ] as [number, number][])
          add(px + dx, py + dy);
        break;
      }
      case "pawn": {
        const dir = piece.color === "white" ? -1 : 1;
        // Must use py === startRank, not !piece.hasMoved — matches isValidMoveForSingleType exactly.
        const startRank = piece.color === "white" ? 6 : 1;
        add(px, py + dir);
        if (py === startRank) add(px, py + 2 * dir);
        add(px - 1, py + dir);
        add(px + 1, py + dir);
        break;
      }
      case "rook": {
        for (let x = xMin; x <= xMax; x++) if (x !== px) add(x, py);
        for (let y = yMin; y <= yMax; y++) if (y !== py) add(px, y);
        break;
      }
      case "bishop": {
        for (const [dx, dy] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ] as [number, number][]) {
          let x = px + dx,
            y = py + dy;
          while (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
            add(x, y);
            x += dx;
            y += dy;
          }
        }
        break;
      }
      case "queen": {
        // Straight lines (rook-like)
        for (let x = xMin; x <= xMax; x++) if (x !== px) add(x, py);
        for (let y = yMin; y <= yMax; y++) if (y !== py) add(px, y);
        // Diagonals (bishop-like)
        for (const [dx, dy] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ] as [number, number][]) {
          let x = px + dx,
            y = py + dy;
          while (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
            add(x, y);
            x += dx;
            y += dy;
          }
        }
        break;
      }
    }
  }

  return result;
}

export const getValidMoves = (
  piece: Piece,
  pieces: Piece[],
  gameMode: GameMode,
): Position[] => {
  const castling =
    piece.type === "king" && !piece.hasMoved
      ? getCastlingMoves(piece, pieces, gameMode).map((m) => m.kingTarget)
      : [];

  const candidates = generateMoveCandidates(piece, gameMode);
  const regular: Position[] = [];
  for (const { x, y } of candidates) {
    if (
      isValidMove(piece, { x, y }, pieces, gameMode) &&
      !wouldBeInCheck(piece, { x, y }, pieces, gameMode)
    )
      regular.push({ x, y });
  }
  return [...castling, ...regular];
};

export const hasLegalMoves = (
  color: PieceColor,
  pieces: Piece[],
  gameMode: GameMode,
): boolean =>
  pieces
    .filter((p) => p.color === color)
    .some((p) => getValidMoves(p, pieces, gameMode).length > 0);

/** Returns true if the piece has at least one geometrically valid move, ignoring king-safety. */
export const hasRawMoves = (
  piece: Piece,
  pieces: Piece[],
  gameMode: GameMode,
): boolean => {
  for (const { x, y } of generateMoveCandidates(piece, gameMode)) {
    if (isValidMove(piece, { x, y }, pieces, gameMode)) return true;
  }
  return false;
};

// ── State transition ─────────────────────────────────────────────────────────

/** Pure function: apply a move and return the next GameState. */
export function applyMoveToState(
  prev: GameState,
  piece: Piece,
  rawTarget: Position,
  promotionType?: PieceType,
): GameState {
  const target = normalizePos(rawTarget.x, rawTarget.y);
  const castling = findCastlingMove(piece, target, prev.pieces, prev.gameMode);

  const captured = getPieceAt(target, prev.pieces);
  let pieces = captured
    ? prev.pieces.filter((p) => p.id !== captured.id)
    : [...prev.pieces];

  // Move piece (with pawn promotion and optional assimilation capture)
  pieces = pieces.map((p) => {
    if (p.id !== piece.id) return p;
    const promote: PieceType | undefined =
      p.type === "pawn" &&
      ((p.color === "white" && target.y === 0) ||
        (p.color === "black" && target.y === 7))
        ? (promotionType ?? "queen")
        : undefined;
    let updated: Piece = {
      ...p,
      position: target,
      hasMoved: true,
      ...(promote ? { type: promote } : {}),
    };
    if (prev.gameMode.rules?.assimilation && captured) {
      updated = applyAssimilationCapture(updated, captured);
    }
    return updated;
  });

  // Move rook for castling
  if (castling) {
    pieces = pieces.map((p) =>
      p.id === castling.rook.id
        ? { ...p, position: castling.rookTarget, hasMoved: true }
        : p,
    );
  }

  const wasPromotion =
    piece.type === "pawn" &&
    ((piece.color === "white" && target.y === 0) ||
      (piece.color === "black" && target.y === 7));

  const moveRecord: MoveRecord = {
    piece,
    from: piece.position,
    to: target,
    capturedPiece: captured ?? null,
    wasPromotion,
  };

  const nextTurn = switchTurn(prev.currentTurn);
  const moveCount = {
    ...prev.moveCount,
    [prev.currentTurn]: prev.moveCount[prev.currentTurn] + 1,
  };
  // Explicitly clear surrender fields so they never leak through the spread
  // into a state produced by a normal move (checkmate, stalemate, etc.).
  const base = {
    ...prev,
    pieces,
    currentTurn: nextTurn,
    selectedPiece: null,
    validMoves: [],
    moveCount,
    moves: [...prev.moves, moveRecord],
    surrenderedBy: undefined,
  };

  if (captured?.type === "king")
    return {
      ...base,
      isCheck: false,
      gameOver: true,
      winner: prev.currentTurn,
    };

  if (pieces.every((p) => p.type === "king"))
    return {
      ...base,
      isCheck: false,
      gameOver: true,
      winner: null,
      drawReason: "only-kings",
    };

  const nextInCheck = isInCheck(nextTurn, pieces, prev.gameMode);
  const nextHasLegal = hasLegalMoves(nextTurn, pieces, prev.gameMode);

  return {
    ...base,
    isCheck: nextInCheck,
    gameOver: !nextHasLegal,
    winner: nextInCheck && !nextHasLegal ? prev.currentTurn : null,
    drawReason: !nextInCheck && !nextHasLegal ? "stalemate" : undefined,
  };
}
