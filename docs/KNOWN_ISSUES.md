# ChessVerse — Registre des bugs & dettes connues

> Issu de la campagne de tests (voir `docs/TEST_STRATEGY.md`). Chaque entrée donne la cause, la localisation, les solutions envisageables et une recommandation, pour permettre à un agent (avec validation humaine) de trancher et corriger.
>
> **Règle** : chaque bug listé ici est **verrouillé par un test** qui assert le comportement actuel (commentaire `// NOTE:` dans la suite concernée). Corriger un bug = inverser l'assertion du test correspondant dans le même commit (red → green), puis passer le statut à ✅.

## Synthèse

| ID | Sévérité | Module | Titre | Statut |
| --- | --- | --- | --- | --- |
| BUG-001 | 🟠 Moyenne | statsService | `resetStats()` ne réinitialise pas `modeGameCount`/`dailyActivity` | ✅ Corrigé |
| BUG-002 | 🟡 Faible | statsService | Abandons adverses comptés dans `surrenders` | ✅ Corrigé |
| BUG-003 | 🟡 Faible | aiFallback | Destination borderless non normalisée | ✅ Corrigé |
| BUG-004 | 🟡 Faible | moves | `isSquareUnderAttack` ignore le wrap en borderless | ✅ Corrigé |
| BUG-005 | 🟢 Très faible | moves | `acquiredTypes` actifs hors mode assimilation | ✅ Corrigé |
| BUG-006 | 🟡 Faible | SkinContext | Skin non validé à la lecture du storage | ✅ Corrigé |
| BUG-007 | 🟡 Faible | statsService | Échec silencieux sur quota `localStorage` | ✅ Corrigé |
| BUG-008 | 🟠 Moyenne | ChessAI | FEN : droits de roque toujours `KQkq`, jamais d'en passant | ✅ Corrigé |
| BUG-009 | 🟢 Très faible | coliseumMoves | Attaque diagonale de pion sur case vide non détectée | ✅ Corrigé |
| BUG-010 | 🟠 Moyenne | useP2PGame | Guest : `seqRef` avancé même si la pièce du `move_confirm` est introuvable | ✅ Corrigé |
| BUG-011 | 🟡 Faible | useP2PGame | Host : `from` du `move_proposal` jamais validé | ✅ Corrigé |
| BUG-012 | 🟡 Faible | legendaryPatterns | Classification des mats imprécise ; setup Berger peut suggérer un coup perdant | ✅ Corrigé |
| UX-001 | 🟢 Très faible | GameOver | Micro-écarts UI : libellé « Close » non traduit, titre P2P, rematch masqué | ✅ Corrigé |
| UX-002 | 🟢 Très faible | GameSettings | Bouton ✕ sans `aria-label` (non ciblable par lecteur d'écran) | ✅ Corrigé |
| INFO-001 | ℹ️ Mitigé | ChessAI | Restauration du skill après un hint | ✅ Aucune action requise |
| INFO-002 | ℹ️ Théorique | ChessAI | `stopPending` peut avaler le `bestmove` suivant | ✅ Aucune action requise |
| INFO-003 | ℹ️ Théorique | useP2PGame | `onResign` avec `playerColor` null → résultat incohérent | ✅ Corrigé |
| DOC-001 | 🟠 Moyenne | README | « En passant » annoncé mais non implémenté | ✅ Corrigé |
| LIM-001 | ℹ️ Design | moves | Pas d'en passant, ni nulle par répétition / 50 coups | ✅ Corrigé |
| LIM-002 | ℹ️ Design | P2P | Le guest fait confiance au host sans re-validation | ✅ Corrigé |
| REC-001 | 🔧 Refacto | Game.tsx | Logique pure enfouie non testable | ✅ Corrigé |

---

## BUG-001 — `resetStats()` ne réinitialise pas tout

- **Sévérité** : 🟠 Moyenne (visible utilisateur : après reset, le profil affiche encore l'activité et la répartition de modes de la session précédente).
- **Symptôme** : après `resetStats()` puis `getStats()`, `modeGameCount` et `dailyActivity` contiennent encore les valeurs d'avant le reset (dans la même session JS).
- **Cause racine** : `getStats()` fait une **copie superficielle** de `DEFAULT_STATS` (`{ ...DEFAULT_STATS }`) ; `recordGame` mute ensuite les objets imbriqués **en place** — qui sont les objets du module `DEFAULT_STATS` lui-même.
- **Localisation** : `src/services/statsService.ts:433-438` (spread superficiel), `:521` (`stats.modeGameCount[...] = ...`), `:525` (`stats.dailyActivity[...] = ...`).
- **Solutions envisageables** :
  - **A. Clone profond dans `getStats()`** : `structuredClone(DEFAULT_STATS)` (ou clone du résultat mergé). 1 ligne, corrige toutes les variantes actuelles et futures.
  - B. Réassigner des objets neufs dans `recordGame` (`stats.modeGameCount = { ...stats.modeGameCount, [mode]: n }`). Corrige les 2 cas connus mais reste fragile au prochain champ imbriqué.
  - C. `Object.freeze` profond de `DEFAULT_STATS` + clone — détecte les régressions mais demande A de toute façon.
- **Recommandation** : **A** (`structuredClone`), éventuellement + C en dev. Effort : trivial. Risque : nul (ES2022+, cible ES2020 mais `structuredClone` est une API runtime disponible dans tous les navigateurs modernes ; sinon `JSON.parse(JSON.stringify(...))`).
- **Tests à inverser** : `src/services/statsService.test.ts` — tests marqués `// NOTE:` sur la pollution des défauts.

## BUG-002 — Abandons adverses comptés dans `surrenders`

- **Sévérité** : 🟡 Faible (fausse uniquement un compteur de badge).
- **Symptôme** : quand **l'adversaire** abandonne (le joueur gagne), `stats.surrenders` est quand même incrémenté ; le badge lié aux abandons progresse à tort.
- **Cause racine** : `if (game.surrenderedBy) stats.surrenders += 1` ne vérifie pas **qui** a abandonné.
- **Localisation** : `src/services/statsService.ts:497` (badge : `:322-323`).
- **Solutions envisageables** :
  - **A. Conditionner au résultat** : `if (game.surrenderedBy && game.result === "loss")` — un abandon du joueur produit toujours une défaite. Aucun changement de schéma.
  - B. Ajouter `playerColor` au `GameRecord` et comparer à `surrenderedBy`. Plus explicite mais touche tous les appels de `recordGame`.
- **Recommandation** : **A**. Effort : trivial. Risque : nul.
- **Tests à inverser** : `src/services/statsService.test.ts` — test `// NOTE:` sur l'abandon adverse.

## BUG-003 — Fallback IA : destination borderless non normalisée

- **Sévérité** : 🟡 Faible (latent : `applyMoveToState` normalise, donc aucun symptôme aujourd'hui — mais tout nouveau consommateur du fallback recevrait des coordonnées hors plateau, ex. `{x:-1}`).
- **Cause racine** : `toMove()` retourne la destination **virtuelle brute** issue de `getValidMoves` sans appeler `normalizePosition` (qui existe déjà dans le fichier et est utilisée partout ailleurs).
- **Localisation** : `src/utils/chess/aiFallback.ts:53-55` (`toMove`), `normalizePosition` dispo ligne `18`.
- **Solutions envisageables** :
  - **A. Normaliser dans `toMove`** : `to: normalizePosition(c.to)`. 1 ligne, rend le contrat de `getSmartFallbackMove` cohérent (« toujours 0-7 »).
  - B. Documenter le contrat actuel (« le consommateur doit normaliser ») — gratuit mais laisse le piège.
- **Recommandation** : **A**. Effort : trivial. Risque : vérifier qu'aucun consommateur ne compare la destination aux coups bruts de `getValidMoves` (a priori non : `Game.tsx` passe la cible à `applyMoveToState`).
- **Tests à inverser** : `src/utils/chess/aiFallback.test.ts` — test `// NOTE:` borderless (asserte la valeur brute + son équivalence normalisée).

## BUG-004 — `isSquareUnderAttack` ignore le wrap en borderless

- **Sévérité** : 🟡 Faible (n'affecte que la qualité du fallback IA : un coup peut être classé « sûr » alors qu'il est attaquable à travers le bord, et inversement).
- **Cause racine** : `isInCheck` sonde 9 positions virtuelles du roi (±8) pour détecter les attaques wrappées, mais `isSquareUnderAttack` ne teste que la case littérale.
- **Localisation** : `src/utils/chess/moves.ts:343` et suivantes (comparer à l'implémentation d'`isInCheck`).
- **Solutions envisageables** :
  - **A. Aligner sur `isInCheck`** : itérer les 9 équivalents virtuels de la case en mode borderless. Coût CPU ×9 sur cette fonction (appelée en boucle par le fallback) — acceptable, le scan est déjà exhaustif.
  - B. Statu quo documenté : le fallback est une heuristique de secours, l'imprécision est tolérable.
- **Recommandation** : **A** si l'on tient à la qualité de l'IA en borderless, sinon **B**. À trancher produit. Effort : faible. Risque : perf à surveiller (mesurer le temps du fallback sur un plateau plein).
- **Tests** : aucun test ne verrouille ce point (observation) — en ajouter un au moment du fix.

## BUG-005 — `acquiredTypes` actifs hors mode assimilation

- **Sévérité** : 🟢 Très faible (aucune pièce ne porte d'`acquiredTypes` hors assimilation en pratique ; seul un état corrompu/forgé serait affecté).
- **Cause racine** : `isValidMove` appelle `getPieceCapabilities(piece)` **sans condition de mode** ; seule la fusion à la capture est conditionnée par `rules.assimilation`.
- **Localisation** : `src/utils/chess/moves.ts:170` (et `:237`, `:343` pour les variantes).
- **Solutions envisageables** :
  - A. Conditionner : `const capabilities = gameMode.rules?.assimilation ? getPieceCapabilities(piece) : [piece.type]`.
  - **B. Statu quo** : comportement défensif inoffensif, et un état P2P synchronisé contient déjà le mode.
- **Recommandation** : **B** (ne pas corriger), garder le test qui verrouille le comportement. Si A est choisi, appliquer aux 3 sites.
- **Tests à inverser si A** : `src/utils/chess/moves.test.ts` — test `// NOTE:` correspondant.

## BUG-006 — Skin non validé à la lecture du storage

- **Sévérité** : 🟡 Faible (une valeur arbitraire dans `chessverse_skin` produit des images 404 sur tout l'échiquier).
- **Cause racine** : `SkinContext` lit la chaîne brute du `localStorage` sans la valider contre les skins connus.
- **Localisation** : `src/context/SkinContext.tsx:17` (lecture), `SKINS` dans `src/utils/pieceImage.ts`.
- **Solutions envisageables** :
  - **A. Valider à la lecture** : `SKINS.some(s => s.id === saved) ? saved : "classic"`.
  - B. Valider aussi dans `setSkin` (défense en profondeur).
- **Recommandation** : **A** (+ B si peu coûteux). Effort : trivial. Risque : nul.
- **Tests** : à ajouter au moment du fix (P2 — voir stratégie §4.14).

## BUG-007 — Échec silencieux sur quota `localStorage`

- **Sévérité** : 🟡 Faible (perte de stats sans feedback ; quota difficilement atteignable avec ~quelques Ko, mais `dailyActivity` croît sans borne).
- **Cause racine** : `saveStats` avale toute exception de `setItem`.
- **Localisation** : `src/services/statsService.ts:442-448`.
- **Solutions envisageables** :
  - **A. `console.warn` dans le catch** + **purge de `dailyActivity`** aux 365 derniers jours à chaque `recordGame` (borne la croissance, seule vraie cause plausible de quota).
  - B. Remonter l'erreur à l'UI (toast) — disproportionné pour ce produit.
- **Recommandation** : **A**. Effort : faible. Risque : nul.
- **Tests à adapter** : `src/services/statsService.test.ts` — le test quota vérifie déjà l'absence de crash ; ajouter l'assertion sur `console.warn` et la purge.

## BUG-008 — FEN : droits de roque toujours `KQkq`

- **Sévérité** : 🟠 Moyenne (Stockfish peut suggérer un **roque illégal** — roi/tour déjà déplacés — que le moteur local rejettera ensuite, déclenchant retries puis fallback : coup IA de moindre qualité, jamais de coup illégal appliqué).
- **Cause racine** : la FEN envoyée à Stockfish se termine toujours par `KQkq - 0 1` quel que soit l'état (`hasMoved` des rois/tours ignoré, en passant jamais renseigné — cohérent avec LIM-001).
- **Localisation** : `src/services/ChessAI.ts:265`.
- **Solutions envisageables** :
  - **A. Calculer les droits réels** : déduire `K/Q/k/q` de `hasMoved` du roi et des tours sur leurs cases d'origine ; `-` si aucun. ~15 lignes pures, testables.
  - B. Statu quo : la chaîne retry+fallback absorbe déjà l'erreur (c'est son rôle), coût = qualité de jeu légèrement dégradée dans ces positions.
- **Recommandation** : **A** — amélioration nette de la qualité IA pour un coût faible ; écrire d'abord les tests de la fonction de droits de roque. Décision humaine sur la priorité.
- **Tests** : `src/services/ChessAI.test.ts` verrouille la FEN actuelle (spot-checks) — adapter au moment du fix.

## BUG-009 — Coliseum : attaque diagonale de pion sur case vide non détectée

- **Sévérité** : 🟢 Très faible (la détection d'échec reste correcte : `getColiseumLegalMoves` simule le coup, donc le roi occupe la case au moment du test ; seuls les usages « case vide » de `isColiseumSquareUnderAttack` sous-évaluent la couverture des pions).
- **Cause racine** : les captures de pion coliseum exigent une cible présente (`mustCapture`) — l'inverse du mode standard, où `isSquareUnderAttack` gère explicitement la diagonale de pion sur case vide.
- **Localisation** : `src/utils/chess/coliseumMoves.ts` (logique pion / `isColiseumSquareUnderAttack`).
- **Solutions envisageables** : A. aligner sur le mode standard (compter les diagonales de pion même vides) ; **B. statu quo documenté** (aucun symptôme connu).
- **Recommandation** : **B**, sauf si un futur usage de `isColiseumSquareUnderAttack` sur cases vides apparaît. Comportement verrouillé par deux tests `// NOTE:`.

## BUG-010 — Guest : `seqRef` avancé sur pièce introuvable

- **Sévérité** : 🟠 Moyenne (si un `move_confirm` référence un `pieceId` absent du plateau local — message perdu/réordonné en amont, état divergent — le guest **ignore le coup mais synchronise quand même `seqRef`** : la partie continue avec deux plateaux différents, sans erreur visible).
- **Cause racine** : `onMoveConfirm` met à jour `seqRef` avant/indépendamment de la résolution du `pieceId` ; l'échec de résolution est silencieux.
- **Localisation** : `src/hooks/useP2PGame.ts:99-105`.
- **Solutions envisageables** :
  - **A. Demander une resynchronisation** : sur pieceId introuvable, envoyer un message (ex. réutiliser/étendre `sync_state`) pour que le host renvoie le plateau complet. Robuste, nécessite un petit ajout au protocole côté host.
  - B. À minima : `console.error` + ne pas avancer `seqRef` (rend la divergence détectable au prochain message via le gap).
- **Recommandation** : **B** à court terme (trivial), A si l'on veut une vraie résilience réseau. Décision humaine.
- **Tests à inverser** : `src/hooks/useP2PGame.test.tsx` — test `// NOTE:` correspondant.

## BUG-011 — Host : `from` du `move_proposal` jamais validé

- **Sévérité** : 🟡 Faible (le host valide la pièce par `pieceId` et la destination par `getValidMoves` — un `from` mensonger est ignoré, le coup appliqué reste légal ; incohérence de protocole plus que faille).
- **Localisation** : `src/hooks/useP2PGame.ts` (handler `onMoveProposal`).
- **Solutions envisageables** : **A.** rejeter si `msg.from` ≠ position actuelle de la pièce (1 comparaison) ; B. retirer `from` du message (changement de protocole).
- **Recommandation** : **A**. Effort : trivial. Risque : nul.

## INFO-003 — `onResign` avec `playerColor` null

- **Constat** : si un `resign` arrive alors que `playerColor` n'est pas encore assigné (fenêtre de handshake), le résultat dérive `winner` **et** `surrenderedBy` de la même valeur nulle → `winner: "white"`, `surrenderedBy: "white"` (incohérent). Fenêtre quasi inatteignable en pratique (la partie n'a pas commencé).
- **Localisation** : `src/hooks/useP2PGame.ts:119-127`.
- **Recommandation** : ignorer le `resign` si `playerColor === null`. À traiter avec BUG-010/011 si refonte du handler.

## INFO-002 — `stopPending` peut avaler le `bestmove` suivant (théorique)

- **Constat** : si l'engin n'émet **jamais** le `bestmove` final d'une recherche annulée (contraire au protocole UCI), `stopPending` reste vrai et consommerait le premier `bestmove` de la recherche suivante.
- **Localisation** : `src/services/ChessAI.ts` (gestion `stopPending` dans `onmessage`).
- **Recommandation** : aucune action (Stockfish répond toujours à `stop` par un `bestmove`) ; si refacto, réinitialiser `stopPending` au lancement d'une nouvelle recherche.

## INFO-001 — Restauration du skill après un hint (mitigé)

- **Constat initial** : `getHintMove` force le skill à 20 puis le restaure ; en cas de rejet non attendu, le niveau pourrait rester à 20.
- **Mitigation existante** : `getNextMove` **réinitialise le skill avant chaque recherche** (`src/services/ChessAI.ts:137-140`), donc aucune partie ne peut se jouer durablement à skill 20.
- **Recommandation** : aucune action. Si refacto, centraliser l'envoi du `setoption` dans un seul point d'entrée.

## DOC-001 — README annonce « en passant »

- **Sévérité** : 🟠 Moyenne (promesse produit fausse : la prise en passant est **refusée** par le moteur, comportement verrouillé par test).
- **Localisation** : `README.md` section *Features* (« Castling, **en passant**, pawn promotion… ») vs `src/utils/chess/moves.ts` (aucune implémentation).
- **Solutions envisageables** :
  - **A. Corriger le README** (retirer « en passant »). Trivial.
  - B. Implémenter l'en passant (nécessite de tracker le dernier double-pas dans `GameState`, gérer le borderless/assimilation, MAJ FEN pour Stockfish — qui suggérera des prises en passant ensuite). Effort : moyen+.
- **Recommandation** : **A** à court terme ; B est un choix produit (noter que Stockfish raisonne déjà en règles standard, donc B améliorerait aussi la cohérence IA). Décision humaine requise.

## BUG-012 — `legendaryPatterns` : classifications imprécises (groupé)

Relevés par les tests (verrouillés par `// NOTE:` dans `src/utils/chess/legendaryPatterns.test.ts`) :

1. **`classifyMate` ne considère que les pièces qui attaquent le roi** : les mats Arabe (tour+cavalier) et de l'Opéra (tour+fou) ne peuvent donc être reconnus que sur des **doubles échecs** ; leurs positions canoniques (pièce mineure couvrant les fuites sans donner échec) sont classées `backrankmate`.
2. **Condition du mat de Lolli trop lâche** : « dame mateuse + n'importe quel pion allié sur la colonne g » — un pion inactif en g2 transforme un simple mat du couloir en `lollismate`, alors que le vrai pion de Lolli (f6) ne matche jamais.
3. **Le setup du mat du Berger peut suggérer un coup perdant** : la suggestion prend le premier coup de dame (ordre de génération) qui « voit » f7 — dans la position standard c'est **Qd7??** (dame en prise à côté du roi adverse). Impact direct si la fonctionnalité d'indice/annotation expose cette suggestion au joueur.
4. Mineur : commentaire obsolète dans `tactics.ts:63` (mentionne un paramètre `skipCheckValidation` inexistant).

- **Localisation** : `src/utils/chess/legendaryPatterns.ts` (`classifyMate`, condition Lolli, phase « setups 2 coups »).
- **Solutions envisageables** : **A.** corriger par item — classifyMate : inclure les pièces qui *confinent* le roi, pas seulement les attaquantes ; Lolli : exiger le pion en f6/f3 adjacent à la dame ; setup Berger : filtrer les suggestions où la dame est en prise (`isSquareUnderAttack`). B. Statu quo : feature cosmétique, mal classer un mat reste anecdotique — **sauf l'item 3** si la suggestion est montrée au joueur.
- **Recommandation** : traiter l'**item 3** en priorité (vérifier d'abord dans `Game.tsx` si la suggestion est affichée), items 1-2 en confort. Décision humaine.

## UX-001 — Micro-écarts UI dans `GameOver` (groupés)

Relevés par les tests composants (verrouillés par `// NOTE:` dans `src/components/GameOver.test.tsx`) :

1. **`aria-label="Close"` codé en dur en anglais** sur le bouton ✕ — devrait passer par i18n (clé à ajouter aux 8 locales).
2. **Le titre P2P ignore `playerColor`** : seul le style change selon victoire/défaite, le texte est générique — vérifier que c'est voulu.
3. **`peerLeft` masque le bouton rematch** au lieu de l'afficher désactivé — choix UX à confirmer (un bouton désactivé + tooltip « adversaire parti » est plus lisible).
4. **Victoire des noirs en local sans IA** affichée comme « victoire » générique — cohérent (2 joueurs sur le même écran), à confirmer.

- **Recommandation** : corriger 1 (trivial, vraie anomalie i18n) ; 2-4 sont des décisions produit à trancher en lot.

## UX-002 — `GameSettings` : bouton ✕ sans nom accessible

- **Sévérité** : 🟢 Très faible (accessibilité : le bouton de fermeture du modal Settings est invisible pour les lecteurs d'écran et difficile à cibler en test).
- **Symptôme** : découvert pendant l'écriture de `GameSettings.test.tsx` — le bouton ✕ n'a ni `aria-label` ni texte ; le test doit le retrouver par sa classe CSS (fragile).
- **Localisation** : `src/components/GameSettings.tsx:220-225` (le ✕ de `GameOver` a un `aria-label="Close"`, cf. UX-001 item 1 ; celui de `GameSettings` n'en a aucun).
- **Solution** : ajouter `aria-label={t("gameSettings.close")}` (clé à créer dans les 8 locales — ou réutiliser une clé commune `common.close` qui réglerait aussi UX-001 item 1).
- **Recommandation** : corriger en même temps que UX-001 item 1 avec une clé i18n partagée. Effort : trivial.
- **Tests à adapter** : `src/components/GameSettings.test.tsx` — remplacer la requête par classe par `getByRole("button", { name: ... })`.

## LIM-001 / LIM-002 — Limitations assumées (design)

- **LIM-001** : ✅ Corrigé — en passant, nulle par triple répétition et règle des 50 coups sont désormais implémentés. `GameState` expose `enPassantTarget`, `halfMoveClock` et `positionHistory`. Helpers `isDrawByRepetition()` / `isDrawBy50Moves()` exportés depuis `moves.ts`. La FEN envoyée à Stockfish inclut la case d'en passant et le compteur. `Game.tsx` déclenche la fin de partie sur répétition ou 50 coups via l'effet de filet.
- **LIM-002** : en P2P le host est autoritaire ; le guest applique tout `move_confirm` sans re-validation (`src/hooks/useP2PGame.ts`). Acceptable pour du jeu entre amis ; à documenter, pas à « corriger » sans refonte du protocole.

## REC-001 — Extraction de la logique pure de `Game.tsx`

- **Constat** : `Game.tsx` (~1 180 lignes) contient de la logique pure non testable isolément : `detectScholarsMate(moves)` (l.~55-82), `resolveGameMode(modeId, p2pMode)` (l.~84-90), accumulation des stats de session, chaîne de validation des coups IA.
- **Recommandation** : extraire vers `src/utils/` (ex. `src/utils/chess/scholarsMate.ts`) et couvrir unitairement ; aucune modification de comportement. Prérequis utile avant tout travail E2E sur `Game.tsx`.
- **Résolution** : `detectScholarsMate` extrait vers `src/utils/chess/tactics.ts` ; `resolveGameMode` extrait vers `src/utils/gameLogic.ts` (nouveau fichier). Game.tsx importe depuis ces nouveaux emplacements. 23 tests unitaires ajoutés (9 Scholar's Mate + 4 detectTactic smoke + 10 resolveGameMove). Aucun changement de comportement.

---

## Procédure pour l'agent correcteur

1. Choisir une entrée **validée par un humain** (statut coché « à corriger »).
2. Localiser le(s) test(s) `// NOTE:` associé(s), inverser l'assertion (le test doit échouer).
3. Appliquer la solution recommandée (ou celle tranchée par l'humain).
4. Vérifier : suite complète verte (`npm run test`), seuils de couverture (`npm run test:coverage`), lint, build.
5. Mettre à jour ce document : statut → ✅ + référence du commit.
