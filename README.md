# LearnPyState

Interactive Python **memory model** visualizer, sandbox, and challenge levels.

**Live:** https://alisadeghiaghili.github.io/learnpystate/

Architectural sibling of [learnGitBranching](https://github.com/pcottle/learnGitBranching): a fully client-side simulator with a live canvas, command shell, goal-checked levels, and statement golf. Where LGB makes git's commit DAG visible, LearnPyState makes Python's stack/heap object graph visible.

## Run

Open https://alisadeghiaghili.github.io/learnpystate/ in a browser.

Locally, open `index.html` via a static server (ES modules need HTTP):

```bash
node scripts/serve.js
# → http://127.0.0.1:5173
```

## Test

```bash
npm test
# node --test tests/engine.test.js tests/levels.test.js
```

## Sandbox

Type Python-subset statements. Meta-commands:

| Command | Effect |
|---------|--------|
| `help` | subset + meta overview |
| `levels` | list challenge packs |
| `level <id>` | load a level |
| `goal` | show the brief |
| `hint` | level hint |
| `golf` | statements used vs par |
| `undo` | undo last statement |
| `reset` | reset level / sandbox |
| `sandbox` | free-play mode |

Supported Python (v0): names, assignment, `list` / `dict` / `tuple`, indexing, slicing, `.append` / `.pop` / `.copy` / `.update` / `.get`, functions with `return`, `print`, arithmetic, `is` / `==`, `type` / `len` / `id` / `str` / `int` / `bool` / `list` / `dict`.

Not in v0: classes, imports, exceptions, comprehensions, I/O, async, full CPython semantics.

## Architecture

```
js/engine/   simulated runtime (tokenizer, parser, evaluator, memory)
js/viz/      SVG stack frames → heap objects → reference edges
js/levels/   level pack + goal compare (TreeCompare analogue)
js/shell/    REPL, undo stack, level flow
css/         design tokens
tests/       node:test unit + level-solution tests
```

The engine is intentionally a **teaching subset**, not CPython. Every state transition is controlled so the visualizer can show what a real interpreter hides.

## Levels

Four packs — Bindings, Aliasing, Containers, Frames. Each level has a brief (lab-note card), optional hint, a goal predicate/snapshot, and a statement-par for golf.

## License

MIT
