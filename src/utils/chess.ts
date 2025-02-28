import {
  Piece,
  PieceType,
  Position,
  PieceColor,
  GameMode,
  CastlingMove,
} from '../types/chess';

export const UNICODE_PIECES: Record<PieceColor, Record<PieceType, string>> = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙',
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟',
  },
};

export const getInitialPieces = (gameMode: GameMode): Piece[] => {
  if (gameMode.rules?.randomPieces) {
    return generateRandomPieces();
  }
  
  return [
    // White pieces
    { type: 'rook', color: 'white', position: { x: 0, y: 7 }, hasMoved: false },
    { type: 'knight', color: 'white', position: { x: 1, y: 7 } },
    { type: 'bishop', color: 'white', position: { x: 2, y: 7 } },
    { type: 'queen', color: 'white', position: { x: 3, y: 7 } },
    { type: 'king', color: 'white', position: { x: 4, y: 7 }, hasMoved: false },
    { type: 'bishop', color: 'white', position: { x: 5, y: 7 } },
    { type: 'knight', color: 'white', position: { x: 6, y: 7 } },
    { type: 'rook', color: 'white', position: { x: 7, y: 7 }, hasMoved: false },
    ...Array(8).fill(null).map((_, i) => ({
      type: 'pawn' as PieceType,
      color: 'white' as PieceColor,
      position: { x: i, y: 6 },
    })),

    // Black pieces
    { type: 'rook', color: 'black', position: { x: 0, y: 0 }, hasMoved: false },
    { type: 'knight', color: 'black', position: { x: 1, y: 0 } },
    { type: 'bishop', color: 'black', position: { x: 2, y: 0 } },
    { type: 'queen', color: 'black', position: { x: 3, y: 0 } },
    { type: 'king', color: 'black', position: { x: 4, y: 0 }, hasMoved: false },
    { type: 'bishop', color: 'black', position: { x: 5, y: 0 } },
    { type: 'knight', color: 'black', position: { x: 6, y: 0 } },
    { type: 'rook', color: 'black', position: { x: 7, y: 0 }, hasMoved: false },
    ...Array(8).fill(null).map((_, i) => ({
      type: 'pawn' as PieceType,
      color: 'black' as PieceColor,
      position: { x: i, y: 1 },
    })),
  ];
};

export const initialPieces = getInitialPieces({ id: 'classic', title: '', description: '', image: '', rules: { borderless: false } });

const generateRandomPieces = (): Piece[] => {
  const pieces: Piece[] = [];
  
  // Generate pieces for both colors
  ['white', 'black'].forEach(color => {
    const pieceColor = color as PieceColor;
    const startRow = pieceColor === 'white' ? 7 : 0;
    const pawnRow = pieceColor === 'white' ? 6 : 1;
    
    // Always place king in its standard position
    pieces.push({
      type: 'king',
      color: pieceColor,
      position: { x: 4, y: startRow },
      hasMoved: false
    });
    
    // Create a list of available positions (excluding king's position)
    const availablePositions: Position[] = [];
    
    // Add positions from the back row (excluding king's position)
    for (let x = 0; x < 8; x++) {
      if (x !== 4) { // Skip king's position
        availablePositions.push({ x, y: startRow });
      }
    }
    
    // Add positions from the pawn row
    for (let x = 0; x < 8; x++) {
      availablePositions.push({ x, y: pawnRow });
    }
    
    // Shuffle the available positions
    for (let i = availablePositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availablePositions[i], availablePositions[j]] = [availablePositions[j], availablePositions[i]];
    }
    
      const pieceProbabilities = [
          { type: 'pawn', probability: 8 },
          { type: 'rook', probability: 2 },
          { type: 'knight', probability: 2 },
          { type: 'bishop', probability: 2 },
          { type: 'queen', probability: 1 },
    ];
    
      const totalProbability = pieceProbabilities.reduce(
          (sum, piece) => sum + piece.probability,
          0
      );

      const piecePool: PieceType[] = [];
      const poolSize = 15; // King is always there

      for (let i = 0; i < poolSize; i++) {
          let random = Math.random() * totalProbability;
          for (let piece of pieceProbabilities) {
              random -= piece.probability;
              if (random <= 0) {
                  piecePool.push(piece.type as PieceType);
                  break; // Sortir de la boucle une fois la pièce sélectionnée
              }
          }
      }
      console.log(piecePool);
    
    // Assign pieces to positions
    availablePositions.forEach((position, index) => {
      // If we have more positions than pieces in the pool, just use what we have
      if (index < piecePool.length) {
        const piece = {
          type: piecePool[index],
          color: pieceColor,
          position: position
        };
        
        // Add hasMoved property for rooks
        if (piece.type === 'rook') {
          piece.hasMoved = false;
        }
        
        pieces.push(piece);
      }
    });
  });
  
  return pieces;
};

const doesPathCrossForbiddenBorder = (start: Position, target: Position, color: PieceColor): boolean => {
  // Calculate movement vector
  const dx = target.x - start.x;
  const dy = target.y - start.y;

  // For white pieces: check if path crosses bottom border (y = 7)
  // For black pieces: check if path crosses top border (y = 0)
  const forbiddenY = color === 'white' ? 7 : 0;

  // If movement is purely horizontal, no forbidden border crossing
  if (dy === 0) return false;

  // For vertical or diagonal movement, check if the path crosses the forbidden border
  if (color === 'white') {
    // White pieces can't move through bottom border (y = 7)
    // Check if the path goes from y < 7 to y > 7 or vice versa
    const crossesBottom = (start.y <= 7 && target.y > 7) || (start.y > 7 && target.y <= 7);
    return crossesBottom;
  } else {
    // Black pieces can't move through top border (y = 0)
    // Check if the path goes from y > 0 to y < 0 or vice versa
    const crossesTop = (start.y >= 0 && target.y < 0) || (start.y < 0 && target.y >= 0);
    return crossesTop;
  }
};

export const getPieceAt = (position: Position, pieces: Piece[]): Piece | null => {
  const normalizedPos = {
    x: ((position.x % 8) + 8) % 8,
    y: ((position.y % 8) + 8) % 8
  };
  return pieces.find(p => p.position.x === normalizedPos.x && p.position.y === normalizedPos.y) || null;
};

const isPathClear = (start: Position, end: Position, pieces: Piece[], gameMode: GameMode): boolean => {
  if (!gameMode.rules?.borderless) {
    const dx = Math.sign(end.x - start.x);
    const dy = Math.sign(end.y - start.y);
    let x = start.x + dx;
    let y = start.y + dy;

    while (x !== end.x || y !== end.y) {
      if (getPieceAt({ x, y }, pieces)) return false;
      x += dx;
      y += dy;
    }
    return true;
  }

  // For borderless mode, check all possible paths
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  
  const piece = pieces.find(p => p.position.x === start.x && p.position.y === start.y);
  if (!piece) return false;

  // Check if the path crosses a forbidden border
  if (doesPathCrossForbiddenBorder(start, end, piece.color)) {
    return false;
  }

  // Check each step of the path for pieces
  for (let i = 1; i < steps; i++) {
    const x = start.x + Math.round((dx * i) / steps);
    const y = start.y + Math.round((dy * i) / steps);
    if (getPieceAt({ x, y }, pieces)) {
      return false;
    }
  }
  
  return true;
};

// Check if a square is under attack by any opponent piece
export const isSquareUnderAttack = (position: Position, attackerColor: PieceColor, pieces: Piece[], gameMode: GameMode): boolean => {
  return pieces
    .filter(piece => piece.color === attackerColor)
    .some(piece => {
      // For castling, we need to check if the square is under attack without considering check
      // So we create a simplified version of isValidMove that doesn't call wouldBeInCheck
      if (piece.type === 'pawn') {
        // Pawns attack diagonally
        const direction = piece.color === 'white' ? -1 : 1;
        const dx = Math.abs(piece.position.x - position.x);
        const dy = position.y - piece.position.y;
        return dx === 1 && dy === direction;
      } else {
        return isValidMove(piece, position, pieces, gameMode, true);
      }
    });
};

// Check if castling is valid
export const getCastlingMoves = (king: Piece, pieces: Piece[], gameMode: GameMode): CastlingMove[] => {
  if (king.type !== 'king' || king.hasMoved) return [];
  
  const castlingMoves: CastlingMove[] = [];
  const y = king.position.y;
  const color = king.color;
  const opponentColor = color === 'white' ? 'black' : 'white';
  
  // Check kingside castling (short castling)
  const kingsideRook = pieces.find(p => 
    p.type === 'rook' && 
    p.color === color && 
    p.position.x === 7 && 
    p.position.y === y && 
    p.hasMoved === false
  );
  
  if (kingsideRook) {
    // Check if path is clear
    const pathClear = !getPieceAt({x: 5, y}, pieces) && !getPieceAt({x: 6, y}, pieces);
    
    // Check if king is not in check and doesn't pass through or end up on an attacked square
    const kingNotInCheck = !isInCheck(color, pieces, gameMode);
    const passThroughSafe = !isSquareUnderAttack({x: 5, y}, opponentColor, pieces, gameMode);
    const endPositionSafe = !isSquareUnderAttack({x: 6, y}, opponentColor, pieces, gameMode);
    
    if (pathClear && kingNotInCheck && passThroughSafe && endPositionSafe) {
      castlingMoves.push({
        kingTarget: {x: 6, y},
        rookTarget: {x: 5, y},
        rook: kingsideRook
      });
    }
  }
  
  // Check queenside castling (long castling)
  const queensideRook = pieces.find(p => 
    p.type === 'rook' && 
    p.color === color && 
    p.position.x === 0 && 
    p.position.y === y && 
    p.hasMoved === false
  );
  
  if (queensideRook) {
    // Check if path is clear
    const pathClear = !getPieceAt({x: 1, y}, pieces) && 
                      !getPieceAt({x: 2, y}, pieces) && 
                      !getPieceAt({x: 3, y}, pieces);
    
    // Check if king is not in check and doesn't pass through or end up on an attacked square
    const kingNotInCheck = !isInCheck(color, pieces, gameMode);
    const passThroughSafe = !isSquareUnderAttack({x: 3, y}, opponentColor, pieces, gameMode);
    const endPositionSafe = !isSquareUnderAttack({x: 2, y}, opponentColor, pieces, gameMode);
    
    if (pathClear && kingNotInCheck && passThroughSafe && endPositionSafe) {
      castlingMoves.push({
        kingTarget: {x: 2, y},
        rookTarget: {x: 3, y},
        rook: queensideRook
      });
    }
  }
  
  return castlingMoves;
};

export const getValidMoves = (piece: Piece, pieces: Piece[], gameMode: GameMode): Position[] => {
  const validMoves: Position[] = [];
  const range = gameMode.rules?.borderless ? 16 : 8;

  // Special case for castling
  if (piece.type === 'king' && !piece.hasMoved) {
    const castlingMoves = getCastlingMoves(piece, pieces, gameMode);
    castlingMoves.forEach(move => {
      validMoves.push(move.kingTarget);
    });
  }

  for (let x = -8; x < range; x++) {
    for (let y = -8; y < range; y++) {
      const target = { x, y };
      if (isValidMove(piece, target, pieces, gameMode) &&
          !wouldBeInCheck(piece, target, pieces, gameMode)) {
        validMoves.push(target);
      }
    }
  }

  return validMoves;
};

export const isValidMove = (
  piece: Piece, 
  target: Position, 
  pieces: Piece[], 
  gameMode: GameMode,
  skipCheckValidation = false
): boolean => {
  if (!gameMode.rules?.borderless) {
    if (target.x < 0 || target.x > 7 || target.y < 0 || target.y > 7) return false;
  }

  const normalizedTarget = {
    x: ((target.x % 8) + 8) % 8,
    y: ((target.y % 8) + 8) % 8
  };

  const targetPiece = getPieceAt(normalizedTarget, pieces);
  if (targetPiece?.color === piece.color) return false;

  if (!gameMode.rules?.borderless && (
    piece.position.x === normalizedTarget.x && 
    piece.position.y === normalizedTarget.y
  )) return false;

  // Check if the move crosses a forbidden border
  if (gameMode.rules?.borderless && doesPathCrossForbiddenBorder(piece.position, target, piece.color)) {
    return false;
  }

  const dx = target.x - piece.position.x;
  const dy = target.y - piece.position.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  switch (piece.type) {
    case 'pawn': {
      const direction = piece.color === 'white' ? -1 : 1;
      const startRank = piece.color === 'white' ? 6 : 1;
      
      // Forward movement
      if (dx === 0) {
        if (dy === direction && !targetPiece) {
          return true;
        }
        if (piece.position.y === startRank && dy === 2 * direction) {
          const intermediateY = piece.position.y + direction;
          return !targetPiece && !getPieceAt({ x: piece.position.x, y: intermediateY }, pieces);
        }
      }
      
      // Capture
      if (absDx === 1 && dy === direction) {
        return targetPiece !== null;
      }
      return false;
    }

    case 'knight':
      // For knights, we still need to check if the move crosses a forbidden border
      return (absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2);

    case 'bishop':
      return absDx === absDy && isPathClear(piece.position, target, pieces, gameMode);

    case 'rook':
      return (dx === 0 || dy === 0) && isPathClear(piece.position, target, pieces, gameMode);

    case 'queen':
      return (absDx === absDy || dx === 0 || dy === 0) && isPathClear(piece.position, target, pieces, gameMode);

    case 'king': {
      // Normal king move
      if (absDx <= 1 && absDy <= 1) {
        return true;
      }
      
      // Castling moves are handled separately in getValidMoves
      return false;
    }

    default:
      return false;
  }
};

export const wouldBeInCheck = (piece: Piece, target: Position, pieces: Piece[], gameMode: GameMode): boolean => {
  const normalizedTarget = {
    x: ((target.x % 8) + 8) % 8,
    y: ((target.y % 8) + 8) % 8
  };
  
  const simulatedPieces = pieces.filter(p => 
    !(p.position.x === normalizedTarget.x && p.position.y === normalizedTarget.y)
  ).map(p => 
    p === piece ? { ...p, position: normalizedTarget } : p
  );
  
  return isInCheck(piece.color, simulatedPieces, gameMode);
};

export const isInCheck = (color: PieceColor, pieces: Piece[], gameMode: GameMode): boolean => {
  const king = pieces.find(p => p.type === 'king' && p.color === color);
  if (!king) return false;

  return pieces.some(piece => 
    piece.color !== color && 
    isValidMove(piece, king.position, pieces, gameMode, true)
  );
};

export const hasLegalMoves = (color: PieceColor, pieces: Piece[], gameMode: GameMode): boolean => {
  return pieces
    .filter(piece => piece.color === color)
    .some(piece => getValidMoves(piece, pieces, gameMode).length > 0);
};

// Find castling move if it exists
export const findCastlingMove = (king: Piece, target: Position, pieces: Piece[], gameMode: GameMode): CastlingMove | null => {
  if (king.type !== 'king') return null;
  
  const castlingMoves = getCastlingMoves(king, pieces, gameMode);
  return castlingMoves.find(move => 
    move.kingTarget.x === target.x && move.kingTarget.y === target.y
  ) || null;
};