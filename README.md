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
| `levels` | list the 24 levels / 6 series |
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
- **Methods:** `.append` `.insert` `.extend` `.pop` `.remove` `.copy` `.get` `.update` `.keys` `.clear`
- **Functions:** `def` / call / `return`, local frames, nested calls
- **Builtins:** `print` `len` `type` `id` `str` `int` `bool` `list` `dict` `set`
- **Plotting:** `scatter(xs, ys, "title")` `line(xs, ys, "title")`
- **Operators:** arithmetic, comparisons, `is`, `==`

Not in v0: classes, imports, exceptions (beyond clean parse/runtime errors), comprehensions, I/O, async, `range`/`sorted`/`min`/`max`/`abs`, full CPython semantics.

## Architecture

```
src/engine/    simulated runtime (tokenizer, parser, evaluator, memory, session)
               + goal checks (checks.ts) — the "TreeCompare" analogue
src/levels/    6-series / 24-level catalog + per-level goals, par, solutions
src/ui/        app shell, memory canvas, plot board, REPL, dialog, script editor
src/style.css  design tokens + layout
tests/         vitest unit + level-solution tests
```

Mirrors LGB's separation: `engine` / `visuals` / `levels` / `command line`.

The engine is intentionally a **teaching subset**, not CPython. Every state transition is controlled so the visualizer can show what a real interpreter hides.

## Levels

Six series — Names & Bindings, Aliasing & Copy, Containers in Memory, Mutation & Methods, Functions & Frames, Plotting & Capstone. Each of the 24 levels has a brief, optional hint, a goal (predicate or target snapshot), a statement-par for golf, and a worked solution.

## Tech

TypeScript, Vite, Vitest. No backend, no runtime dependency — the "interpreter" is a hand-written subset whose entire memory graph is inspectable in the browser.

## License

MIT
