import type { Piece } from "../../types/chess";

/**
 * Computes FEN-style castling availability ("KQkq", "Kq", "-", …) from piece state.
 *
 * Rights are derived from hasMoved flags on the king and corner rooks.
 * Shared by the position-hash (triple-repetition) and FEN serialisation (Stockfish).
 *
 * FIDE rule 9.2: castling rights are part of a position's identity.
 */
export function computeCastlingRights(pieces: Piece[]): string {
  const whiteKing = pieces.find((p) => p.color === "white" && p.type === "king");
  const blackKing = pieces.find((p) => p.color === "black" && p.type === "king");

  let rights = "";

  if (whiteKing && !whiteKing.hasMoved) {
    const kRook = pieces.find(
      (p) =>
        p.color === "white" &&
        p.type === "rook" &&
        p.position.x === 7 &&
        p.position.y === 7 &&
        !p.hasMoved,
    );
    if (kRook) rights += "K";
    const qRook = pieces.find(
      (p) =>
        p.color === "white" &&
        p.type === "rook" &&
        p.position.x === 0 &&
        p.position.y === 7 &&
        !p.hasMoved,
    );
    if (qRook) rights += "Q";
  }

  if (blackKing && !blackKing.hasMoved) {
    const kRook = pieces.find(
      (p) =>
        p.color === "black" &&
        p.type === "rook" &&
        p.position.x === 7 &&
        p.position.y === 0 &&
        !p.hasMoved,
    );
    if (kRook) rights += "k";
    const qRook = pieces.find(
      (p) =>
        p.color === "black" &&
        p.type === "rook" &&
        p.position.x === 0 &&
        p.position.y === 0 &&
        !p.hasMoved,
    );
    if (qRook) rights += "q";
  }

  return rights || "-";
}
