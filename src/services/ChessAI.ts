import { Piece, Position } from '../types/chess';

export class ChessAI {
  private stockfish: Worker | null = null;
  private difficulty: number = 10;
  private isReady: boolean = false;
  private moveResolver: ((move: { from: Position; to: Position }) => void) | null = null;

  constructor() {
    this.initializeStockfish();
  }

  private initializeStockfish() {
    try {
      // Créer un Worker directement à partir du fichier stockfish.js
      this.stockfish = new Worker('/stockfish/stockfish.js');
      
      this.stockfish.onmessage = (event) => {
        const message = event.data;
        
        if (message === 'uciok') {
          this.isReady = true;
          this.stockfish?.postMessage('isready');
        }
        
        if (typeof message === 'string' && message.includes('bestmove')) {
          const [, move] = message.split('bestmove ');
          const [from, to] = move.split(' ')[0].match(/.{2}/g) || [];
          
          if (this.moveResolver && from && to) {
            this.moveResolver({
              from: this.algebraicToPosition(from),
              to: this.algebraicToPosition(to)
            });
            this.moveResolver = null;
          }
        }
      };
      
      this.stockfish.onerror = (e) => {
        console.error('Erreur Stockfish:', e);
        this.isReady = false;
      };
      
      // Initialiser le moteur
      this.stockfish.postMessage('uci');
      this.setDifficulty(this.difficulty);
      
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de Stockfish:', error);
      this.isReady = false;
    }
  }

  public setDifficulty(level: number) {
    this.difficulty = level;
    if (this.stockfish) {
      // Convertir le niveau (1-20) en profondeur de recherche (1-15)
      const depth = Math.floor((level / 20) * 15) + 1;
      this.stockfish.postMessage(`setoption name Skill Level value ${level}`);
      this.stockfish.postMessage(`setoption name Maximum Thinking Time value ${depth * 1000}`);
    }
  }

  public async getNextMove(pieces: Piece[]): Promise<{ from: Position; to: Position }> {
    if (!this.stockfish || !this.isReady) {
      throw new Error("L'IA n'est pas encore initialisée");
    }

    const fen = this.piecesToFEN(pieces);
    
    this.stockfish.postMessage(`position fen ${fen}`);
    this.stockfish.postMessage('go movetime 1000');

    return new Promise((resolve) => {
      this.moveResolver = resolve;
    });
  }

  private algebraicToPosition(algebraic: string): Position {
    // Dans la notation algébrique des échecs :
    // Les colonnes vont de 'a' à 'h' (de gauche à droite)
    // Les rangs vont de '8' à '1' (de haut en bas)
    const file = algebraic.charCodeAt(0) - 97; // 'a' -> 0, 'h' -> 7
    const rank = 8 - parseInt(algebraic[1]); // '8' -> 0, '1' -> 7
    return { x: file, y: rank };
  }

  private positionToAlgebraic(pos: Position): string {
    const file = String.fromCharCode(pos.x + 97);
    const rank = 8 - pos.y;
    return `${file}${rank}`;
  }

  private piecesToFEN(pieces: Piece[]): string {
    let fen = '';
    let emptyCount = 0;

    // Construire la position des pièces
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const piece = pieces.find(p => p.position.x === x && p.position.y === y);
        
        if (piece) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += this.pieceToFENChar(piece);
        } else {
          emptyCount++;
        }
      }
      
      if (emptyCount > 0) {
        fen += emptyCount;
        emptyCount = 0;
      }
      
      if (y < 7) fen += '/';
    }

    // Toujours indiquer que c'est le tour des noirs quand on demande à l'IA de jouer
    fen += ' b KQkq - 0 1';
    return fen;
  }

  private pieceToFENChar(piece: Piece): string {
    const chars: Record<string, string> = {
      pawn: 'p',
      rook: 'r',
      knight: 'n',
      bishop: 'b',
      queen: 'q',
      king: 'k'
    };
    
    const char = chars[piece.type];
    return piece.color === 'white' ? char.toUpperCase() : char;
  }

  public destroy() {
    if (this.stockfish) {
      this.stockfish.terminate();
      this.stockfish = null;
    }
  }
} 