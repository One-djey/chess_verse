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

## BUG-010 — Guest : `seqRef` avancé sur pièce introuvable

- **Sévérité** : 🟠 Moyenne (si un `move_confirm` référence un `pieceId` absent du plateau local — message perdu/réordonné en amont, état divergent — le guest **ignore le coup mais synchronise quand même `seqRef`** : la partie continue avec deux plateaux différents, sans erreur visible).
- **Cause racine** : `onMoveConfirm` met à jour `seqRef` avant/indépendamment de la résolution du `pieceId` ; l'échec de résolution est silencieux.
- **Localisation** : `src/hooks/useP2PGame.ts` (handler `onMoveConfirm`, bloc guest).
- **Solution appliquée** : protocole de resynchronisation complet (option A améliorée).
  - Sur `pieceId` introuvable : `console.error` + `actions.sendSyncRequest({ type: "sync_request" })` + `return prev` sans avancer `seqRef`.
  - Côté host : `actions.onSyncRequest` répond par `actions.sendSyncState` avec les pièces courantes et le `seq` courant, permettant au guest de se réaligner.
  - Nouveau message `SyncRequestMessage` (`type: "sync_request"`) ajouté à `src/types/p2p.ts` et à la union `P2PMessage`.
  - `makeRoomActions` dans `src/services/TrysteroService.ts` expose `sendSyncRequest` / `onSyncRequest`.
- **Tests** : `src/hooks/useP2PGame.test.tsx` — « requests resync for unknown pieceId, does NOT advance seqRef (BUG-010 fixed) » + suite « host sync_request handler ».

## LIM-002 — Guest re-validation et protocole de resync

- **Constat initial** : en P2P le host est autoritaire ; le guest appliquait tout `move_confirm` sans re-validation — acceptable pour du jeu entre amis, mais une divergence d'état pouvait bloquer la partie définitivement.
- **Localisation** : `src/hooks/useP2PGame.ts` (handler `onMoveConfirm`, bloc guest).
- **Solution appliquée** : resync protocol (round-trip sur divergence, jamais de desync permanent).
  - Le guest re-valide la destination du `move_confirm` via `getValidMoves`.
  - Si le coup n'est pas dans les coups valides locaux : `console.error` + `actions.sendSyncRequest({ type: "sync_request" })` + `return prev` sans avancer `seqRef`.
  - Le host répond à `sync_request` en renvoyant l'état complet via `sync_state` (pièces + seq), permettant au guest de se réaligner plutôt que de rester bloqué.
  - Trade-off documenté : ajoute un aller-retour en cas de divergence, mais empêche tout blocage permanent. Les divergences légitimes (modes spéciaux, en passant, promotion) sont correctement détectées et résolues.
- **Tests** : `src/hooks/useP2PGame.test.tsx` — « requests resync when destination is not in valid moves, seqRef stays (LIM-002 fixed) » + suite « host sync_request handler ».

---

*(Les autres entrées du registre sont dans la version principale de ce fichier.)*
