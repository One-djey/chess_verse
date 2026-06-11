# ChessVerse — Architecture Decision Records

> ADR-style entries for key technical decisions made during the QA/fix campaign.
> Format: Context → Decision → Alternatives → Consequences.

---

## ADR-001 — `structuredClone` for DEFAULT_STATS deep copy (BUG-001)

**Date**: 2026-06-11
**Status**: Accepted

### Context

`statsService.ts` held a module-level `DEFAULT_STATS` object with nested collections (`modeGameCount`, `dailyActivity`). `getStats()` used a shallow spread (`{ ...DEFAULT_STATS }`) to seed fresh state. `recordGame()` then mutated nested sub-objects in place, which were actually references into the `DEFAULT_STATS` module object itself. After `resetStats()` and a subsequent `getStats()`, the "reset" state contained the previous session's data.

### Decision

Replace the shallow spread in `getStats()` with `structuredClone(DEFAULT_STATS)`. This guarantees a fully independent copy at every call site, regardless of how many levels of nesting future fields add.

### Alternatives considered

- **B. Reassign immutably in `recordGame`**: `stats.modeGameCount = { ...stats.modeGameCount, [mode]: n }`. Fixes the two known mutation sites but is brittle — any new nested field must follow the same pattern. Rejected: low safety margin.
- **C. `Object.freeze` + structuredClone**: would cause runtime errors instead of silent corruption on regression. Accepted as a dev-mode companion but not required in production.
- **JSON.parse/JSON.stringify**: functionally equivalent but slower, breaks if `DEFAULT_STATS` ever contains `Date`, `undefined`, or typed arrays. `structuredClone` (ES2022, available in all target runtimes) handles these correctly without guessing.

### Consequences

- `getStats()` always returns a fully independent copy; callers can mutate freely.
- Future schema additions (new nested fields) are safe by default.
- Marginal perf cost (deep clone on every `getStats()` call) — acceptable given call frequency.

---

## ADR-002 — Position hash includes castling rights + en passant (triple-repetition detection)

**Date**: 2026-06-11
**Status**: Accepted

### Context

Triple-repetition draw detection (LIM-001) requires comparing board positions. A position hash was introduced in `positionHistory`. The initial implementation hashed only piece positions and colors, omitting castling availability and en passant target square.

Under FIDE rules, two positions are identical only if the same player is to move, the same pieces occupy the same squares, **and** the same castling rights and en passant possibilities are available. A position reached after the king has moved (forfeiting castling) is not the same as the identical piece layout before the king moved.

### Decision

Extend the position hash to include: castling availability flags (`K`, `Q`, `k`, `q` derived from `hasMoved` of kings and rooks on their home squares), the en passant target square (once LIM-001 was implemented), and the current player's color.

### Alternatives considered

- **Pieces-only hash**: simpler to compute; risks false draw claims (two positions with different castling rights counted as equal). Rejected: violates FIDE rule 9.2.2.
- **Full FEN string**: unambiguous but verbose; requires serialising the whole board every half-move. Acceptable overhead but more complex. The lightweight flag-based hash was chosen instead.

### Consequences

- Draw detection is FIDE-compliant for the implemented rules.
- The hash is slightly more expensive to compute but still O(pieces).
- If future rules (e.g. 960 castling) are added, the hash function must be updated.
- **Known debt**: `computeCastlingKey` in `moves.ts` duplicates the castling-rights
  logic of `ChessAI.computeCastlingRights`. The duplication is intentional — importing
  a service into a `utils` module would create a circular dependency — but the two
  implementations of the same FIDE rule can drift. If a third consumer ever needs
  castling rights, extract a shared `castlingRights(pieces)` helper into a leaf module
  (e.g. `chess/castling.ts`) that both `moves.ts` and `ChessAI.ts` import.

---

## ADR-003 — En passant threaded via optional `GameState` field (LIM-001)

**Date**: 2026-06-11
**Status**: Accepted

### Context

`isValidMove` and `getValidMoves` previously accepted a `GameMode` parameter but not full `GameState`. En passant requires knowing the last double-pawn push target square. Two options existed: (A) thread the full `GameState`, or (B) add an optional `enPassantTarget?: Position` parameter alongside `GameMode`.

### Decision

Option B: add `enPassantTarget?: Position` as an optional third parameter to `getValidMoves` / `isValidMove`. `applyMoveToState` returns an updated `GameState` that includes the new `enPassantTarget` after each half-move.

### Alternatives considered

- **Thread full GameState**: more future-proof (any new rule can be plumbed through), but breaks all existing callers and tests and exposes the move engine to the full game lifecycle object (over-coupling). Rejected for this iteration.
- **Global/context state**: anti-pattern in a pure-function chess engine.

### Consequences

- `getValidMoves` signature grows by one optional parameter — backward-compatible.
- Adding future stateful rules (e.g. 50-move clock) requires threading another parameter, which will eventually motivate graduating to a full `GameState` parameter. When a third stateful parameter is needed, revisit this ADR and migrate the signature.
- Coliseum and P2P modes that bypass `getValidMoves` are unaffected.

---

## ADR-004 — P2P: host is authoritative; guest requests resync on divergence (LIM-002 + BUG-010)

**Date**: 2026-06-11
**Status**: Accepted

### Context

In the P2P mode, both players run the same move-validation logic locally. A naïve implementation let each player validate and apply moves independently, risking state divergence on packet loss or reorder. The host was chosen as the single source of truth: only the host sends `move_confirm` messages; the guest sends `move_proposal` and waits for the host's confirmation before applying.

BUG-010 identified that if a `move_confirm` arrived with an unknown `pieceId` (e.g. out-of-order delivery), the guest silently skipped the move but still advanced `seqRef`, causing subsequent moves to apply out of context.

### Decision

- **Trust model**: host is always authoritative. Guest never applies a move until the host confirms it.
- **On unknown pieceId**: guest does *not* advance `seqRef`, logs an error, and emits a resync request so the host can re-broadcast the full `sync_state`.
- `seqRef` is only advanced after a successful piece lookup and move application.

### Alternatives considered

- **Symmetric validation** (both validate independently and reconcile): more resilient to a malicious host but requires a consensus protocol — disproportionate complexity for a casual game between friends.
- **Ignore unknown pieceId silently** (original code): hides divergence; boards can silently differ for the rest of the game. Rejected: poor player experience.
- **Full state resync on every move**: safe but high bandwidth and latency. Reserved for explicit resync requests only.

### Consequences

- Guest experience depends on host connectivity quality.
- Resync adds a round-trip latency spike when divergence is detected.
- The trust model is documented; a future "competitive" mode would need a different approach.

---

## ADR-005 — `acquiredTypes` gated on assimilation mode (BUG-005)

**Date**: 2026-06-11
**Status**: Accepted (mode-guard added at 3 call sites)

### Context

`isValidMove` / `getValidMoves` call `getPieceCapabilities(piece)` to iterate over all movement types a piece has. `getPieceCapabilities` returns `[piece.type, ...piece.acquiredTypes]`. This means that if a piece somehow carries `acquiredTypes` outside of assimilation mode (e.g. state corruption, forged/replayed P2P state), those capabilities would silently activate, letting a piece move in ways its mode does not allow.

`KNOWN_ISSUES.md` originally recommended option B (statu quo, no code change), on the grounds that no piece carries `acquiredTypes` outside assimilation in practice. That recommendation was **overridden by an explicit product decision** to make the engine defensive against cross-mode contamination rather than rely on an invariant that lives outside the move engine.

### Decision

**Add a mode-guard at all 3 call sites** that consume capabilities:

```typescript
const capabilities = gameMode.rules?.assimilation
  ? getPieceCapabilities(piece)
  : [piece.type];
```

Each site carries an identical comment explaining that even a piece that somehow
carries `acquiredTypes` (corrupted/forged P2P state) must behave as its base type
only when not in assimilation mode. This keeps the move engine correct on its own,
without depending on `applyAssimilationCapture` being the only writer of `acquiredTypes`.

### Alternatives considered

- **B. Statu quo (no guard)** — the original `KNOWN_ISSUES.md` recommendation. Relies on `acquiredTypes` only ever being written under `rules.assimilation`. Rejected: makes move-engine correctness depend on an external invariant, and offers no defence against corrupted/replayed P2P state. The guard is cheap (an array literal on a path that already iterates pieces) and the explanatory comment removes the "why is this condition here?" trap.

### Consequences

- The move engine is self-contained: out-of-mode `acquiredTypes` are inert.
- Three call sites must stay in sync; the shared comment flags the intent. If a 4th
  consumer of `getPieceCapabilities` appears, it must apply the same guard.
- Marginal cost: one branch + array literal per capability lookup. Negligible.

---

## ADR-006 — `detectScholarsMate` extracted to `tactics.ts` (REC-001)

**Date**: 2026-06-11
**Status**: Accepted

### Context

`Game.tsx` (~1 180 lines) contained several pure functions that were impossible to unit-test without mounting the full React component. Two of these were identified for extraction: `detectScholarsMate` and `resolveGameMode`.

`detectScholarsMate` is a pattern-matcher over `MoveRecord[]` — it has no React dependencies, no side effects, and a well-defined boolean contract. Cohesion rationale: it belongs in `tactics.ts` alongside `detectTactic`, since both are concerned with classifying sequences of moves for annotation/badge purposes.

`resolveGameMode` maps a URL parameter and an optional P2P-provided mode to a concrete `GameMode`. It belongs in `src/utils/gameLogic.ts` — a new utility file for game-lifecycle helpers that don't fit in the chess engine modules.

Two items from the original REC-001 report were intentionally **not** extracted:

1. **Session stats accumulation** (`sessionStatsRef`, `hintsFollowedRef`, `wasPromotedRef`): lifecycle is tightly bound to React refs; extracting would require threading `React.RefObject<T>` into utility functions, coupling the utility to React.
2. **AI move validation chain** (the `applyMove`/`trigger` closure in the AI `useEffect`): calls `chess.setGameState`, `addLabel`, `triggerAnnotation` — all React state. This is orchestration logic, not pure business logic.

### Decision

Extract `detectScholarsMate` to `src/utils/chess/tactics.ts` and `resolveGameMode` to `src/utils/gameLogic.ts`. Document in `Game.tsx` why the remaining two items were not extracted. Write unit tests for both extracted functions.

### Alternatives considered

- **New `scholarsMate.ts` file**: would isolate the function but creates a one-function module with no obvious peers. `tactics.ts` is a better home given the shared domain.
- **Keep everything in `Game.tsx`**: zero refactoring cost but prevents unit testing; blocks future E2E work on the component.

### Consequences

- `detectScholarsMate` and `resolveGameMode` are now independently testable.
- `Game.tsx` is ~40 lines shorter and imports from well-named modules.
- Session stats accumulation and AI validation chain remain in `Game.tsx`; the decision and rationale are documented in the file header comment.

---

## ADR-007 — Coliseum pawn direction fix (BUG-009)

**Date**: 2026-06-11
**Status**: Accepted

### Context

Coliseum mode pawns are **omnidirectional**: they move one step in any of the 4 orthogonal directions (non-capturing) and capture on any of the 4 diagonals. This is by design — Coliseum is not standard chess.

`getColiseumValidMoves` implements this correctly: diagonal captures use `mustCapture=true`, so the returned move list only includes diagonal squares that have an enemy piece. However, `isColiseumSquareUnderAttack` consumes this list for coverage-map purposes (e.g. "is this square safe for the king to step onto?"). On an **empty** diagonal square, no entry is returned by `getColiseumValidMoves`, causing the square to be incorrectly classified as safe even though a pawn threatens it.

### Decision

Add an inline pawn-coverage check in `isColiseumSquareUnderAttack` before delegating to `getColiseumValidMoves`:

```typescript
if (attacker.type === "pawn") {
  const dx = Math.abs(pos.x - attacker.position.x);
  const dy = Math.abs(pos.y - attacker.position.y);
  if (dx === 1 && dy === 1) return true;
}
```

This covers all 4 diagonal directions unconditionally, matching Coliseum's omnidirectional pawn rules. The check uses `Math.abs` on both axes — **not** a directional `forwardDir` guard — because Coliseum pawns attack backwards and forwards equally.

### Alternatives considered

- **Modify `getColiseumValidMoves` to return diagonals even when empty**: would conflate "valid player moves" with "attack coverage" and break the `mustCapture` semantics used throughout the function. Rejected: breaks single-responsibility.
- **Use `forwardDir` (standard chess direction)**: would be WRONG for Coliseum. A white pawn at (3,4) must threaten (2,5) and (4,5) just as much as (2,3) and (4,3). Standard chess pawn direction does not apply here.
- **Statu quo (document, no fix)**: acceptable per the KNOWN_ISSUES recommendation since no visible symptom was reported; however the fix is trivial and correctness is preferable.

### Consequences

- `isColiseumSquareUnderAttack` now correctly marks all 4 empty diagonals of a pawn as attacked.
- King-safety checks in Coliseum mode become accurate for all pawn positions.
- The coordinate system (y=0 = rank 8, y=7 = rank 1) is documented in the code comment for future reference.
- Tests verify both the fix (empty diagonals attacked) and the invariant (orthogonal squares not attacked).

---

## ADR-008 — Process: parallel agents + manual worktree merges (campaign retrospective)

**Date**: 2026-06-11
**Status**: Accepted (lesson learned, not a code change)

### Context

The bug-fix campaign was executed by several agents running in isolated git
worktrees, whose branches were then merged manually into the feature branch. Each
agent produced locally-correct fixes, but the **merge seams** were the fragile point.

### What actually went wrong

- A `detectScholarsMate` function was **duplicated** during a conflict resolution
  (one copy from the REC-001 extraction, one re-added by a later merge), producing a
  "Multiple exports with the same name" esbuild error that broke 17 test files at once.
- Two ADRs in this very file shipped **describing the opposite of the code**:
  ADR-002's title said the position hash *excludes* castling rights (it includes them),
  and ADR-005 documented a "no code change" decision for BUG-005 when the mode-guard
  was in fact added. Both were authored against an earlier draft of the plan and never
  reconciled with the final implementation.

### Decision / guidance for next time

- After every worktree merge, run `npm run test && npm run lint && npm run build`
  **before** committing the merge — a transform-level error (duplicate export, bad
  import) masquerades as hundreds of failing tests and is easy to misread as a logic
  regression.
- When a fix overrides a `KNOWN_ISSUES.md` recommendation (e.g. BUG-005 chose A over
  the recommended B), update the ADR **in the same commit** as the code, not from an
  earlier plan draft. The doc must describe what shipped, not what was once proposed.
- Treat duplicate-symbol / unused-export lint and `grep` for the changed symbol name
  as a cheap post-merge sanity check.

### Consequences

- The two doc/code contradictions above are corrected in this revision.
- Future multi-agent campaigns should gate each merge on green test+lint+build.

---

## ADR-009 — `isSquareUnderAttack` iterates 9 virtual positions in borderless mode (BUG-004)

**Date**: 2026-06-11
**Status**: Accepted

### Context

`isSquareUnderAttack` is the workhorse of the AI fallback heuristic: it classifies
every candidate move as "safe" or "risky" by checking whether the destination square
is attacked. In borderless mode, an attacker can reach a target by going "the long way
around" (e.g. a rook at x=0 attacks x=6 through x=7→x=0, not just left-to-right).
`isInCheck` already handled this by testing all 9 virtual king positions (direct +
8 edge-wrapped equivalents). `isSquareUnderAttack` did not, causing the fallback to
mis-classify wrap-around attacks as safe.

KNOWN_ISSUES.md noted this as "perf à surveiller" and deferred to a product decision.

### Decision

Align `isSquareUnderAttack` with `isInCheck`: build 9 virtual target positions and
test each attacker against all of them. `isValidMove` naturally rejects wrap directions
that violate `crossesForbiddenEdge`, so false positives are not introduced.

### Measured overhead

**10 000 calls on a full starting position, mid-game square (3,3):**

| Mode      | Time   | Ratio |
|-----------|--------|-------|
| Classic   | 37 ms  | 1×    |
| Borderless| 153 ms | ~4×   |

The feared ×9 overhead does not materialise in practice: `crossesForbiddenEdge`
provides early exit for the majority of virtual positions, reducing the effective
fan-out to roughly ×4. At ~0.015 ms per call this is negligible for the fallback use
case (called at most a few hundred times per AI turn).

### Consequences

- Fallback move quality in borderless mode improves: wrap-around threats are
  correctly classified as risky.
- Measured perf overhead ~4× vs classic — acceptable; no budget exceeded.
- If the fallback ever needs to scan more squares (e.g. 16×16 Coliseum extension),
  the ×9 loop should be re-measured; it could be short-circuited once an attacker
  is found to avoid redundant checks.
