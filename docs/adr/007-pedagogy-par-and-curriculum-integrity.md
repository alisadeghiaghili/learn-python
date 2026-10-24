# learn-python — ADR 007: Pedagogy, Golf Par Invariants, and Content Integrity

## Status

Accepted

## Context

The initial curriculum contained several pedagogical and technical defects:
1. German translations in `src/i18n/de-g2.ts` lagged behind English and Farsi corrections, incorrectly claiming small ints are non-object values stored in frames without heap representation and that assignment copies values.
2. Conceptual claims in NumPy and Pandas lessons diverged from real Python (e.g. calling NumPy view lifecycles a "memory-safety trap", when Python reference counting prevents use-after-free via `view.base`; and omitting Pandas 3.0 Copy-on-Write defaults).
3. Level `rebind-in-fn-is-local` passed after typing `x = 1` alone because its goal was `vars: { x: 1 }` with empty starter code, never testing functions or showing scope boundaries.
4. The dock featured a giveaway "try" button containing the literal next solution line, and briefs frequently stated the exact code to type rather than describing the goal.
5. Par ratings were loose or inconsistent (e.g. `elif-ladder` par 9 for 6 lines; `first-if` par 2 for 3 lines).
6. Post-level completion popped up two separate sequential modals (celebration followed by lesson), with random cheer messages ("Nice — you traced the alias" on `hello-world`).
7. ELI bands were defined in types but never rendered in the UI.

## Decision

1. **Content and Pedagogy Alignment**:
   - Corrected all lesson text, briefs, and field notes across EN, DE, and FA.
   - Established `docs/ERRATA.md` to track all historical and resolved discrepancies against real CPython.
   - Rebuilt `rebind-in-fn-is-local` with starter code and dual-variable assertions (`x = 1`, `y = 2`) that require function invocation and explain compile-time local detection and `UnboundLocalError`.

2. **Strict Statement Par Invariant**:
   - Recomputed pars so reference solutions satisfy $used \le par \le used + 1$.
   - Enforced this invariant in `tests/levels.test.ts` for all 78 levels.
   - Added visual distinction for on-par (★★★) versus over-par (★★☆) completions.

3. **Autonomous Learning over Spoon-feeding**:
   - Replaced dock giveaway autocomplete chips with pending goal checklists and graduated hint flows.
   - Merged the celebration modal and level lesson into a unified single modal containing key takeaways and lesson summaries, allowing learners to advance directly to the next level.

4. **ELI Band Visibility and Markdown Rendering**:
   - Rendered localized ELI badges (`Beginner`, `Elementary`, `Intermediate`, `Advanced`, `Master`) across the header, dock, and levels catalog.
   - Sanitized inline markdown rendering (`renderInline`) to prevent raw asterisks and backticks from leaking into the UI.

## Consequences

- All 78 levels have mathematically sound par thresholds and verifiable solutions.
- The UI provides an engaging, self-directed learning experience aligned with Python's genuine object model.
