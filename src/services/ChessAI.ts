import { Piece, PieceColor, Position } from '../types/chess';

export class ChessAI {
  private stockfish: Worker | null = null;
  private difficulty: number = 10;
  private movetime: number = 1000;
  private isReady: boolean = false;
  private isSearching: boolean = false;
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
    // Stockfish Skill Level: 0 (le plus faible) à 20 (le plus fort)
    const skillLevel = Math.round(((level - 1) / 19) * 20);
    // Temps de réflexion: 100ms (niveau 1) à 3000ms (niveau 20)
    this.movetime = Math.round(((level - 1) / 19) * 2900) + 100;
    if (this.stockfish) {
      this.stockfish.postMessage(`setoption name Skill Level value ${skillLevel}`);
    }
  }

  public async getNextMove(pieces: Piece[]): Promise<{ from: Position; to: Position }> {
    if (!this.stockfish || !this.isReady) {
      throw new Error("L'IA n'est pas encore initialisée");
    }

    const fen = this.piecesToFENForColor(pieces, 'black');
    this.isSearching = true;

    this.stockfish.postMessage(`position fen ${fen}`);
    this.stockfish.postMessage(`go movetime ${this.movetime}`);

    return new Promise((resolve) => {
      this.moveResolver = (move) => {
        this.isSearching = false;
        resolve(move);
      };
    });
  }

  public async getHintMove(pieces: Piece[], color: PieceColor): Promise<{ from: Position; to: Position }> {
    if (!this.stockfish || !this.isReady || this.isSearching) {
      throw new Error("L'IA n'est pas disponible");
    }
    this.isSearching = true;

    // Niveau max pour le meilleur coup possible
    this.stockfish.postMessage('setoption name Skill Level value 20');
    const fen = this.piecesToFENForColor(pieces, color);
    this.stockfish.postMessage(`position fen ${fen}`);
    this.stockfish.postMessage('go movetime 1500');

    return new Promise((resolve, reject) => {
      this.moveResolver = (move) => {
        this.isSearching = false;
        // Restaurer le niveau configuré
        const skillLevel = Math.round(((this.difficulty - 1) / 19) * 20);
        this.stockfish?.postMessage(`setoption name Skill Level value ${skillLevel}`);
        resolve(move);
      };
      setTimeout(() => {
        if (this.moveResolver) {
          this.moveResolver = null;
          this.isSearching = false;
          reject(new Error('Hint timeout'));
        }
      }, 5000);
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

  private piecesToFENForColor(pieces: Piece[], color: PieceColor): string {
    let fen = '';
    let emptyCount = 0;

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

    fen += color === 'white' ? ' w KQkq - 0 1' : ' b KQkq - 0 1';
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

  public restart() {
    this.destroy();
    this.isReady = false;
    this.isSearching = false;
    this.moveResolver = null;
    this.initializeStockfish();
    this.setDifficulty(this.difficulty);
  }

  public destroy() {
    if (this.stockfish) {
      this.stockfish.terminate();
      this.stockfish = null;
    }
  }
} 