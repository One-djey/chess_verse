# Coliseum — Spécification technique de génération de plateau

> Document de référence pour l'implémentation du mode **Coliseum** dans ChessVerse.
> Un agent de codage doit pouvoir réimplémenter la solution complète à partir de ce document seul.

---

## 1. Concept du mode

Coliseum est un mode multijoueur (2 à 4 joueurs) dans lequel chaque partie se déroule sur un **plateau organique généré procéduralement**. Le plateau est différent à chaque partie. Les joueurs ne choisissent pas la carte : elle est générée automatiquement selon le **preset de mode** configuré par le créateur du jeu, adapté au nombre de joueurs connectés.

Chaque joueur part d'un bord opposé de l'arène avec ses 16 pièces standard. Le dernier roi survivant gagne. Quand un joueur est mis en échec et mat, toutes ses pièces disparaissent.

---

## 2. Règles de génération — liste exhaustive

Toutes ces règles doivent être respectées **simultanément**. Si une carte ne satisfait pas l'ensemble des règles après le budget temps imparti, le générateur doit **basculer sur un preset de fallback** plutôt que de proposer une carte dégradée.

### 2.1 Forme du plateau

- Le plateau est une **grille rectangulaire carrée** (N×N cases) dont certaines cases sont "jouables" et d'autres sont des "vides" (trous).
- La forme globale est **organique** : ni parfaitement ronde, ni rectangulaire. Des alcôves, des baies et des renfoncements sont souhaitables.
- Des **trous internes** sont possibles (cases vides à l'intérieur de l'arène), à condition de respecter la règle 2.2.
- **Toutes les cases jouables forment une seule région connexe** (pas d'îles isolées). Vérifié par flood fill après chaque transformation.

### 2.2 Interdiction des corridors d'une case

**Aucune case jouable ne peut être un corridor de largeur 1.**

Règle formelle : une case jouable est valide si et seulement si elle appartient à au moins un **carré 2×2 entièrement jouable** autour d'elle. Sinon elle est supprimée.

Cette règle est appliquée en boucle jusqu'à stabilité (algorithme itératif), puis un nouveau flood fill est effectué pour garder la plus grande région connexe résultante.

Raison : un fou placé dans un corridor d'une case est bloqué dès le début de partie, rendant la position invalide.

### 2.3 Spawns en bord d'arène

- Chaque joueur dispose d'un **spawn point** positionné **sur le bord extérieur** de l'arène (case jouable la plus éloignée du centre dans son secteur angulaire).
- Les spawns sont répartis **équiangulairement** autour du centre (ex : 0° et 180° pour 2 joueurs, 0°/120°/240° pour 3 joueurs, etc.).
- Les spawns doivent être **équidistants du centre** : l'écart maximal entre la distance de chaque spawn et la distance moyenne ne dépasse pas 35%.
- **Tous les spawns doivent être dans la même région connexe** (vérification par flood fill depuis le premier spawn).

### 2.4 Placement des pièces

- Chaque joueur possède exactement **16 pièces** : 1 roi, 1 dame, 2 tours, 2 fous, 2 cavaliers, 8 pions.
- Les pièces sont placées par **BFS depuis le spawn** dans l'ordre : roi, dame, tours, fous, cavaliers, pions.
- Les pièces occupent les cases les plus proches du spawn disponibles, sans chevauchement entre joueurs.
- Les pièces de chaque joueur doivent **toucher le bord de l'arène** : le spawn est forcément en bord, et le BFS remonte vers l'intérieur, donc c'est garanti par construction.

### 2.5 Séparation des camps

- La **distance minimale entre les pièces de deux camps différents** est de **4 cases** (distance euclidienne entre la pièce la plus proche d'un camp A et la pièce la plus proche d'un camp B).
- Cette contrainte est vérifiée entre chaque paire de joueurs.

### 2.6 Taille du plateau et densité

| Joueurs | Taille par défaut | Min | Max |
|---------|-------------------|-----|-----|
| 2       | 20×20             | 16  | 30  |
| 3       | 22×22             | 16  | 30  |
| 4       | 24×24             | 16  | 30  |

L'app peut ajuster la taille dans les limites 16–30 (par pas de 2). La taille par défaut est appliquée automatiquement au changement de nombre de joueurs.

**Densité cible** (cases jouables libres = totalCells - N×16) :

| Joueurs | Min cases libres | Max cases libres |
|---------|-----------------|-----------------|
| 2       | 60              | 200             |
| 3       | 80              | 240             |
| 4       | 100             | 280             |

Une arène avec moins de cases libres que le minimum est trop serrée (placement impossible ou parties trop courtes). Au-delà du maximum, les parties risquent d'être trop longues.

---

## 3. Pipeline de génération

```
Seed aléatoire
    │
    ▼
Fractal Noise principal (4 octaves, persistence 0.55)
    │  Masque elliptique doux (évite les cases aux coins)
    ▼
Seuillage → grille binaire brute
    │
    ▼
Cellular Automata (N itérations) → lissage forme principale
    │
    ▼
Fractal Noise secondaire (3 octaves) → seuillage → trous internes
    │
    ▼
Cellular Automata (2 itérations fixes) → adoucit les bords des trous
    │
    ▼
removeCorridors() → supprime cases hors carré 2×2 (boucle jusqu'à stabilité)
    │
    ▼
keepLargestRegion() → flood fill, garde la plus grande région connexe
    │
    ▼
Validation : totalCells, freeCells, spawns valides, allConnected, équidistance
    │
    ▼
Placement pièces BFS par joueur
    │
    ▼
Validation : 16 pièces/joueur, distance min entre camps
    │
    ▼
✓ Carte valide → retournée
```

### Budget temps

- **Phase 1 (toutes contraintes)** : jusqu'à 850ms de `performance.now()`
- **Phase 2 (fallback, relâche distance inter-camps)** : les 150ms restantes
- **Si aucune carte valide** : basculement sur preset de fallback (voir section 5)

Les calculs sont rapides (~0.2–2ms par tentative selon la taille). En pratique on obtient une carte valide en 5–80 tentatives sur les presets recommandés.

---

## 4. Paramètres de génération

| Paramètre | Rôle | Plage recommandée |
|-----------|------|-------------------|
| `noiseScale` | Taille des "blobs" de la forme. Petit = contours nerveux/découpés. Grand = masses lisses. | 4–13 |
| `noiseThreshold` | Quantité de plateau. Monter = arène plus petite. Descendre (négatif possible) = arène plus ouverte. | -0.15 à 0.25 |
| `holeScale` | Taille des trous internes. Petit = grains fins. Grand = cavernes/alcôves larges. | 1.5–7 |
| `holeThreshold` | Fréquence des trous. Bas = gruyère dense. Haut = peu ou pas de trous. | 0.25–0.85 |
| `caIterations` | Passes de lissage CA. Plus = formes très organiques. Moins = bords anguleux. | 1–7 |
| `caDeathLimit` | CA technique. Monter = efface zones isolées plus agressivement. | 3–5 |
| `caBirthLimit` | CA technique. Monter = remplit les creux plus facilement. | 4–6 |

---

## 5. Presets retenus et configuration finale

Trois presets sont retenus pour ChessVerse. La carte est générée aléatoirement à chaque partie selon le preset choisi, adapté au nombre de joueurs.

### 5.1 Labyrinthe 🌿

**Ambiance** : couloirs, passages sinueux, alcôves. Favorise pions et cavaliers. Handicape tours et fous sur la diagonale.

**Config de base (2 joueurs, 20×20)** :

```json
{
  "noiseScale": 4.5,
  "noiseThreshold": 0.08,
  "holeScale": 2.5,
  "holeThreshold": 0.48,
  "caIterations": 5,
  "caDeathLimit": 4,
  "caBirthLimit": 5
}
```

### 5.2 Citadelle 🏰

**Ambiance** : arène compacte, bords dentelés, contact rapide entre les camps. Parties courtes et intenses.

**Config de base (2 joueurs, 20×20)** :

```json
{
  "noiseScale": 5.0,
  "noiseThreshold": 0.10,
  "holeScale": 2.5,
  "holeThreshold": 0.60,
  "caIterations": 4,
  "caDeathLimit": 4,
  "caBirthLimit": 5
}
```

### 5.3 Chaos 💀

**Ambiance** : forme fracturée et imprévisible. Plateau gruyère, espaces réduits. Mode expérimental violent.

**Config de base (2 joueurs, 20×20)** :

```json
{
  "noiseScale": 5.0,
  "noiseThreshold": 0.12,
  "holeScale": 2.0,
  "holeThreshold": 0.38,
  "caIterations": 4,
  "caDeathLimit": 3,
  "caBirthLimit": 6
}
```

### 5.4 Scaling automatique par nombre de joueurs

Pour chaque preset, les paramètres suivants sont ajustés en fonction du nombre de joueurs (`extra = numPlayers - 2`) :

```js
width  = SIZE_BY_PLAYERS[numPlayers]           // { 2:20, 3:22, 4:24 }
height = SIZE_BY_PLAYERS[numPlayers]
noiseThreshold = base.noiseThreshold - extra * 0.04
holeThreshold  = min(0.85, base.holeThreshold + extra * 0.07)
holeScale      = min(7, base.holeScale + extra * 0.5)
caIterations   = max(1, base.caIterations - (extra > 1 ? 1 : 0))
```

---

## 6. Stratégie de fallback en production

**Règle absolue : ne jamais servir une carte dont les contraintes n'ont pas toutes été respectées.**

Si le générateur atteint son budget temps sans trouver de carte valide (phase 1 + phase 2) :

1. **Changer de preset** : essayer les deux autres presets dans l'ordre suivant : Citadelle → Labyrinthe → Chaos (ordre de fiabilité décroissant sur les paramètres serrés).
2. **Augmenter la taille de 2 cases** (ex : 20→22) et relancer sur le preset original.
3. En dernier recours uniquement, utiliser le preset **Classique équilibré** (config minimale garantie) :

```json
{
  "noiseScale": 7.0,
  "noiseThreshold": 0.05,
  "holeScale": 3.5,
  "holeThreshold": 0.62,
  "caIterations": 3,
  "caDeathLimit": 4,
  "caBirthLimit": 5
}
```

**Ne jamais** afficher une carte issue du fallback relâché (distance inter-camps non respectée) comme carte finale d'une vraie partie.

---

## 7. Implémentation de référence — fonctions clés

### seededRandom(seed)
RNG déterministe LCG. Même seed → même séquence. Chaque tentative utilise `seed + attempt * 6271` pour garantir la diversité tout en restant reproductible.

### fractalNoise(W, H, baseScale, octaves, persistence, rng)
Bruit de valeur multi-octave. `octaves=4, persistence=0.55` pour le bruit principal. `octaves=3, persistence=0.5` pour le bruit de trous. Plage de sortie ≈ [-1, 1].

### cellularSmooth(grid, iterations, birthLimit, deathLimit)
Pour chaque case, compte ses 8 voisins (les cases hors grille comptent comme pleines). Si la case est pleine et a moins de `deathLimit` voisins pleins, elle devient vide. Si vide et a plus de `birthLimit` voisins pleins, elle devient pleine.

### removeCorridors(grid)
Boucle itérative. À chaque passe : une case pleine est conservée uniquement si elle appartient à au moins un carré 2×2 entièrement plein (on teste les 4 carrés dont la case peut être un coin). Répète jusqu'à stabilité (aucun changement dans une passe).

### keepLargestRegion(grid)
Flood fill 4-connexe sur toutes les cases pleines. Garde uniquement la région la plus grande. Supprime les îles résiduelles.

### findEdgeSpawn(grid, angle, sectorWidth)
Pour un angle cible donné, parcourt toutes les cases jouables dans le secteur angulaire `[angle - sectorWidth, angle + sectorWidth]`. Score = `distanceFromCenter - écartAngulaire * 3`. Retourne la case avec le meilleur score (la plus éloignée du centre dans le bon secteur).

### placePieces(grid, spawnY, spawnX, playerIdx, occupied)
BFS depuis le spawn. Collecte les cases jouables non occupées dans l'ordre de proximité (BFS 8-connexe). Place les 16 pièces dans l'ordre : roi, dame, tour×2, fou×2, cavalier×2, pion×8.

### removeCorridors — note d'implémentation

```js
function removeCorridors(grid) {
  const H = grid.length, W = grid[0].length;
  let changed = true;
  let g = grid.map(r => [...r]);
  while (changed) {
    changed = false;
    const next = g.map(r => [...r]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (g[y][x] !== 1) continue;
        let inSquare = false;
        // Teste les 4 origines de carré 2×2 dont (y,x) fait partie
        for (const [dy, dx] of [[0,0],[0,-1],[-1,0],[-1,-1]]) {
          const y0 = y+dy, x0 = x+dx;
          if (y0<0||y0+1>=H||x0<0||x0+1>=W) continue;
          if (g[y0][x0]&&g[y0][x0+1]&&g[y0+1][x0]&&g[y0+1][x0+1]) {
            inSquare = true; break;
          }
        }
        if (!inSquare) { next[y][x] = 0; changed = true; }
      }
    }
    g = next;
  }
  return g;
}
```

---

## 8. Structure de données de la carte générée

```ts
interface Arena {
  grid:       number[][];    // 0 = vide, 1 = jouable
  spawnZones: [number, number][]; // [y, x] par joueur
  pieces:     Piece[];
  totalCells: number;        // cases jouables totales
  freeCells:  number;        // totalCells - N*16
  attempts:   number;        // nb tentatives utilisées
  elapsed:    number;        // ms écoulées
  fallback:   boolean;       // true = contraintes relâchées (ne pas utiliser en prod)
  seed:       number;
}

interface Piece {
  y:      number;
  x:      number;
  piece:  "king"|"queen"|"rook"|"bishop"|"knight"|"pawn";
  player: number;  // 0-indexed
}
```

---

## 9. Checklist d'implémentation

- [ ] RNG déterministe avec seed par tentative
- [ ] Fractal noise principal (4 octaves) + masque elliptique
- [ ] Fractal noise secondaire pour trous internes
- [ ] Cellular Automata ×2 (forme puis adoucissement trous)
- [ ] `removeCorridors()` en boucle jusqu'à stabilité
- [ ] `keepLargestRegion()` flood fill 4-connexe
- [ ] Validation cases libres dans plage [min, max]
- [ ] Spawns en bord (score = distance depuis centre)
- [ ] `allConnected()` : tous les spawns dans la même région
- [ ] Équidistance spawns (écart max 35% de la moyenne)
- [ ] Placement BFS 16 pièces par joueur
- [ ] Distance minimale 4 cases entre camps (phase 1)
- [ ] Budget temps `performance.now()` au lieu d'un MAX_ATTEMPTS fixe
- [ ] Fallback inter-presets si budget épuisé (jamais de carte dégradée en prod)
- [ ] Scaling automatique taille + params au changement de nb joueurs
