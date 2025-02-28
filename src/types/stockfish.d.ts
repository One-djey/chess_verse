declare module 'stockfish' {
  export interface StockfishInstance {
    postMessage(message: string): void;
    onmessage: (event: { data: string }) => void;
    terminate(): void;
  }

  export default function STOCKFISH(): StockfishInstance;
}

declare module 'stockfish/stockfish.js' {
  export * from 'stockfish';
  export { default } from 'stockfish';
}

declare module 'stockfish/stockfish.wasm.js' {
  export * from 'stockfish';
  export { default } from 'stockfish';
} 