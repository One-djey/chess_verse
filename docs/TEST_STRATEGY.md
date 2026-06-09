# ChessVerse — Stratégie de tests automatisés

> Rapport QA — état des lieux, cartographie de testabilité, catalogue des cas de test et plan d'industrialisation.

## 1. État des lieux & objectifs

### Constat initial

- **Aucun test automatisé** dans le projet (aucun framework, aucun script `test`, aucun fichier `*.test.*`).
- **Aucune CI** (`.github/workflows` absent avant cette initiative).
- Stack : React 18.3 + TypeScript 5.5 (strict) + Vite 5.4 + Tailwind. 100 % client-side : pas de backend, P2P via Trystero (WebRTC), IA via Stockfish en Web Worker.
- Le cœur métier (règles d'échecs, modes spéciaux, fallback IA, statistiques) est majoritairement constitué de **fonctions pures**, donc très bien adapté au test unitaire.

### Objectifs qualité

1. **Verrouiller les règles du jeu** : toute régression sur la validation des coups, la détection d'échec/mat/pat ou les modes spéciaux (borderless, assimilation, all-random, coliseum) doit être détectée avant merge.
2. **Sécuriser les chemins critiques non-UI** : fallback IA (garantie « jamais de coup illégal »), persistance des statistiques (ELO, streaks, badges).
3. **Documenter le comportement actuel**, y compris ses limites volontaires (pas d'en passant, pas de nulle par répétition), pour que tout changement soit un choix conscient.
4. Mettre en place une **pyramide de tests durable** exécutée en CI.

## 2. Pyramide de tests & outillage

```
        ▲  E2E (Playwright) — P3, documenté, non implémenté
       ▲▲  Composants React (Testing Library, jsdom) — P2
      ▲▲▲  Hooks & services à effets (mocks Worker/Trystero/localStorage) — P1
   ▲▲▲▲▲▲  Unitaires purs (règles d'échecs, stats, helpers) — P0 ✅ implémentés
```

### Outillage retenu

| Outil | Rôle | Justification |
| --- | --- | --- |
| **Vitest 3** | Runner unitaire/intégration | Natif Vite 5 (Vitest 4 exige Vite ≥ 6), API Jest-compatible, fake timers, coverage v8 |
| **@testing-library/react** + **user-event** + **jest-dom** | Tests composants/hooks | Standard de facto, teste le comportement, pas l'implémentation |
| **jsdom** | Environnement DOM des tests `.tsx` | Activé par docblock `// @vitest-environment jsdom` (défaut : `node`, plus rapide) |
| **@vitest/coverage-v8** | Couverture | Seuils par fichier sur les modules P0 (voir `vitest.config.ts`) |
| **Playwright** *(roadmap)* | E2E navigateur | Multi-onglets (indispensable pour tester le P2P en conditions réelles) |

### Conventions

- Tests **colocalisés** : `src/utils/chess/moves.ts` → `src/utils/chess/moves.test.ts`.
- Fixtures partagées dans `src/test/helpers.ts` (`makePiece`, `makeState`, modes `CLASSIC`/`BORDERLESS`/`ALL_RANDOM`/`ASSIMILATION`).
- Imports Vitest explicites (pas de `globals: true`).
- Commandes : `npm run test` (one-shot), `npm run test:watch`, `npm run test:coverage`.

## 3. Cartographie de testabilité

### 3.1 Logique pure — testable directement (unitaires)

| Module | Lignes | Impuretés | Priorité |
| --- | --- | --- | --- |
| `src/utils/chess/moves.ts` | ~574 | aucune | **P0 ✅** |
| `src/utils/chess/aiFallback.ts` | ~179 | aucune | **P0 ✅** |
| `src/utils/chess/assimilation.ts` | ~21 | aucune | **P0 ✅** |
| `src/utils/chess/board.ts` | ~107 | `Math.random` (mode all-random) | **P0 ✅** (spy/itérations) |
| `src/utils/pieceImage.ts` | ~15 | aucune | **P0 ✅** |
| `src/utils/chess/constants.ts` | ~16 | aucune | P0 (couvert indirectement) |
| `src/utils/chess/tactics.ts` | ~150 | aucune | **P1** |
| `src/utils/chess/coliseumMoves.ts` | ~208 | aucune | **P1** |
| `src/utils/chess/legendaryPatterns.ts` | ~464 | aucune | **P1** |
| `src/services/statsService.ts` | ~641 | `localStorage`, `new Date()` | **P0 ✅** (stub + fake timers) |

### 3.2 Logique stateful — mocks requis

| Module | Dépendances à mocker | Priorité |
| --- | --- | --- |
| `src/services/ChessAI.ts` (~301 l.) | `Worker` (protocole UCI), `setTimeout` | **P1** |
| `src/hooks/useChessGame.ts` (~143 l.) | `localStorage`, `Date.now`, `ChessAI` | P1 |
| `src/hooks/useP2PGame.ts` (~162 l.) | actions Trystero (callbacks de room) | **P1** |
| `src/context/P2PContext.tsx` (~226 l.) | `trystero.joinRoom`, room lifecycle | P2 |
| `src/context/SkinContext.tsx` (~34 l.) | `localStorage` | P2 |
| `src/i18n/index.ts` (~41 l.) | i18next + détecteur navigateur | P2 (sanity locales) |

### 3.3 Composants React (Testing Library, jsdom)

| Composant | Logique à tester | Priorité |
| --- | --- | --- |
| `GameOver.tsx` | titre victoire/défaite/nulle/abandon, formatage durée, returnPath, états rematch | P2 |
| `FeedbackModal.tsx` | construction du lien `mailto:` (encodage sujet/corps), reset du formulaire | P2 |
| `NavBar.tsx` | rendu breadcrumbs (dernier non cliquable), boutons conditionnels (Surrender, Settings) | P2 |
| `GameSettings.tsx` | onglets, sync `localStorage`, slider visible si IA activée, sélecteur de langue | P2 |
| `ProfilePage.tsx` + `profile/*` | empty state ; heatmap (calculs de dates, dédup mois, paliers de couleur) ; WinRateRing (arcs SVG) ; ELOBadge (paliers) ; BadgesGrid (unlock/progress) ; ModeDistribution (tri, %) | P2 |
| `PromotionPicker.tsx`, `ModeSelect.tsx` | choix de promotion ; détection offline | P2 |
| `Game.tsx` (~1 178 l.) | **non testé en RTL** : couplage fort (5+ hooks, IA, P2P). Couvert via les tests de hooks/utils + E2E. Recommandation : extraire `detectScholarsMate` et `resolveGameMode` vers `src/utils/` pour les tester unitairement | P2/P3 |

### 3.4 E2E (Playwright — roadmap)

Parcours utilisateur réels dans un navigateur, seuls capables de couvrir le drag & drop sur l'échiquier, le Worker Stockfish réel et le WebRTC réel.

## 4. Catalogue détaillé des cas de test

Légende : ✅ = implémenté (P0) · 📋 = spécifié, à implémenter (P1+).
Chaque module liste : **N** = cas nominaux, **E** = erreurs attendues, **X** = edge cases.

### 4.1 `moves.ts` — règles du jeu ✅

**Fonctions de base**
- N : `switchTurn` alterne white/black ; `getPieceAt` trouve/ne trouve pas une pièce ; `normalizePos` identité sur 0–7.
- X : `normalizePos` sur coordonnées négatives et > 7 (formule `((x%8)+8)%8`) ; `getPieceAt` avec coordonnées virtuelles (8, −1) retrouve la pièce wrappée.

**Déplacements par type (`isValidMove`, `getValidMoves`)**
- N : pion avance d'1 ; double pas depuis le rang initial ; capture en diagonale ; cavalier en L (saute par-dessus) ; fou/tour/dame sur leurs lignes ; roi d'1 case.
- E : pion bloqué par pièce devant (simple et double pas, y compris case intermédiaire occupée) ; pion ne capture pas tout droit ; pion ne capture pas en diagonale sur case vide ; double pas hors rang initial ; case d'arrivée occupée par un allié ; surplace ; hors plateau en mode classique ; pièce glissante bloquée par obstacle.
- X : trajectoires aux bords du plateau ; chaque capacité testée séparément des autres.

**Échec et sécurité du roi (`isInCheck`, `wouldBeInCheck`, `isSquareUnderAttack`)**
- N : détection d'échec par chaque type d'attaquant ; coup qui exposerait son roi filtré par `getValidMoves` (clouage).
- E : le roi ne peut pas aller sur une case attaquée.
- X : `isSquareUnderAttack` détecte l'attaque diagonale d'un pion **sur case vide** (critique pour l'assimilation) ; `isInCheck` retourne `false` si le roi est absent du plateau (pas de crash).

**Roque (`getCastlingMoves`, `findCastlingMove`, `applyMoveToState`)**
- N : petit et grand roque proposés (roi e1→g1/c1) ; la tour est déplacée (f1/d1) par `applyMoveToState`.
- E : refusé si roi ou tour `hasMoved` ; pièce entre roi et tour ; roi en échec ; case traversée ou d'arrivée attaquée.
- X : `findCastlingMove` retourne `null` pour une cible non-roque.

**Promotion (`applyMoveToState`)**
- N : pion blanc atteignant y=0 promu **dame par défaut** ; `promotionType` explicite respecté (cavalier…).
- X : `MoveRecord.wasPromotion === true` ; promotion noire à y=7.

**Transitions d'état (`applyMoveToState`)**
- N : capture retire la pièce ; `moveCount` incrémenté pour le joueur ; `currentTurn` bascule ; historique `moves[]` complété (from/to/capturedPiece).
- X : **mat** → `gameOver=true`, `winner` correct ; **pat** → `winner=null`, `drawReason="stalemate"` ; **rois seuls** → `drawReason="only-kings"` ; capture directe du roi → victoire immédiate ; `selectedPiece`/`validMoves` réinitialisés.

**Mode borderless**
- N : tour/dame wrappe horizontalement par le bord.
- E : traversée verticale interdite (blanc ne franchit pas y>7, noir y<0).
- X : détection d'échec à travers le bord (9 positions virtuelles du roi) ; chemin glissant wrappé bloqué par un obstacle situé « de l'autre côté ».

**Mode assimilation**
- N : tour avec `acquiredTypes:["bishop"]` se déplace en diagonale (uniquement en mode assimilation) ; capture → fusion des types via `applyAssimilationCapture`.
- E : les capacités acquises sont ignorées en mode classique.

**Limites verrouillées par test**
- X : **pas d'en passant** — un test assert explicitement que la capture en passant est refusée, pour rendre tout futur changement volontaire.

### 4.2 `assimilation.ts` ✅

- N : `getPieceCapabilities` = `[type]` sans acquis ; type de base + acquis sinon ; `applyAssimilationCapture` ajoute le type de la cible.
- E : capture d'une pièce du même type → pas d'acquis (champ omis, pas de tableau vide).
- X : déduplication (type déjà acquis, type de base présent dans les acquis de la cible) ; **transitivité** (capturer une pièce qui avait elle-même des acquis transmet toute la chaîne) ; le type de base du capteur n'apparaît jamais dans ses `acquiredTypes` ; id/couleur/position préservés.

### 4.3 `aiFallback.ts` — `getSmartFallbackMove` ✅

Invariant central : **ne retourne `null` que si mat ou pat avéré** (le scan des candidats est exhaustif, jamais court-circuité).

**Chaîne « tour normal »** (roi noir pas en échec)
- N : capture sûre > coup sûr > capture risquée > coup risqué.
- X : parmi les captures sûres, valeur capturée max (dame avant pion) ; à valeur égale, pièce qui bouge de valeur min ; positions construites où un seul candidat de chaque catégorie existe, assertion sur le `from/to` exact.

**Chaîne « échec »**
- N : pièce non-roi qui résout l'échec (blocage ou capture de l'attaquant) préférée au coup de roi ; coup de roi si seule issue.
- X : le coup retourné résout réellement l'échec.

**Terminaux**
- E : pat de noir → `null` ; mat de noir → `null`.

**Modes spéciaux**
- X : en borderless, coordonnées retournées normalisées (0–7) et légales sous les règles de wrap ; exhaustivité — la bonne capture portée par la « dernière » pièce scannée est trouvée.

### 4.4 `board.ts` ✅

- N : layout classique — 32 pièces, 16 par couleur, placements FIDE (roi blanc (4,7), dame noire (3,0), pions rangs 6 et 1), ids uniques ; `getDifficultyIndex`/`getDifficultyKey` aux bornes 1, 2, 3, 19, 20.
- X : **all-random** (25 itérations en vrai aléatoire) — rois toujours en x=4, exactement un roi par couleur, 16 pièces/couleur, positions valides et uniques, ids sans collision ; un run déterministe avec `Math.random` mocké produit un setup valide.

### 4.5 `pieceImage.ts` ✅

- N : chemin exact `/ressources/pieces/{skin}/{color}_{type}.{ext}` pour classic (png) et fantasy (webp) ; structure de `SKINS`.

### 4.6 `statsService.ts` ✅

**Robustesse stockage**
- N : `getStats` retourne les valeurs par défaut si storage vide.
- E : JSON corrompu → défauts sans throw ; `localStorage.setItem` qui throw (quota) → pas de crash.
- X : **migration de schéma** — objet stocké partiel (anciennes versions) fusionné avec les défauts, champs existants préservés.

**`recordGame`**
- N : win/loss/draw → compteurs (totalGames, type local/p2p/ai, résultats), durée cumulée, fusion `pieceMoveCount`/`pieceCapturedCount`, `modeGameCount`, heatmap `dailyActivity[aujourd'hui]`.
- X : abandon comptabilisé ; `maxAILevelBeaten = max(...)` **uniquement** sur victoire vs IA (battre 5 puis 3 conserve 5 ; défaite vs 15 ne change rien).

**Streaks** (fake timers)
- N : win streak incrémente sur victoire, reset sur défaite, `maxWinStreak` conservé.
- X : **une nulle ne casse pas la win streak** (comportement verrouillé) ; day streak — même jour (pas d'incrément), lendemain (+1), trou ≥ 2 jours (reset à 1), `maxDayStreak` suit le max.

**Badges & compteurs** (fake timers aux bornes exactes)
- X : nightGames à 22:00 oui / 21:59 non ; morningGames à 07:59 oui / 08:00 non ; unicité `modesPlayed`/`languagesUsed` ; quickWins, promotions, scholarsMates, hintsFollowed ; coliseumGames/Wins ; `recordFeedbackSent`, `recordCoffeeDonation`.
- N : chaque badge de `BADGES` testé **sous** et **au-dessus** de son seuil (`isUnlocked`), `progress()` (current/target) là où défini ; bornes des tiers `ELO_RANKS`.

**Helpers purs**
- N : `getWinRate` (arrondi), `formatDuration`, `getTopPiece`, `getPreferredMode`, `getHeatmapData`.
- E/X : 0 partie → 0 % ; map vide → pas de top piece ; égalités.

### 4.7 `tactics.ts` — `detectTactic` 📋 (P1)

- N : priorité promotion > roque > échec > échec à la découverte > fourchette > clouage > capture > `null` ; chaque tag détecté sur une position minimale.
- X : échec à la découverte (la pièce déplacée n'attaque pas le roi mais une pièce démasquée si) ; fourchette via type **acquis** (assimilation) ; seules les pièces glissantes peuvent clouer ; aucune tactique → `null`.

### 4.8 `coliseumMoves.ts` 📋 (P1)

- N : pion **omnidirectionnel** (4 directions de déplacement, 4 de capture) ; mouvements bornés par la grille d'arène (cases void = 0 infranchissables) ; `applyColiseumMove` retire la pièce capturée.
- E : pas de roque, pas de promotion, pas d'en passant ; coup vers une case void refusé.
- X : `isColiseumInCheck`/`hasNoLegalMoves` sur arènes minimales (mat/pat d'arène) ; arène non rectangulaire.

### 4.9 `legendaryPatterns.ts` — `detectLegendaryPattern` 📋 (P1)

- N : chaque mat en 1 reconnu sur sa position canonique : Scholar's, Smothered, Boden, Arabian/Anastasia, Greco, Lolli, Opera, Back Rank, Hook ; sacrifices (Greek Gift, Fried Liver) ; setups en 2 coups (Scholar's, Legal).
- E : retourne `null` dans les modes non-classiques (borderless/random/assimilation/coliseum).
- X : position quelconque sans pattern → `null` ; priorité entre patterns concurrents (mat en 1 avant setup en 2).

### 4.10 `ChessAI.ts` 📋 (P1 — mock `Worker` + fake timers)

Mocker `globalThis.Worker` par une classe enregistrant `postMessage` et permettant d'émettre des messages UCI.

- N : init UCI (`uci`→`uciok`→`isready`→`readyok` → `ready === true`) ; `getNextMove` envoie `position fen …` + `go movetime …` et résout sur `bestmove e2e4` (conversion coordonnées) ; promotion UCI (`e7e8q`) parsée ; `setDifficulty` mappe 1–20 → skill 0–20 et movetime 100–3000 ms.
- E : `getNextMove` avant `readyok` → throw ; `bestmove (none)` / `0000` → rejet « no legal move » (et non détection de fin de partie) ; timeout 5 s sans réponse → rejet (fake timers).
- X : **race `stopPending`** — le `bestmove` d'une recherche annulée ne résout pas la recherche suivante ; `getHintMove` force skill 20 puis **restaure** la difficulté (y compris si rejet) ; `destroy()` → appels suivants throw ; `restart()` réinitialise l'état ; conversion FEN d'un plateau arbitraire (spot-checks).

### 4.11 `useChessGame.ts` 📋 (P1 — `renderHook`, jsdom)

- N : settings chargés depuis `localStorage` et persistés à chaque changement ; `resetGame`/`handleReplay` reconstruisent l'état ; `aiEnabled` vrai seulement si IA activée **et** pas P2P.
- E : JSON de settings corrompu → défauts silencieux.
- X : pas d'instanciation de `ChessAI` en mode P2P ; `aiRef.destroy()` appelé au démontage ; init du plateau différée tant que `p2pInitialPieces` absent (P2P).

### 4.12 `useP2PGame.ts` 📋 (P1 — mock des actions Trystero)

Mocker `makeRoomActions` : capturer les handlers enregistrés, les invoquer manuellement.

- N (host) : `move_proposal` légal → `move_confirm` + application + `seq` incrémenté ; (guest) : `move_confirm` appliqué, `seqRef` synchronisé.
- E (host) : proposition illégale (pièce inexistante, pas le tour des noirs, coup invalide) → `move_reject`, état inchangé ; (guest) : `move_reject` → rollback optimiste (sélection/validMoves effacées).
- X : gap de séquence → warning sans rejet (résilience au réordonnancement) ; machine à états rematch — `idle→requested` (envoi), `→offered` (réception), accept côté host (nouvelles pièces + `rematch_start` + reset seq) vs guest (`rematch_accept`, `starting`), decline → `idle`, re-demande possible après decline ; `resign` des deux côtés → `surrenderedBy`/winner corrects ; `onPeerLeave` → `peerLeft=true`.

### 4.13 `P2PContext.tsx` 📋 (P2 — mock `trystero`)

- N : host — `startRoom` → role/couleur/état, à `onPeerJoin` broadcast `sync_state` + `color_assign(hostSkin)` ; guest — triple handshake puis envoi `guest_ready(skin)` et navigation.
- X : les 3 messages du handshake (`color_assign`, `sync_state`, `arena_init`) reçus **dans n'importe quel ordre** → navigation seulement quand les 3 sont là ; mode coliseum : arène générée au `onPeerJoin` ; `leaveRoom` réinitialise tout ; déconnexion → `connectionState="disconnected"` sans perte de l'état de jeu.

### 4.14 `SkinContext` / `i18n` 📋 (P2)

- N : skin lu/persisté (`chessverse_skin`), défaut `classic` ; les 8 locales enregistrées, fallback `en`.
- X : valeur de skin inconnue en storage (comportement actuel : acceptée — voir §6) ; **test de parité des locales** : toutes les clés de `en.json` présentes dans les 7 autres fichiers (test peu coûteux à forte valeur).

### 4.15 Composants (RTL) 📋 (P2)

- `GameOver` : titre selon (nulle | abandon | victoire/défaite IA | victoire P2P selon `playerColor`) ; durée `mm:ss` ; clic « Main Menu » → navigation `returnPath` ; états rematch (boutons désactivés si `peerLeft`).
- `FeedbackModal` : choix de catégorie + texte → `mailto:` correctement encodé ; reset après envoi ; fermeture.
- `NavBar` : breadcrumbs (dernier élément non cliquable) ; bouton Surrender présent ssi `onSurrender` fourni ; ouverture Settings.
- `GameSettings` : modal langue seule sans `gameSettings` ; slider de difficulté affiché ssi IA activée ; persistance `chess_settings` ; la FeedbackModal survit à la fermeture des Settings (pas de stacking).
- `ProfilePage` & sous-composants : empty state à 0 partie ; heatmap — découpage en semaines, libellé de mois unique, paliers de couleur (0/1/≤3/>3) ; WinRateRing — fractions d'arc et % arrondi, anneau gris si 0 partie ; ELOBadge — icône/couleur par palier (0, <4, <7, <11, <15, <18, <20, ≥20) ; BadgesGrid — verrouillé/déverrouillé + barre de progression.
- `PromotionPicker` : 4 choix, callback avec le bon type. `ModeSelect` : état offline désactive le multijoueur.

### 4.16 E2E Playwright 📋 (P3)

1. **Partie locale classique** : home → Local → Classic → jouer un mat du berger → modal GameOver → stats incrémentées dans `localStorage`.
2. **Partie vs IA** : activer l'IA niveau 1 → jouer un coup → l'IA répond en < 10 s → coup légal.
3. **P2P** : 2 contextes navigateur — host crée la room, guest rejoint par URL, `color_assign`/`sync_state` échangés, un coup de chaque côté, abandon, rematch.
4. **Persistance** : changer langue/skin/settings → recharger → préférences conservées.
5. **Navigation** : breadcrumbs, returnPath local (`/local`) vs P2P (`/p2p`), ScrollToTop.
6. **Modes spéciaux** : un coup wrap en borderless ; une capture avec glow vert en assimilation.

## 5. Priorisation & critères

| Priorité | Périmètre | Critère de sortie | Statut |
| --- | --- | --- | --- |
| **P0** | `moves`, `assimilation`, `aiFallback`, `board`, `pieceImage`, `statsService` | Suites vertes en CI, seuils de couverture par fichier (85–100 %, cf. `vitest.config.ts`) | ✅ **Implémenté** |
| **P1** | `tactics`, `coliseumMoves`, `legendaryPatterns`, `ChessAI` (mock Worker), `useChessGame`, `useP2PGame` | Cas du §4.7–4.12 implémentés, mocks réutilisables (`src/test/`) | 📋 À faire |
| **P2** | `P2PContext`, contexts, parité i18n, composants RTL du §4.15 | Cas implémentés, environnement jsdom par docblock | 📋 À faire |
| **P3** | E2E Playwright (§4.16), CI e2e séparée | 6 parcours verts en CI nightly ou pre-release | 📋 À faire |

**Règle d'or** : tout fix de bug commence par un test qui reproduit le bug (red → green) ; toute nouvelle règle de jeu arrive avec ses cas nominaux + erreurs + edge cases.

## 6. Risques & lacunes produit constatés

Constats faits pendant l'analyse — **non corrigés** par cette initiative, à arbitrer :

1. **Pas d'en passant** ni **nulle par triple répétition / règle des 50 coups** : assumé (modes fantaisistes), mais verrouillé par test pour le rendre explicite.
2. **`saveStats` échoue silencieusement** si le quota `localStorage` est dépassé : perte de stats sans feedback utilisateur.
3. **`SkinContext` ne valide pas** la valeur lue en storage : une valeur arbitraire est acceptée (risque d'images 404).
4. **`ChessAI.getHintMove`** : si l'appelant n'attend pas la promesse, le skill level peut rester à 20.
5. **Host autoritaire non authentifié en P2P** : le guest applique tout `move_confirm` sans re-validation (acceptable pour du jeu entre amis, à documenter).
6. **`recordGame` et frontière de minuit** : le day streak est calculé à l'enregistrement, une partie finie après minuit compte pour le nouveau jour.
7. **Game.tsx (~1 180 lignes)** : logique pure enfouie (`detectScholarsMate`, `resolveGameMode`, accumulation de stats de session) → extraction recommandée vers `src/utils/` pour testabilité.

## 7. Roadmap d'industrialisation

1. **Fait** : Vitest + Testing Library + helpers + suites P0 + CI GitHub Actions (`.github/workflows/test.yml` : lint + tests avec coverage + build).
2. **Sprint suivant (P1)** : mock Worker UCI réutilisable (`src/test/mockStockfish.ts`), mock d'actions Trystero (`src/test/mockRoom.ts`), suites §4.7–4.12.
3. **Ensuite (P2)** : suites composants RTL, test de parité i18n, seuil de couverture global (~70 %) en plus des seuils par fichier.
4. **Pre-release (P3)** : Playwright (projets chromium + webkit), parcours §4.16, exécution nightly ; envisager le visual regression (Playwright screenshots) sur l'échiquier et les skins.
5. **Hygiène continue** : ajouter les tests aux hooks de revue (CI bloquante), refuser tout merge qui fait baisser la couverture des fichiers P0.
