import { Piece, PieceColor, Position, GameMode } from "../../types/chess";
import {
  getValidMoves,
  isInCheck,
  hasLegalMoves,
  normalizePos,
  isValidMove,
  isSquareUnderAttack,
  getPieceAt,
} from "./moves";

export interface LegendaryPatternResult {
  patternId: string;
  type: "mate" | "attack";
  move: { from: Position; to: Position };
  movesAway: 1 | 2;
  pieceType: string;
}

function oppColor(color: PieceColor): PieceColor {
  return color === "white" ? "black" : "white";
}

function simMove(pieces: Piece[], piece: Piece, target: Position): Piece[] {
  const norm = normalizePos(target.x, target.y);
  const promote = piece.type === "pawn" && (norm.y === 0 || norm.y === 7);
  const updated = {
    ...piece,
    position: norm,
    hasMoved: true,
    ...(promote ? { type: "queen" as const } : {}),
  };
  return pieces
    .filter(
      (p) =>
        !(
          p.position.x === norm.x &&
          p.position.y === norm.y &&
          p.color !== piece.color
        ),
    )
    .map((p) => (p.id === piece.id ? updated : p));
}

function isCheckmate(
  pieces: Piece[],
  victimColor: PieceColor,
  gameMode: GameMode,
): boolean {
  return (
    isInCheck(victimColor, pieces, gameMode) &&
    !hasLegalMoves(victimColor, pieces, gameMode)
  );
}

function classifyMate(
  after: Piece[],
  movedPiece: Piece,
  gameMode: GameMode,
): string {
  const opp = oppColor(movedPiece.color);
  const king = after.find((p) => p.type === "king" && p.color === opp);
  if (!king) return "";

  const kp = king.position;
  const isCorner = (kp.x === 0 || kp.x === 7) && (kp.y === 0 || kp.y === 7);
  const isEdge = kp.x === 0 || kp.x === 7 || kp.y === 0 || kp.y === 7;
  const isBackRank = kp.y === 0 || kp.y === 7;

  const attackers = after.filter(
    (p) => p.color === movedPiece.color && isValidMove(p, kp, after, gameMode),
  );
  if (attackers.length === 0) return "";

  // Pieces that confine the king by controlling its adjacent escape squares
  // (used to classify patterns like Arabian and Opera where a piece may block
  // escapes without giving check directly).
  const confiners = after.filter((p) => {
    if (p.color !== movedPiece.color || attackers.includes(p)) return false;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = kp.x + dx, ny = kp.y + dy;
        if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
        if (isValidMove(p, { x: nx, y: ny }, after, gameMode)) return true;
      }
    }
    return false;
  });
  const allMatingPieces = [...attackers, ...confiners];

  const hasKnight = attackers.some((p) => p.type === "knight");
  const hasRook = attackers.some((p) => p.type === "rook");
  const hasBishop = attackers.some((p) => p.type === "bishop");
  const hasQueen = attackers.some((p) => p.type === "queen");
  const hasKnightAll = allMatingPieces.some((p) => p.type === "knight");
  const hasRookAll = allMatingPieces.some((p) => p.type === "rook");
  const hasBishopAll = allMatingPieces.some((p) => p.type === "bishop");

  // Adjacent squares occupied by own pieces (for smothered mate detection)
  let adjOwnCount = 0;
  let adjTotal = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = kp.x + dx,
        ny = kp.y + dy;
      if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
      adjTotal++;
      const p = getPieceAt({ x: nx, y: ny }, after);
      if (p && p.color === opp) adjOwnCount++;
    }
  }

  // Scholar's Mate: queen lands on f7 or f2
  if (movedPiece.type === "queen") {
    const qp = movedPiece.position;
    if (qp.x === 5 && (qp.y === 1 || qp.y === 6)) return "scholarsmate";
  }

  // Smothered Mate: knight gives check, king almost entirely surrounded by own pieces
  if (hasKnight && adjOwnCount >= adjTotal - 1) return "smotheredmate";

  // Boden's Mate: two bishops on opposing diagonal colors
  const ourBishops = after.filter(
    (p) => p.color === movedPiece.color && p.type === "bishop",
  );
  if (hasBishop && ourBishops.length >= 2) {
    const hasLight = ourBishops.some(
      (b) => (b.position.x + b.position.y) % 2 === 0,
    );
    const hasDark = ourBishops.some(
      (b) => (b.position.x + b.position.y) % 2 === 1,
    );
    if (hasLight && hasDark) return "bodensmate";
  }

  // Arabian Mate: rook + knight, king in corner (knight may confine without checking)
  if (isCorner && hasRookAll && hasKnightAll) return "arabianmate";

  // Anastasia's Mate: rook + knight, king on edge (not corner)
  if (isEdge && !isCorner && hasRookAll && hasKnightAll) return "anastasiamate";

  // Greco's Mate: bishop + rook, king in corner
  if (isCorner && hasRookAll && hasBishopAll) return "grecomate";

  // Lolli's Mate: queen + pawn on f6/f3 adjacent to the attacking queen
  if (hasQueen) {
    const hasPawnF = after.some(
      (p) =>
        p.color === movedPiece.color &&
        p.type === "pawn" &&
        p.position.x === 5 &&
        (p.position.y === 2 || p.position.y === 5),
    );
    if (hasPawnF) return "lollismate";
  }

  // Opera Mate: rook + bishop, back rank (bishop may confine without checking)
  if (isBackRank && hasRookAll && hasBishopAll) return "operamate";

  // Back Rank Mate: rook or queen, back rank
  if (isBackRank && (hasRook || hasQueen)) return "backrankmate";

  // Hook Mate: knight + rook + pawn
  if (
    hasKnight &&
    hasRook &&
    after.some((p) => p.color === movedPiece.color && p.type === "pawn")
  ) {
    return "hookmate";
  }

  return "";
}

function detectScholarsSetup(
  pieces: Piece[],
  color: PieceColor,
  gameMode: GameMode,
): { from: Position; to: Position; pieceType: string } | null {
  const f7: Position = color === "white" ? { x: 5, y: 1 } : { x: 5, y: 6 };

  // Opponent king on starting square and hasn't moved
  const oppKing = pieces.find(
    (p) => p.type === "king" && p.color === oppColor(color),
  );
  if (!oppKing || oppKing.hasMoved) return null;

  // Something to capture on f7
  if (!getPieceAt(f7, pieces)) return null;

  // Our bishop already deployed, covers f7
  const bishop = pieces.find(
    (p) =>
      p.color === color &&
      p.type === "bishop" &&
      p.hasMoved &&
      isValidMove(p, f7, pieces, gameMode),
  );
  if (!bishop) return null;

  // f7 only defended by king (no other piece)
  const hasOtherDefender = pieces.some(
    (p) =>
      p.color === oppColor(color) &&
      p.type !== "king" &&
      isValidMove(p, f7, pieces, gameMode),
  );
  if (hasOtherDefender) return null;

  const queen = pieces.find((p) => p.color === color && p.type === "queen");
  if (!queen) return null;

  const queenMoves = getValidMoves(queen, pieces, gameMode);

  // If queen can already reach f7, Phase 1 handles it
  if (queenMoves.some((m) => m.x === f7.x && m.y === f7.y)) return null;

  // Find a queen move that enables Qxf7 next turn and f7 stays only king-defended
  for (const qm of queenMoves) {
    const temp = simMove(pieces, queen, qm);
    const queenAt = temp.find((p) => p.id === queen.id)!;
    if (!isValidMove(queenAt, f7, temp, gameMode)) continue;
    const stillClear = !temp.some(
      (p) =>
        p.color === oppColor(color) &&
        p.type !== "king" &&
        isValidMove(p, f7, temp, gameMode),
    );
    if (!stillClear) continue;
    // Skip if the queen would be immediately en prise at qm.
    if (isSquareUnderAttack(qm, oppColor(color), temp, gameMode)) continue;
    return { from: queen.position, to: qm, pieceType: "queen" };
  }

  return null;
}

function detectLegalsSetup(
  pieces: Piece[],
  color: PieceColor,
): { from: Position; to: Position; pieceType: string } | null {
  // White: Nf3=(5,5), Bc4=(2,4), Nc3=(2,5), opp Bg4=(6,4), opp e5=(4,3), opp d6=(3,2)
  const nf3: Position = color === "white" ? { x: 5, y: 5 } : { x: 5, y: 2 };
  const bc4: Position = color === "white" ? { x: 2, y: 4 } : { x: 2, y: 3 };
  const nc3: Position = color === "white" ? { x: 2, y: 5 } : { x: 2, y: 2 };
  const bg4: Position = color === "white" ? { x: 6, y: 4 } : { x: 6, y: 3 };
  const e5: Position = color === "white" ? { x: 4, y: 3 } : { x: 4, y: 4 };
  const d6: Position = color === "white" ? { x: 3, y: 2 } : { x: 3, y: 5 };

  const hasNf3 = pieces.some(
    (p) =>
      p.color === color &&
      p.type === "knight" &&
      p.position.x === nf3.x &&
      p.position.y === nf3.y,
  );
  const hasBc4 = pieces.some(
    (p) =>
      p.color === color &&
      p.type === "bishop" &&
      p.position.x === bc4.x &&
      p.position.y === bc4.y,
  );
  const hasNc3 = pieces.some(
    (p) =>
      p.color === color &&
      p.type === "knight" &&
      p.position.x === nc3.x &&
      p.position.y === nc3.y,
  );
  const hasBg4 = pieces.some(
    (p) =>
      p.color === oppColor(color) &&
      p.type === "bishop" &&
      p.position.x === bg4.x &&
      p.position.y === bg4.y,
  );
  const hasE5Pawn = pieces.some(
    (p) =>
      p.color === oppColor(color) &&
      p.type === "pawn" &&
      p.position.x === e5.x &&
      p.position.y === e5.y,
  );
  const hasD6Pawn = pieces.some(
    (p) =>
      p.color === oppColor(color) &&
      p.type === "pawn" &&
      p.position.x === d6.x &&
      p.position.y === d6.y,
  );

  if (!hasNf3 || !hasBc4 || !hasNc3 || !hasBg4 || !hasE5Pawn || !hasD6Pawn)
    return null;

  // Suggest Nxe5 (knight from f3 captures opponent's e5 pawn)
  return { from: nf3, to: e5, pieceType: "knight" };
}

function detectGreekGift(
  pieces: Piece[],
  color: PieceColor,
  gameMode: GameMode,
): { from: Position; to: Position; pieceType: string } | null {
  const h7: Position = color === "white" ? { x: 7, y: 1 } : { x: 7, y: 6 };
  const g5: Position = color === "white" ? { x: 6, y: 3 } : { x: 6, y: 4 };

  // Opponent king castled kingside (on g8/f8 for white attack, g1/f1 for black)
  const oppKing = pieces.find(
    (p) => p.type === "king" && p.color === oppColor(color),
  );
  if (!oppKing) return null;
  const ky = color === "white" ? 0 : 7;
  if (oppKing.position.y !== ky || oppKing.position.x < 5) return null;

  // Something to capture on h7
  if (!getPieceAt(h7, pieces)) return null;

  // Our bishop can capture on h7
  const bishop = pieces.find(
    (p) =>
      p.color === color &&
      p.type === "bishop" &&
      isValidMove(p, h7, pieces, gameMode),
  );
  if (!bishop) return null;

  // Our knight can reach g5
  const knightCanReachG5 = pieces.some(
    (p) =>
      p.color === color &&
      p.type === "knight" &&
      getValidMoves(p, pieces, gameMode).some(
        (m) => m.x === g5.x && m.y === g5.y,
      ),
  );
  if (!knightCanReachG5) return null;

  // Our queen is active (not on starting square)
  const queenStart = color === "white" ? { x: 3, y: 7 } : { x: 3, y: 0 };
  const queen = pieces.find((p) => p.color === color && p.type === "queen");
  if (
    !queen ||
    (queen.position.x === queenStart.x && queen.position.y === queenStart.y)
  )
    return null;

  return { from: bishop.position, to: h7, pieceType: "bishop" };
}

function detectFriedLiver(
  pieces: Piece[],
  color: PieceColor,
  gameMode: GameMode,
): { from: Position; to: Position; pieceType: string } | null {
  const g5: Position = color === "white" ? { x: 6, y: 3 } : { x: 6, y: 4 };
  const d5: Position = color === "white" ? { x: 3, y: 3 } : { x: 3, y: 4 };
  const c4: Position = color === "white" ? { x: 2, y: 4 } : { x: 2, y: 3 };
  const f7: Position = color === "white" ? { x: 5, y: 1 } : { x: 5, y: 6 };
  const e8: Position = color === "white" ? { x: 4, y: 0 } : { x: 4, y: 7 };

  const knightG5 = pieces.find(
    (p) =>
      p.color === color &&
      p.type === "knight" &&
      p.position.x === g5.x &&
      p.position.y === g5.y,
  );
  if (!knightG5) return null;

  const hasOppKnightD5 = pieces.some(
    (p) =>
      p.color === oppColor(color) &&
      p.type === "knight" &&
      p.position.x === d5.x &&
      p.position.y === d5.y,
  );
  if (!hasOppKnightD5) return null;

  const hasBishopC4 = pieces.some(
    (p) =>
      p.color === color &&
      p.type === "bishop" &&
      p.position.x === c4.x &&
      p.position.y === c4.y,
  );
  if (!hasBishopC4) return null;

  const oppKing = pieces.find(
    (p) => p.type === "king" && p.color === oppColor(color),
  );
  if (!oppKing || oppKing.position.x !== e8.x || oppKing.position.y !== e8.y)
    return null;

  if (!getPieceAt(f7, pieces)) return null;

  const canTakeF7 = getValidMoves(knightG5, pieces, gameMode).some(
    (m) => m.x === f7.x && m.y === f7.y,
  );
  if (!canTakeF7) return null;

  return { from: g5, to: f7, pieceType: "knight" };
}

export function detectLegendaryPattern(
  pieces: Piece[],
  colorToMove: PieceColor,
  gameMode: GameMode,
): LegendaryPatternResult | null {
  // Only applies to classic mode
  if (
    gameMode.rules?.borderless ||
    gameMode.rules?.randomPieces ||
    gameMode.rules?.assimilation
  ) {
    return null;
  }

  // Phase 1: 1-move mates
  for (const piece of pieces.filter((p) => p.color === colorToMove)) {
    for (const move of getValidMoves(piece, pieces, gameMode)) {
      const after = simMove(pieces, piece, move);
      if (!isCheckmate(after, oppColor(colorToMove), gameMode)) continue;
      const movedPieceAfter = after.find((p) => p.id === piece.id);
      if (!movedPieceAfter) continue;
      const patternId = classifyMate(after, movedPieceAfter, gameMode);
      if (patternId) {
        return {
          patternId,
          type: "mate",
          move: { from: piece.position, to: move },
          movesAway: 1,
          pieceType: piece.type,
        };
      }
    }
  }

  // Phase 2: attack sacrifice patterns
  const greekGift = detectGreekGift(pieces, colorToMove, gameMode);
  if (greekGift) {
    return {
      patternId: "greekgift",
      type: "attack",
      move: { from: greekGift.from, to: greekGift.to },
      movesAway: 1,
      pieceType: greekGift.pieceType,
    };
  }

  const friedLiver = detectFriedLiver(pieces, colorToMove, gameMode);
  if (friedLiver) {
    return {
      patternId: "friedliver",
      type: "attack",
      move: { from: friedLiver.from, to: friedLiver.to },
      movesAway: 1,
      pieceType: friedLiver.pieceType,
    };
  }

  // Phase 3: 2-move setups
  const scholarsSetup = detectScholarsSetup(pieces, colorToMove, gameMode);
  if (scholarsSetup) {
    return {
      patternId: "scholarsmate",
      type: "mate",
      move: { from: scholarsSetup.from, to: scholarsSetup.to },
      movesAway: 2,
      pieceType: scholarsSetup.pieceType,
    };
  }

  const legalsSetup = detectLegalsSetup(pieces, colorToMove);
  if (legalsSetup) {
    return {
      patternId: "legalsmate",
      type: "mate",
      move: { from: legalsSetup.from, to: legalsSetup.to },
      movesAway: 2,
      pieceType: legalsSetup.pieceType,
    };
  }

  return null;
}
