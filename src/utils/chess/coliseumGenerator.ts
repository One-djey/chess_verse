import type { ArenaPiece, ArenaPieceType, Arena } from "../../types/coliseum";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE_BY_PLAYERS: Record<number, number> = { 2: 20, 3: 22, 4: 24 };
const FREE_CELLS_RANGE: Record<number, [number, number]> = {
  2: [60, 200],
  3: [80, 240],
  4: [100, 280],
};

type PresetName = "labyrinth" | "citadel" | "chaos" | "classic";

interface PresetConfig {
  noiseScale: number;
  noiseThreshold: number;
  holeScale: number;
  holeThreshold: number;
  caIterations: number;
  caDeathLimit: number;
  caBirthLimit: number;
}

const PRESETS: Record<PresetName, PresetConfig> = {
  labyrinth: {
    noiseScale: 4.5,
    noiseThreshold: 0.08,
    holeScale: 2.5,
    holeThreshold: 0.48,
    caIterations: 5,
    caDeathLimit: 4,
    caBirthLimit: 5,
  },
  citadel: {
    noiseScale: 5.0,
    noiseThreshold: 0.1,
    holeScale: 2.5,
    holeThreshold: 0.6,
    caIterations: 4,
    caDeathLimit: 4,
    caBirthLimit: 5,
  },
  chaos: {
    noiseScale: 5.0,
    noiseThreshold: 0.12,
    holeScale: 2.0,
    holeThreshold: 0.38,
    caIterations: 4,
    caDeathLimit: 3,
    caBirthLimit: 6,
  },
  classic: {
    noiseScale: 7.0,
    noiseThreshold: 0.05,
    holeScale: 3.5,
    holeThreshold: 0.62,
    caIterations: 3,
    caDeathLimit: 4,
    caBirthLimit: 5,
  },
};

const PIECE_ORDER: ArenaPieceType[] = [
  "king",
  "queen",
  "rook",
  "rook",
  "bishop",
  "bishop",
  "knight",
  "knight",
  "pawn",
  "pawn",
  "pawn",
  "pawn",
  "pawn",
  "pawn",
  "pawn",
  "pawn",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scaleParams(base: PresetConfig, numPlayers: number): PresetConfig {
  const extra = numPlayers - 2;
  return {
    ...base,
    noiseThreshold: base.noiseThreshold - extra * 0.04,
    holeThreshold: Math.min(0.85, base.holeThreshold + extra * 0.07),
    holeScale: Math.min(7, base.holeScale + extra * 0.5),
    caIterations: Math.max(1, base.caIterations - (extra > 1 ? 1 : 0)),
  };
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Value noise multi-octave avec interpolation bilinéaire.
 * Plage sortie ≈ [-1, 1].
 */
function fractalNoise(
  W: number,
  H: number,
  baseScale: number,
  octaves: number,
  persistence: number,
  rng: () => number,
): number[][] {
  const result: number[][] = Array.from({ length: H }, () =>
    new Array(W).fill(0),
  );
  let amplitude = 1;
  let frequency = 1 / baseScale;
  let totalAmplitude = 0;

  for (let oct = 0; oct < octaves; oct++) {
    // Grid dimensions for this octave
    const gW = Math.ceil(W * frequency) + 2;
    const gH = Math.ceil(H * frequency) + 2;

    // Build random grid
    const grid: number[][] = Array.from({ length: gH }, () =>
      Array.from({ length: gW }, () => rng() * 2 - 1),
    );

    // Bilinear interpolation for each output cell
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const gx = x * frequency;
        const gy = y * frequency;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        const tx = gx - x0;
        const ty = gy - y0;

        const ix0 = Math.min(x0, gW - 1);
        const ix1 = Math.min(x1, gW - 1);
        const iy0 = Math.min(y0, gH - 1);
        const iy1 = Math.min(y1, gH - 1);

        const v00 = grid[iy0][ix0];
        const v10 = grid[iy0][ix1];
        const v01 = grid[iy1][ix0];
        const v11 = grid[iy1][ix1];

        const top = v00 + (v10 - v00) * tx;
        const bottom = v01 + (v11 - v01) * tx;
        const value = top + (bottom - top) * ty;

        result[y][x] += value * amplitude;
      }
    }

    totalAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  // Normalize
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      result[y][x] /= totalAmplitude;
    }
  }

  return result;
}

function cellularSmooth(
  grid: number[][],
  iterations: number,
  birthLimit: number,
  deathLimit: number,
): number[][] {
  const H = grid.length;
  const W = grid[0].length;
  let g = grid.map((r) => [...r]);

  for (let iter = 0; iter < iterations; iter++) {
    const next = g.map((r) => [...r]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            const ny = y + dy;
            const nx = x + dx;
            // Out-of-bounds cells count as full
            if (ny < 0 || ny >= H || nx < 0 || nx >= W) {
              neighbors++;
            } else if (g[ny][nx] === 1) {
              neighbors++;
            }
          }
        }
        if (g[y][x] === 1) {
          next[y][x] = neighbors < deathLimit ? 0 : 1;
        } else {
          next[y][x] = neighbors > birthLimit ? 1 : 0;
        }
      }
    }
    g = next;
  }

  return g;
}

function removeCorridors(grid: number[][]): number[][] {
  const H = grid.length,
    W = grid[0].length;
  let changed = true;
  let g = grid.map((r) => [...r]);
  while (changed) {
    changed = false;
    const next = g.map((r) => [...r]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (g[y][x] !== 1) continue;
        let inSquare = false;
        for (const [dy, dx] of [
          [0, 0],
          [0, -1],
          [-1, 0],
          [-1, -1],
        ] as [number, number][]) {
          const y0 = y + dy,
            x0 = x + dx;
          if (y0 < 0 || y0 + 1 >= H || x0 < 0 || x0 + 1 >= W) continue;
          if (
            g[y0][x0] &&
            g[y0][x0 + 1] &&
            g[y0 + 1][x0] &&
            g[y0 + 1][x0 + 1]
          ) {
            inSquare = true;
            break;
          }
        }
        if (!inSquare) {
          next[y][x] = 0;
          changed = true;
        }
      }
    }
    g = next;
  }
  return g;
}

function keepLargestRegion(grid: number[][]): number[][] {
  const H = grid.length;
  const W = grid[0].length;
  const visited = Array.from({ length: H }, () => new Array(W).fill(false));

  let bestRegion: [number, number][] = [];

  for (let sy = 0; sy < H; sy++) {
    for (let sx = 0; sx < W; sx++) {
      if (grid[sy][sx] !== 1 || visited[sy][sx]) continue;

      // BFS flood fill
      const region: [number, number][] = [];
      const queue: [number, number][] = [[sy, sx]];
      visited[sy][sx] = true;

      while (queue.length > 0) {
        const [y, x] = queue.shift()!;
        region.push([y, x]);
        for (const [dy, dx] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ] as [number, number][]) {
          const ny = y + dy;
          const nx = x + dx;
          if (
            ny >= 0 &&
            ny < H &&
            nx >= 0 &&
            nx < W &&
            !visited[ny][nx] &&
            grid[ny][nx] === 1
          ) {
            visited[ny][nx] = true;
            queue.push([ny, nx]);
          }
        }
      }

      if (region.length > bestRegion.length) {
        bestRegion = region;
      }
    }
  }

  const result: number[][] = Array.from({ length: H }, () =>
    new Array(W).fill(0),
  );
  for (const [y, x] of bestRegion) {
    result[y][x] = 1;
  }
  return result;
}

function findEdgeSpawn(
  grid: number[][],
  angle: number,
  sectorWidth: number,
): [number, number] | null {
  const H = grid.length;
  const W = grid[0].length;
  const cy = (H - 1) / 2;
  const cx = (W - 1) / 2;

  let bestScore = -Infinity;
  let bestPos: [number, number] | null = null;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== 1) continue;

      const dy = y - cy;
      const dx = x - cx;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cellAngle = Math.atan2(dy, dx);

      // Angular difference (normalized to [-π, π])
      let diff = cellAngle - angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      const absDiff = Math.abs(diff);

      if (absDiff > sectorWidth) continue;

      const score = dist - absDiff * 3;
      if (score > bestScore) {
        bestScore = score;
        bestPos = [y, x];
      }
    }
  }

  return bestPos;
}

function placePieces(
  grid: number[][],
  spawnY: number,
  spawnX: number,
  playerIdx: number,
  occupied: Set<string>,
): ArenaPiece[] {
  const H = grid.length;
  const W = grid[0].length;
  const visited = new Set<string>();
  const queue: [number, number][] = [[spawnY, spawnX]];
  const key = (y: number, x: number) => `${y},${x}`;
  visited.add(key(spawnY, spawnX));

  const available: [number, number][] = [];

  while (queue.length > 0 && available.length < PIECE_ORDER.length) {
    const [y, x] = queue.shift()!;
    const k = key(y, x);
    if (!occupied.has(k) && grid[y][x] === 1) {
      available.push([y, x]);
    }

    // 8-connected neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dy === 0 && dx === 0) continue;
        const ny = y + dy;
        const nx = x + dx;
        const nk = key(ny, nx);
        if (
          ny >= 0 &&
          ny < H &&
          nx >= 0 &&
          nx < W &&
          !visited.has(nk) &&
          grid[ny][nx] === 1
        ) {
          visited.add(nk);
          queue.push([ny, nx]);
        }
      }
    }
  }

  if (available.length < PIECE_ORDER.length) return [];

  const pieces: ArenaPiece[] = [];
  for (let i = 0; i < PIECE_ORDER.length; i++) {
    const [y, x] = available[i];
    const k = key(y, x);
    occupied.add(k);
    pieces.push({ y, x, piece: PIECE_ORDER[i], player: playerIdx });
  }
  return pieces;
}

function tryGenerate(
  seed: number,
  W: number,
  H: number,
  presetName: PresetName,
  numPlayers: number,
  relaxDistance: boolean,
): Arena | null {
  const rng = seededRandom(seed);
  const cfg = scaleParams(PRESETS[presetName], numPlayers);

  // 1. Primary fractal noise
  const noisePrimary = fractalNoise(W, H, cfg.noiseScale, 4, 0.55, rng);

  // 2. Elliptic mask
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const mask = 1 - Math.max(0, Math.min(1, dist * 1.2 - 0.2));
      noisePrimary[y][x] *= mask;
    }
  }

  // 3. Threshold
  let grid: number[][] = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (__, x) =>
      noisePrimary[y][x] > cfg.noiseThreshold ? 1 : 0,
    ),
  );

  // 4. Cellular automata pass 1
  grid = cellularSmooth(
    grid,
    cfg.caIterations,
    cfg.caBirthLimit,
    cfg.caDeathLimit,
  );

  // 5. Secondary noise for holes
  const noiseHoles = fractalNoise(W, H, cfg.holeScale, 3, 0.5, rng);

  // 6. Apply holes
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] === 1 && noiseHoles[y][x] > cfg.holeThreshold) {
        grid[y][x] = 0;
      }
    }
  }

  // 7. Cellular automata pass 2 (smooth hole edges)
  grid = cellularSmooth(grid, 2, 5, 4);

  // 8. Remove corridors
  grid = removeCorridors(grid);

  // 9. Keep largest region
  grid = keepLargestRegion(grid);

  // 10. Count cells and validate range
  let totalCells = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] === 1) totalCells++;
    }
  }
  const [minCells, maxCells] = FREE_CELLS_RANGE[numPlayers];
  const minTotal = minCells + numPlayers * 16;
  const maxTotal = maxCells + numPlayers * 16;
  if (totalCells < minTotal || totalCells > maxTotal) return null;

  // 11. Find spawn zones
  // For 2 players: force top/bottom (−π/2 and +π/2) so camps mirror standard chess orientation
  const sectorWidth = Math.PI / numPlayers;
  const spawnZones: [number, number][] = [];
  for (let i = 0; i < numPlayers; i++) {
    const angle =
      numPlayers === 2
        ? i === 0
          ? -Math.PI / 2
          : Math.PI / 2
        : (2 * Math.PI * i) / numPlayers;
    const spawn = findEdgeSpawn(grid, angle, sectorWidth);
    if (!spawn) return null;
    spawnZones.push(spawn);
  }

  // 12. Verify all spawns are in the same connected region
  const key = (y: number, x: number) => `${y},${x}`;
  const reachable = new Set<string>();
  const bfsQueue: [number, number][] = [spawnZones[0]];
  reachable.add(key(spawnZones[0][0], spawnZones[0][1]));
  while (bfsQueue.length > 0) {
    const [y, x] = bfsQueue.shift()!;
    for (const [dy, dx] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as [number, number][]) {
      const ny = y + dy;
      const nx = x + dx;
      const nk = key(ny, nx);
      if (
        ny >= 0 &&
        ny < H &&
        nx >= 0 &&
        nx < W &&
        !reachable.has(nk) &&
        grid[ny][nx] === 1
      ) {
        reachable.add(nk);
        bfsQueue.push([ny, nx]);
      }
    }
  }
  for (let i = 1; i < numPlayers; i++) {
    if (!reachable.has(key(spawnZones[i][0], spawnZones[i][1]))) return null;
  }

  // 13. Verify equidistance (spawns equidistant from center)
  const centerY = (H - 1) / 2;
  const centerX = (W - 1) / 2;
  const distances = spawnZones.map(([sy, sx]) => {
    const dy = sy - centerY;
    const dx = sx - centerX;
    return Math.sqrt(dy * dy + dx * dx);
  });
  const avgDist = distances.reduce((s, d) => s + d, 0) / distances.length;
  const maxDeviation = Math.max(...distances.map((d) => Math.abs(d - avgDist)));
  if (avgDist > 0 && maxDeviation / avgDist > 0.35) return null;

  // 14. Place pieces for each player
  const occupied = new Set<string>();
  const allPieces: ArenaPiece[] = [];
  for (let i = 0; i < numPlayers; i++) {
    const pieces = placePieces(
      grid,
      spawnZones[i][0],
      spawnZones[i][1],
      i,
      occupied,
    );
    if (pieces.length !== 16) return null;
    allPieces.push(...pieces);
  }

  // 15. Verify minimum distance between player 0 and player 1 pieces
  if (!relaxDistance) {
    const p0pieces = allPieces.filter((p) => p.player === 0);
    const p1pieces = allPieces.filter((p) => p.player === 1);
    let minDist = Infinity;
    for (const a of p0pieces) {
      for (const b of p1pieces) {
        const dy = a.y - b.y;
        const dx = a.x - b.x;
        const dist = Math.sqrt(dy * dy + dx * dx);
        if (dist < minDist) minDist = dist;
      }
    }
    if (minDist < 4) return null;
  }

  // 16. Compute free cells
  const freeCells = totalCells - numPlayers * 16;
  const [minFree, maxFree] = FREE_CELLS_RANGE[numPlayers];
  if (freeCells < minFree || freeCells > maxFree) return null;

  return {
    grid,
    spawnZones,
    pieces: allPieces,
    totalCells,
    freeCells,
    attempts: 0, // filled by caller
    elapsed: 0, // filled by caller
    fallback: false,
    seed,
  };
}

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

function trimArena(arena: Arena): Arena {
  const H = arena.grid.length;
  const W = arena.grid[0].length;

  let minRow = H,
    maxRow = -1,
    minCol = W,
    maxCol = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (arena.grid[y][x] === 1) {
        if (y < minRow) minRow = y;
        if (y > maxRow) maxRow = y;
        if (x < minCol) minCol = x;
        if (x > maxCol) maxCol = x;
      }
    }
  }

  if (maxRow === -1) return arena;

  const trimH = maxRow - minRow + 1;
  const trimW = maxCol - minCol + 1;
  const S = Math.max(trimH, trimW);
  const padTop = Math.floor((S - trimH) / 2);
  const padBottom = S - trimH - padTop;
  const padLeft = Math.floor((S - trimW) / 2);
  const padRight = S - trimW - padLeft;

  const emptyRow = () => new Array(S).fill(0);
  const innerRows = arena.grid
    .slice(minRow, maxRow + 1)
    .map((row) => [
      ...new Array(padLeft).fill(0),
      ...row.slice(minCol, maxCol + 1),
      ...new Array(padRight).fill(0),
    ]);
  const newGrid = [
    ...Array.from({ length: padTop }, emptyRow),
    ...innerRows,
    ...Array.from({ length: padBottom }, emptyRow),
  ];

  const newSpawnZones = arena.spawnZones.map(
    ([y, x]) => [y - minRow + padTop, x - minCol + padLeft] as [number, number],
  );
  const newPieces = arena.pieces.map((p) => ({
    ...p,
    y: p.y - minRow + padTop,
    x: p.x - minCol + padLeft,
  }));

  return {
    ...arena,
    grid: newGrid,
    spawnZones: newSpawnZones,
    pieces: newPieces,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateColiseumArena(numPlayers: 2 = 2, seed?: number): Arena {
  const startTime = performance.now();
  const baseSeed = seed ?? Math.floor(Math.random() * 1e9);

  const strategies: Array<{ preset: PresetName; size: number }> = [
    { preset: "labyrinth", size: SIZE_BY_PLAYERS[numPlayers] },
    { preset: "citadel", size: SIZE_BY_PLAYERS[numPlayers] },
    { preset: "chaos", size: SIZE_BY_PLAYERS[numPlayers] },
    { preset: "labyrinth", size: SIZE_BY_PLAYERS[numPlayers] + 2 },
    { preset: "citadel", size: SIZE_BY_PLAYERS[numPlayers] + 2 },
    { preset: "classic", size: SIZE_BY_PLAYERS[numPlayers] },
    { preset: "classic", size: SIZE_BY_PLAYERS[numPlayers] + 2 },
  ];

  let totalAttempts = 0;
  for (const { preset, size } of strategies) {
    for (let a = 0; a < 500; a++) {
      if (performance.now() - startTime > 950) break;
      totalAttempts++;
      const arena = tryGenerate(
        baseSeed + totalAttempts * 6271,
        size,
        size,
        preset,
        numPlayers,
        false,
      );
      if (arena) {
        return trimArena({
          ...arena,
          attempts: totalAttempts,
          elapsed: performance.now() - startTime,
          seed: baseSeed,
        });
      }
    }
  }

  // Should never reach here with "classic" as final fallback
  throw new Error(
    "Coliseum arena generation failed after exhausting all strategies",
  );
}
