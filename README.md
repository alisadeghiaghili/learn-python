# learn-python

Interactive Python **memory model** visualizer, sandbox, and challenge levels.

**Live:** https://alisadeghiaghili.github.io/learn-python/

Architectural sibling of [learnGitBranching](https://github.com/pcottle/learnGitBranching): a fully client-side simulator with a live canvas, command shell, goal-checked levels, and statement golf. Where LGB makes git's commit DAG visible, learn-python makes Python's stack/heap object graph visible — and lets you watch it become a chart.

## Run

Open https://alisadeghiaghili.github.io/learn-python/ in a browser.

Locally, use the Vite dev server (TypeScript ES modules need a bundler):

```bash
npm install
npm run dev
# → http://127.0.0.1:5173
```

## Test

```bash
npm test        # vitest run
npm run build   # type-check (tsc --noEmit) + production build to dist/
```

## Layout

Two live surfaces sit side by side:

- **Memory** — stack frames on the left, heap objects on the right, amber reference edges between them. This is the core instrument.
- **Plot** — `scatter(xs, ys)` and `line(xs, ys, "title")` push a plot spec that renders as SVG on this tab. The memory model and the chart read the same data, which is the pedagogical point: a plot is just a list of `(x, y)` pairs.

Plus a **console** REPL at the bottom (statement or meta-command) and a **learning guide** panel on the right with the level brief, par, and next hint.

## Sandbox

Type Python-subset statements. Meta-commands:

| Command | Effect |
|---------|--------|
| `help` | subset + meta overview |
| `levels` | list the 78 levels / 16 series |
| `level <id>` | load a level (e.g. `level first-name`) |
| `lesson` | open the current level's lesson text |
| `goal` / `guide` | focus the right-hand guide panel |
| `hint` | level hint |
| `solution` | reveal the solution |
| `golf` | statements used vs par |
| `undo` | undo last statement |
| `reset` | reset level / sandbox |
| `sandbox` | free-play mode |
| `script` | toggle the multi-line script editor |
| `clear` | clear the console |

## Supported Python (v0)

A deliberately small, pedagogically sharp subset — not CPython:

- **Literals & types:** `int`, `float`, `str`, `bool`, `None`; `list`, `dict`, `tuple`, `set`
- **Names:** assignment, rebinding, augmented assign, indexing, slicing
- **Control flow:** `if` / `elif` / `else`, `for x in …`, `while …`, `break`, `continue`; `range(n)` / `range(a, b)` / `range(a, b, step)`
- **Methods:** `.append` `.insert` `.extend` `.pop` `.remove` `.copy` `.get` `.update` `.keys` `.clear`
- **Functions:** `def` / call / `return`, local frames, nested calls
- **Builtins:** `print` `len` `type` `id` `str` `int` `bool` `list` `dict` `set`
- **Modules:** `import copy as cp` — `cp.copy` (shallow) and `cp.deepcopy`; `import collections as c` — `c.defaultdict`; `import functools as f` — `f.reduce`; `import numpy as np` — `np.array`, `.copy()`, slicing (views), `+`, `.sum()`; `import pandas as pd` — `pd.DataFrame`, `pd.Series`, `pd.read_csv`; `import asyncio as a`, `import threading as t`
- **Iterators:** `iter(x)` and `next(it)` — a stateful iterator object you advance by hand
- **Functional:** `map(fn, it)` / `filter(pred, it)` — lazy iterator objects; `f.reduce(fn, it)` — an eager fold
- **NumPy:** `np.array` → an ndarray *window* over a separate **buffer** box; `.copy()` mints a new buffer; a slice is a *view* sharing the same buffer; `a + 1` vectorizes into a new buffer; `a.sum()` folds to a scalar
- **Plotting:** `scatter(xs, ys, "title")` `line(xs, ys, "title")`
- **Operators:** arithmetic, comparisons, `is`, `==`, `and` / `or` / `not`, `in` / `not in`

**Watch it run:** every run records a step trace; the transport bar under the board tabs (⏮ ◀ ▶ ⏭) scrubs it, so a `for`/`while` loop can be watched iteration by iteration on the canvas.

Not in v0: classes, real module imports (only the simulated `copy`, `collections`, `functools`, `numpy`, `pandas`, `asyncio`, `threading`), exceptions (beyond clean parse/runtime errors), comprehensions, real I/O, full CPython semantics.

A planned curriculum extends this with pandas, re, datetime and more — all drawn on the same memory canvas. See `docs/ENGINE-EXTENSION.md` and `docs/adr/002-library-modules.md`.

## Architecture

```
src/engine/    simulated runtime (tokenizer, parser, evaluator, memory, session)
               + goal checks (checks.ts) — the "TreeCompare" analogue
src/levels/    16-series / 78-level catalog + per-level goals, par, solutions
src/ui/        app shell, memory canvas, plot board, REPL, dialog, script editor
src/style.css  design tokens + layout
tests/         vitest unit + level-solution tests
```

Mirrors LGB's separation: `engine` / `visuals` / `levels` / `command line`.

The engine is intentionally a **teaching subset**, not CPython. Every state transition is controlled so the visualizer can show what a real interpreter hides.

## Levels

Sixteen series, 78 levels. The course now starts **from zero**: a pure-Python
spine — **First Steps** (print, values, names, math, strings), **Decisions**
(`if`/`elif`/`else`, booleans, comparisons), **Repeating** (`for`/`range`,
`while`, building data, and a "watch the loop run" level), and **Functions &
Frames** — reached before any memory-model vocabulary. Only then does the
memory model arrive: **Names & Bindings**, **Containers in Memory**, **Mutation
& Methods**, **Aliasing & Copy**, **Copy Semantics** (shallow vs deep),
**Iterators & Iterables**, **Defaults & Functional** (defaultdict, map, filter).
Then the data libraries — **NumPy: Buffers & Views**, **Pandas: Tables as
windows over a buffer** — and concurrency — **Asyncio** (coroutines, tasks, the
event loop) and **Threading** (threads, shared state, the data race) — closing
with **Plotting & Capstone**.

Each level has a brief, optional hint, a goal (predicate or target snapshot), a
statement-par for golf, and a worked solution. Every level's own solution is
verified to solve its goal within `par + 2` statements, so the whole catalog is
proven runnable, not just compilable.

## Tech

TypeScript, Vite, Vitest. No backend, no runtime dependency — the "interpreter" is a hand-written subset whose entire memory graph is inspectable in the browser.

## License

MIT
