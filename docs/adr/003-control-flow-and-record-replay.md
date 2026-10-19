# learn-python — ADR 003: Add control flow, and teach it by recording then replaying

## Status

Accepted

## Context

The course is an interactive Python **memory model** visualizer, but the subset had no control
flow: no `if`/`for`/`while`, no `range`. Two problems followed from that.

1. **The course started from the middle.** The simplest concepts — printing, naming a value, a
   decision, a loop — are what a learner with zero Python actually needs first. But they were the
   *last* things taught (or absent), while aliasing, numpy, and threading came early. A brand-new
   learner landing on level 1 was shown `stack frame` / `heap` vocabulary before they had written a
   single line that did anything.
2. **Loops were the one thing the canvas could not show.** The signature feature is watching state
   change. But the interpreter ran a whole submission in one tick and drew only the *final* state.
   A `for` loop is fundamentally a *sequence* of states, and the final state alone loses the lesson
   ("the same line runs again and again").

The fix had to be real: to start "from zero," the engine genuinely needed `if`/`for`/`while`/
`range`, and to make loops visible it needed to be able to *show the intermediate states*.

## Decision

Two additive, orthogonal changes.

**1. Control flow in the subset.** The tokenizer already emitted the keywords and
`INDENT`/`DEDENT` (the `def` block parsing relied on them), so adding control flow touched only the
parser and evaluator:

- `parser.ts`: a `parseSuite()` helper (the indented-block loop `def` already used) is shared by
  `parseIf` / `parseFor` / `parseWhile`, so nested blocks recurse for free.
- `evaluator.ts`: `case 'If'` / `case 'For'` / `case 'While'` / `case 'Break'` / `case 'Continue'`
  in `execStatement`, plus `range(n[, stop[, step]])` as a builtin. `break`/`continue` are
  marker exceptions caught by the enclosing loop. A `while` guard caps iterations so a
  beginner's `while True` cannot hang the browser.
- **Strings become heap objects.** String *literals* now allocate a heap `str` object (the rest of
  the subset already did for lists/dicts). This keeps every `str` code path — concatenation,
  `.upper()`, indexing, `in`, looping over a word — uniform and, crucially, *visible on the canvas*,
  consistent with the "make identity visible" thesis.

**2. Record, then replay.** Rather than build a program-counter interpreter with pause/resume, the
evaluator *records*: when capture is on, after every top-level statement and after every loop
iteration it appends a deep `cloneState(state)` to `state.trace` (capped at 60 frames; the growing
array is stripped from each clone so frames never nest). The UI then *replays*: a transport bar
(⏮ ◀ ▶ ⏭) under the board tabs scrubs the recorded frames, painting each through the existing
`renderMemory`/`renderRam`.

Record-replay was chosen over a live PC-based stepper on purpose: "watch the loop" only needs the
*history*, and cloning already-built state is far less machinery than pausing mid-execution. If
interactive stop-and-resume is ever needed, the trace is the right foundation to build on.

`MemoryState.trace` is a pure replay aid — `snapshot()`, goals, and predicates never read it, and
`recordStep` is a no-op when capture is off — so the solvability gate and existing tests are
unaffected.

## Consequences

- **The course opens from zero.** New pure-Python series — `basics` (print, values, names, math,
  strings), `flow` (booleans, comparisons, `if`/`elif`/`else`), `loops` (`for`/`range`, `while`,
  building data, and the "watch the loop run" level) — come first, with no memory-model vocabulary.
  The memory model (`names` → `containers` → `mutation` → `aliasing` → `copy-semantics`) is the
  second layer. `functions` (which introduces `def`) is moved before the library and concurrency
  series that call functions, and `mutation` (`.append`) before the series that mutate lists.
- **Every run is scrubbable.** Trace capture is on by default in the UI, so the learner can step
  through any run; the `loops` series has a level built on it.
- **The subset is now a real (small) Python.** `if`/`for`/`while`/`range` and string identity on the
  canvas are honest features, documented in the README and `docs/CURRICULUM.md`. The fidelity
  boundary (no real I/O, simulated libraries) is unchanged.
- **Cost:** one `cloneState` per step, bounded by the 60-frame cap. `cloneState` is a JSON deep
  clone; at this size it is invisible in the browser.
