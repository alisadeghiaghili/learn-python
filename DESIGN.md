# learn-python — Design Spec

Interactive Python memory visualizer, sandbox, and challenge levels.
Architectural analogue of [learnGitBranching](https://github.com/pcottle/learnGitBranching): a client-side simulator with a live canvas, command shell, and goal-checked levels.

## Product thesis

LGB works because it makes git's *invisible* state (the commit DAG) visible and gameable.
Python's invisible state is the **object memory model**: names in stack frames, objects on the heap, and reference edges between them.

learn-python teaches that model with the same loop:

1. Type a Python statement (or meta-command).
2. Watch stack / heap / edges update.
3. Hit the level goal with fewer statements than par (golf).

No backend. Simulated Python subset (not CPython, not Pyodide) so every state transition is fully controlled and visualizable — same reason LGB fakes git in JS.

## Scope

Supported Python subset (pedagogically sharp, verified against real CPython in CI):

- Literals: arbitrary-precision `int` (BigInt), distinct `float`, `str`, `bool`, `None`
- Names: assignment, rebinding, augmented assignment with in-place mutation semantics (`+=`, `*=`, etc.)
- Containers: `list`, `dict`, `tuple`, `set`, indexing, extended slicing (`[start:stop:step]`), methods (`.append`, `.pop`, `.update`, `.clear`, etc.)
- Control flow: `if`/`elif`/`else`, `for` (with `break`, `continue`, `else`), `while` (with `break`, `continue`, `else`), lazy `range` sequence
- Function definitions: `def`, closures, lexical scope with compile-time local detection, nested calls, default arguments, lambda expressions
- Exceptions hierarchy: `TypeError`, `ValueError`, `IndexError`, `KeyError`, `ZeroDivisionError`, `UnboundLocalError`, `RecursionError`, `ModuleNotFoundError`
- Standard modules & libraries:
  - `math`: `sqrt`, `pi`
  - `copy`: `copy`, `deepcopy`
  - `collections`: `defaultdict`
  - `functools`: `reduce`
  - `numpy`: 1D/2D `ndarray`, vector operations, broadcasting, memory buffer views and `.base`
  - `pandas`: `Series`, `DataFrame`, row-major buffers, `.iloc` views vs copies
  - `matplotlib.pyplot`: `plot`, `scatter`, `bar`, `title`, `xlabel`, `ylabel`, `show`
  - `threading`: `Thread(target=f, args=(x,))`, `Lock`, `with lock:`
  - `asyncio`: coroutines, `create_task`, `await asyncio.sleep(0)`, `gather`, `run`
- Meta: `help`, `levels`, `level`, `goal`, `hint`, `solution`, `undo`, `reset`, `golf`, `script`

Out of pure simulator scope: arbitrary C-extensions and metaclasses. Material requiring real CPython execution (regex `re`, `pytest`, `pydantic`, `SQLAlchemy`, `FastAPI`) runs in the companion Pyodide execution lane (see ADR 006 / Phase 10).

## Architecture

```
src/engine/    simulated Python runtime (tokenizer, parser, evaluator, memory,
               session) + modular libraries (numpy, pandas, asyncio, threading, matplotlib)
               + goal checks (checks.ts)
src/levels/    16-series / 78-level catalog + per-level goals, par, solutions
src/ui/        app shell, memory canvas, plot board, RAM board, REPL, dialog, script editor
src/i18n/      trilingual translations (English, German, Farsi)
tests/         engine unit tests, visualizer tests, and CPython differential harness
```

Mirrors LGB's separation: `engine` / `visuals` / `levels` / `command line`.

### Memory snapshot (the "tree" of this game)

```json
{
  "frames": [{ "name": "<module>", "locals": { "a": "obj_3" } }],
  "heap": {
    "obj_3": { "type": "list", "id": "obj_3", "value": ["obj_1", "obj_2"], "repr": "[1, 2]" }
  }
}
```

Goal check compares a *predicate* or *target snapshot* against current snapshot (LGB's TreeCompare).

## Design pass

### Style anchor

A **CS teaching lab instrument**: dark blueprint workbench for the live memory canvas, warm paper note for the level brief (the only light surface — dialogs read as sticky lab notes). Not a marketing site, not a SaaS dashboard.

### Palette

| Token        | Hex       | Role                                      |
|--------------|-----------|-------------------------------------------|
| `--bg`       | `#0B0F12` | workbench background                      |
| `--panel`    | `#141A1E` | panels (canvas chrome, shell)             |
| `--raised`   | `#1C252A` | raised controls, inputs                   |
| `--ink`      | `#E7EEF2` | primary text                              |
| `--muted`    | `#8FA0A8` | secondary text                            |
| `--amber`    | `#F0A050` | name bindings, reference edges, focus     |
| `--teal`     | `#5BC4B0` | heap objects, success                     |
| `--coral`    | `#F07070` | errors, goal mismatch                     |
| `--paper`    | `#F3EDE3` | level brief surface (only light surface)  |
| `--paper-ink`| `#1A1F22` | text on paper                             |

One accent (amber) owns *references*; teal owns *objects*. That split is the visual grammar of the memory model.

### Typography

- Display: `Fraunces` 600 — level titles, big numbers (golf)
- Body / UI: `IBM Plex Sans` 400/500
- Code: `IBM Plex Mono` 400/500 — REPL, object reprs, variable names

Scale: 11 / 12 / 14 / 16 / 20 / 28 / 40. Line length in the brief ≤ 62ch.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│ learn-python   levels · lesson · hint · solution · undo  │
├───────────────────────────────┬──────────────────────────┤
│  [Memory] [Plot]              │  LEARNING GUIDE (paper)  │
│   CANVAS                       │  title · brief · hint   │
│   [stack frames] → [heap]      │  par / your score        │
│   (or SVG scatter / line)      │  next-step hint          │
├───────────────────────────────┴──────────────────────────┤
│ >>> statement | meta | multi-line …                      │
└──────────────────────────────────────────────────────────┘
```

- Canvas ≈ 60% width; brief ≈ 40%. Below 900px: brief stacks under canvas.
- Spacing rhythm: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Density: dense in the canvas (this is an instrument), airy in the brief (this is prose).

### Signature moments

1. **Reference draw** — assignment draws an amber edge from name → object with stroke-dash animation.
2. **Alias pulse** — when a shared mutable object changes, every inbound edge pulses once together.
3. **Data-to-chart** — `scatter`/`line` reads the same heap lists the Memory canvas shows and draws them as SVG on the Plot tab, so the object graph and the chart agree.

### Motion

- Transform / opacity only. Reference draw 320ms `cubic-bezier(0.32, 0.72, 0, 1)`.
- Respect `prefers-reduced-motion`.

### Interaction model (LGB parity)

| LGB                         | learn-python                      |
|-----------------------------|-----------------------------------|
| git commands in sandbox     | Python statements in sandbox      |
| commit tree updates         | memory graph updates              |
| `levels` / level tabs       | `levels` / level list             |
| goal tree compare           | goal snapshot / predicate compare |
| command golf                | statement golf                    |
| `undo` / `reset`            | `undo` / `reset`                  |
| goal dialog                 | paper brief + learning guide panel|
| (no analogue)               | Plot tab: data → SVG chart        |
| import / build level (later)| level TS catalog (v0: static)     |

## Engineering standards

- Files, code, comments, Markdown: English.
- Engine and UI in **TypeScript** (strict), bundled by **Vite**.
- Unit tests for parser, evaluator, memory compare, and level solutions — **vitest** (`npm test`).
- No AI footprint in repo content.
