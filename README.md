# learn-python

An interactive **Python memory-model** visualizer, sandbox, and 78-level challenge
course — where you watch what happens in RAM, not just read about it.

**Live:** https://alisadeghiaghili.github.io/learn-python/

The architectural sibling of [learnGitBranching](https://github.com/pcottle/learnGitBranching):
a fully client-side simulator with a live canvas, a command shell, and goal-checked
levels. Where LGB makes git's commit DAG visible, learn-python makes Python's
stack/heap object graph visible — and lets you watch a plot grow out of that same
data.

The whole project runs on one idea: **the hard part of Python's data libraries is
not the API, it is identity.** Does `v` *share* `df`'s buffer or own its own? Is
`b` a second name for `a`, or a fresh object? The canvas answers it by drawing the
object graph the way the interpreter holds it, and every level is built to make one
of those questions *visible*.

## The course

**78 levels across 16 series, in three languages (English, German, Farsi),**
starting from zero and ramping to a capstone. Each level carries an **ELI band**
(`ELI5` → `ELI-PHD`) so you know how deep it goes, and the data/concurrency series
have a **deep lesson** — the full ELI5→ELI-PHD ramp with inline diagrams.

```
First Steps  →  Decisions  →  Repeating  →  Functions & Frames
   (print, values, names, math, strings)   (if/elif/else)   (for/range, while)   (def, frames)
        ↓ the memory model arrives
Names & Bindings  →  Containers in Memory  →  Mutation & Methods
   →  Aliasing & Copy  →  Copy Semantics (shallow vs deep)
   →  Iterators & Iterables  →  Defaults & Functional (defaultdict, map, filter)
        ↓ the data libraries
NumPy: Buffers & Views  →  Pandas: Tables as windows over a buffer
        ↓ concurrency
Asyncio (coroutines, tasks, the event loop)
   →  Threading (shared state, the data race, locks)
        ↓
Plotting & Capstone
```

Every level has a brief, an optional hint, a **goal** (a predicate or a target
memory snapshot), a statement **par** for golf, and a worked solution. The test
suite runs every solution against its goal, so the entire catalog is proven
solvable within `par + 2` statements — not merely compilable.

## What you see

Three boards sit side by side, plus a console REPL and a learning-guide panel:

- **Memory** — the core instrument. Stack frames on the left, heap objects on the
  right, amber reference edges between them. Strings are real heap objects, so
  `concat`, `.upper()`, and indexing are all visible.
- **RAM** — the memory map: hex addresses, byte sizes, refcounts, and contiguous
  buffers. An ndarray view paints its offset/shape window as a strip aligned to the
  buffer's bytes, so a *view* and a *copy* look different at the byte level.
- **Plot** — `scatter(xs, ys)` and `line(xs, ys, "title")` render the same data as
  SVG. The memory model and the chart read the identical objects, which is the
  point: a plot is just a list of `(x, y)` pairs.

**Watch it run.** Every run records a step trace; the transport bar under the tabs
(⏮ ◀ ▶ ⏭) scrubs it, so a `for`/`while` loop can be watched iteration by iteration
on the canvas. Diagrams appear inline in lessons wherever a picture beats a
paragraph.

## Run

Open https://alisadeghiaghili.github.io/learn-python/ in a browser, or run it
locally (TypeScript ES modules need a bundler):

```bash
npm install
npm run dev      # → http://127.0.0.1:5173
```

## Test

```bash
npm test         # vitest run — 138 tests
npm run build    # type-check (tsc --noEmit) + production build to dist/
```

## Sandbox

Free-play mode: type Python-subset statements. Meta-commands:

| Command | Effect |
|---------|--------|
| `help` | the subset + meta overview |
| `levels` | list the 78 levels / 16 series |
| `level <id>` | load a level (e.g. `level first-name`) |
| `lesson` | open the current level's lesson |
| `goal` / `guide` | focus the right-hand guide panel |
| `hint` | the level hint |
| `solution` | reveal the solution |
| `golf` | statements used vs par |
| `undo` | undo the last statement |
| `reset` | reset the level / sandbox |
| `sandbox` | free-play mode |
| `script` | toggle the multi-line script editor |
| `clear` | clear the console |

## The Python subset

A deliberately small, pedagogically sharp subset — a hand-written **teaching
simulator**, not CPython. Every state transition is controlled so the visualizer
can show what a real interpreter hides.

- **Literals & types** — `int`, `float`, `str`, `bool`, `None`; `list`, `dict`,
  `tuple`, `set`
- **Names** — assignment, rebinding, augmented assign, indexing, slicing
- **Control flow** — `if` / `elif` / `else`, `for x in …`, `while …`, `break`,
  `continue`; `range(n)`, `range(a, b)`, `range(a, b, step)`
- **String methods** — `.upper`, `.lower`
- **List methods** — `.append`, `.insert`, `.extend`, `.pop`, `.remove`, `.copy`,
  `.clear`
- **Dict methods** — `.get`, `.update`, `.keys`, `.clear`
- **Functions** — `def` / `async def`, calls, `return`, local frames, nested calls
- **Builtins** — `print`, `len`, `type`, `id`, `int`, `str`, `bool`, `range`,
  `iter`, `next`, `map`, `filter`, `reduce`, `list`, `dict`, `set`, `scatter`,
  `line`
- **Operators** — arithmetic, comparisons, `is`, `==`, `and` / `or` / `not`,
  `in` / `not in`
- **Iterators & functional** — `iter(x)` / `next(it)` (a stateful cursor you
  advance by hand); `map(fn, it)` / `filter(pred, it)` are lazy iterator objects;
  `reduce` is an eager fold

**Simulated libraries** — `import X` binds a module whose methods are taught for
their *memory model*, not their full API:

| Import | Taught for |
|--------|-----------|
| `import copy as cp` | `cp.copy` (shallow) vs `cp.deepcopy` |
| `import collections as c` | `c.defaultdict` |
| `import functools as f` | `f.reduce` |
| `import numpy as np` | `np.array` → an ndarray *window* over a separate **buffer** box; `.copy()` mints a new buffer; a slice is a *view* sharing the buffer; `a + 1` vectorizes into a new buffer; `.sum()` |
| `import pandas as pd` | `pd.DataFrame` / `pd.Series` / `pd.read_csv`; `df.iloc[a:b]` is a true *view* (a write through it lands in the frame); `.copy()` is a new buffer; `df["col"]` → Series |
| `import asyncio as a` | `async def`, `a.create_task`, `a.run` — a tick-based event loop that round-robins tasks to their next `await`, so two tasks visibly interleave |
| `import threading as t` | `t.Thread` / `t.Lock`, `.start()` / `.join()`, `.acquire()` / `.release()` — threads share the heap and interleave on it; a held lock blocks the caller (the data race, made visible) |

**Not in this version:** classes, real module imports, exceptions (beyond clean
parse/runtime errors), comprehensions, real I/O, and full CPython semantics. The
curriculum roadmap (re, datetime, pytz, requests, SQLAlchemy, pyodbc,
multiprocessing, matplotlib, plotly) extends the same canvas — see
[docs/CURRICULUM.md](docs/CURRICULUM.md).

## Architecture

```
src/engine/    the simulated runtime — tokenizer, parser, evaluator, memory model,
               record-replay stepper — plus goal checks (checks.ts), the
               "TreeCompare" analogue
src/levels/    the 16-series / 78-level catalog: one file per series, each with
               goals, par, solutions, and deep lessons
src/ui/        app shell, memory canvas, RAM board, plot board, schematic (SVG)
               engine, REPL, dialogs, script editor
src/i18n/      the full trilingual copy (English is the source of truth)
src/style.css  design tokens + layout
tests/         vitest unit, level-solution, schematic, and i18n-coverage tests
```

Mirrors LGB's separation of `engine` / `visuals` / `levels` / `command line`.

## Tech

TypeScript, Vite, Vitest. **No backend, no runtime dependency** — the
"interpreter" is a hand-written subset whose entire memory graph is inspectable in
the browser.

## Docs

- [docs/CURRICULUM.md](docs/CURRICULUM.md) — the design doc: the thesis, the
  0→90 ladder, the ELI bands, the enabling infrastructure, the full catalog, and
  the roadmap.
- [docs/ENGINE-EXTENSION.md](docs/ENGINE-EXTENSION.md) — how to add a library to
  the engine and canvas.
- [docs/adr/](docs/adr/) — architecture decision records (the simulated subset,
  library modules, control flow + record-replay).

## License

[MIT](LICENSE)
