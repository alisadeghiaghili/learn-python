# LearnPyState — Design Spec

Interactive Python memory visualizer, sandbox, and challenge levels.
Architectural analogue of [learnGitBranching](https://github.com/pcottle/learnGitBranching): a client-side simulator with a live canvas, command shell, and goal-checked levels.

## Product thesis

LGB works because it makes git's *invisible* state (the commit DAG) visible and gameable.
Python's invisible state is the **object memory model**: names in stack frames, objects on the heap, and reference edges between them.

LearnPyState teaches that model with the same loop:

1. Type a Python statement (or meta-command).
2. Watch stack / heap / edges update.
3. Hit the level goal with fewer statements than par (golf).

No backend. Simulated Python subset (not CPython, not Pyodide) so every state transition is fully controlled and visualizable — same reason LGB fakes git in JS.

## Scope (v0)

Supported subset (deliberately small, pedagogically sharp):

- Literals: `int`, `float`, `str`, `bool`, `None`
- Names, assignment, rebinding, augmented assign
- `list`, `dict`, `tuple`, `set`, indexing, slicing, `.append` / `.pop` / `.update`
- Function `def` / call / `return`, local frames, nested calls
- `print`, `type`, `id`, `len`, `is`, `==`, arithmetic, comparisons
- Meta: `help`, `levels`, `level`, `goal`, `hint`, `undo`, `reset`, `hint`, `golf`

Out of scope v0: classes/OOP, imports, exceptions (except parse/runtime errors shown cleanly), comprehensions beyond simple cases, I/O, async.

## Architecture

```
js/engine/     simulated Python runtime (heap, frames, parser, evaluator)
js/viz/        SVG canvas: stack frames → heap objects → reference edges
js/levels/     level pack + memoryCompare (goal checker) + golf
js/shell/      command line, history, undo stack, dialogs
index.html     app shell
css/app.css    design tokens + layout
tests/         engine + compare unit tests (node --test)
```

Mirrors LGB's separation: `git engine` / `visuals` / `levels` / `command line`.

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
│ LEARNPYSTATE   sandbox · levels · undo · reset    golf 3 │
├───────────────────────────────┬──────────────────────────┤
│                               │  LEVEL BRIEF (paper)     │
│   MEMORY CANVAS               │  title · goal · hint     │
│   [stack frames] → [heap]     │  target mini-canvas      │
│                               │  par / your score        │
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

### Motion

- Transform / opacity only. Reference draw 320ms `cubic-bezier(0.32, 0.72, 0, 1)`.
- Respect `prefers-reduced-motion`.

### Interaction model (LGB parity)

| LGB                         | LearnPyState                      |
|-----------------------------|-----------------------------------|
| git commands in sandbox     | Python statements in sandbox      |
| commit tree updates         | memory graph updates              |
| `levels` / level tabs       | `levels` / level list             |
| goal tree compare           | goal snapshot / predicate compare |
| command golf                | statement golf                    |
| `undo` / `reset`            | `undo` / `reset`                  |
| goal dialog                 | paper brief + target mini-canvas  |
| import / build level (later)| level JSON (v0: static pack)      |

## Engineering standards

- Files, code, comments, Markdown: English.
- Python-sim engine in TypeScript-free ES modules with full JSDoc (`Args`, `Returns`, `Throws`).
- Unit tests for parser, evaluator, memory compare — `node --test`.
- No AI footprint in repo content.
