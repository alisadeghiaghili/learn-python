# learn-python

An interactive **Python memory-model** visualizer, sandbox, and 123-level challenge
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

**123 levels across 25 series, in three languages (English, German, Farsi),**
starting from zero and ramping to a capstone. Each level carries an **ELI band**
(`ELI5` → `ELI-PHD`) so you know how deep it goes, and the data/concurrency series
have a **deep lesson** — the full ELI5→ELI-PHD ramp with inline diagrams.

```
First Steps  →  Decisions  →  Repeating  →  Functions & Frames
   (print, values, names, math, strings)   (if/elif/else)   (for/range, while)   (def, frames)
        ↓ the memory model arrives
Names & Bindings  →  Containers in Memory  →  Mutation & Methods
   →  Aliasing & Copy  →  Copy Semantics (shallow vs deep)
   →  Slicing & Strides  →  Recursion & Call Stack
   →  Iterators & Iterables  →  Closures & Generators
   →  Defaults & Functional (defaultdict, map, filter)
        ↓ the data libraries & ecosystem
NumPy: Buffers & Views  →  Pandas: Tables as windows over a buffer
   →  Regular Expressions  →  Type Annotations & Pydantic
   →  Docstrings & Doctests  →  Testing with pytest
   →  SQLAlchemy & ORM Identity Map
        ↓ concurrency & production
Asyncio (coroutines, tasks, the event loop)
   →  Threading (shared state, the data race, locks)
   →  Production Engineering (env vars, logging, FastAPI)
        ↓
Plotting & Capstone
```

Every level has a brief, graduated hints, a **goal** (a predicate or a target
memory snapshot), a statement **par** for golf, and a worked solution. The test
suite runs every solution against its goal, so the entire catalog is proven
solvable within par statements ($used \le par$) — verified against real CPython in CI.

## What you see

Three boards sit side by side, plus a console REPL and a learning-guide panel:

- **Memory** — the core instrument. Stack frames on the left, heap objects on the
  right, amber reference edges between them. Strings are real heap objects, so
  `concat`, `.upper()`, and indexing are all visible.
- **RAM** — the memory map: hex addresses, byte sizes, refcounts, and contiguous
  buffers. An ndarray view paints its offset/shape window as a strip aligned to the
  buffer's bytes, so a *view* and a *copy* look different at the byte level.
- **Plot** — `plt.plot(xs, ys)`, `plt.scatter(xs, ys)`, and `plt.bar(xs, ys)` render data as
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
npm test         # vitest run — 399 passing tests including differential CPython tests
npm run build    # type-check (tsc --noEmit) + production build to dist/
```

## Sandbox

Free-play mode: type Python-subset statements. Meta-commands:

| Command | Effect |
|---------|--------|
| `help` | the subset + meta overview |
| `levels` | list the 123 levels / 25 series |
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
- **Functions** — `def` / `async def`, calls, `return`, local frames, nested calls, closures, default arguments, compile-time local scoping
- **Builtins** — `print`, `len`, `type`, `id`, `int`, `str`, `bool`, `range`, `iter`, `next`, `map`, `filter`, `reduce`, `list`, `dict`, `set`, `abs`, `min`, `max`, `sum`
- **Operators** — arithmetic, comparisons, `is`, `==`, `and` / `or` / `not`, `in` / `not in`, augmented assignments (`+=`, `*=`)
- **Exceptions** — `TypeError`, `ValueError`, `IndexError`, `KeyError`, `ZeroDivisionError`, `UnboundLocalError`, `RecursionError`, `ModuleNotFoundError`
- **Iterators & functional** — `iter(x)` / `next(it)` (stateful cursor); `map(fn, it)` / `filter(pred, it)` (lazy iterators); `reduce` (eager fold)

**Simulated libraries** — `import X` binds a module whose methods are taught for
their *memory model*, not their full API:

| Import | Taught for |
|--------|-----------|
| `import copy as cp` | `cp.copy` (shallow) vs `cp.deepcopy` |
| `import collections as c` | `c.defaultdict` |
| `import functools as f` | `f.reduce` |
| `import math` | `math.sqrt`, `math.pi` |
| `import numpy as np` | `np.array` → an ndarray *window* over a separate **buffer** box; `.copy()` mints a new buffer; a slice is a *view* sharing the buffer; `a + 1` vectorizes into a new buffer; `.sum()`, broadcasting |
| `import pandas as pd` | `pd.DataFrame` / `pd.Series` / `pd.read_csv`; `df.iloc[a:b]` is a true *view* (a write through it lands in the frame); `.copy()` is a new buffer; `df["col"]` → Series |
| `import matplotlib.pyplot as plt` | `plt.plot`, `plt.scatter`, `plt.bar`, `plt.title`, `plt.xlabel`, `plt.ylabel`, `plt.show()` |
| `import asyncio as a` | `async def`, `a.create_task`, `await a.sleep(0)`, `a.run` — a tick-based event loop scheduling ready tasks |
| `import threading as t` | `t.Thread(target=f, args=(x,))` / `t.Lock`, `with lock:`, `.start()` / `.join()` — threads share the heap and interleave |

**Two execution lanes:** The hand-written TypeScript simulator provides deterministic step-by-step visual control for memory model, aliasing, and buffer inspection. Material requiring full CPython libraries (`re`, `pydantic`, `pytest`, `SQLAlchemy`, `FastAPI`) runs on the companion Pyodide execution lane (see ADR 006 / Phase 10).

## Architecture

```
src/engine/    the simulated runtime — tokenizer, parser, evaluator, memory model,
               record-replay stepper — plus goal checks (checks.ts), the
               "TreeCompare" analogue
src/levels/    the 25-series / 123-level catalog: one file per series, each with
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

## Privacy & Offline PWA

- **100% Client-Side:** Code execution, memory state, and level progress remain completely local in your browser (`localStorage`). No user code or personal data is transmitted to any server.
- **Installable Offline PWA:** A service worker precaches application assets so the course works completely offline after first load.
- **Anonymous Visitor Counter:** A lightweight, anonymous counter service records unique browser visits without cookies, IP addresses, or personal tracking data. It loads on user interaction and fails silently if blocked or offline.

## Docs

- [docs/CURRICULUM.md](docs/CURRICULUM.md) — the design doc: the thesis, the
  0→90 ladder, the ELI bands, the enabling infrastructure, the full catalog, and
  the roadmap.
- [docs/ENGINE-EXTENSION.md](docs/ENGINE-EXTENSION.md) — how to add a library to
  the engine and canvas.
- [docs/adr/](docs/adr/) — architecture decision records (the simulated subset,
  library modules, control flow + record-replay).
- [docs/COMPETITIVE-LANDSCAPE.md](docs/COMPETITIVE-LANDSCAPE.md) — how the project
  compares with other Python learning tools, its gaps, and the positioning that
  follows from them.

## License

[MIT](LICENSE)
