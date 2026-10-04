# Engine Extension — teaching libraries on the memory canvas

This document specifies **how** the simulated subset is extended to teach the standard and
data-science libraries (numpy, pandas, re, datetime, pytz, requests, beautifulsoup,
SQLAlchemy, pyodbc, matplotlib, plotly) plus core concepts (iterator, iterable, defaultdict,
map, filter, reduce, pickle, h5py), **all on the same memory canvas**.

It is grounded in the current engine. Every change is additive to an existing dispatch table;
nothing in `engine/`, `levels/`, or `ui/` is rewritten. See ADR 002 for the *why*.

---

## 0. What already exists (and why it makes this cheap)

The memory graph is **data, not logic**. A heap object is just

```ts
// src/engine/memory.ts:30
{ id: 'obj_7', type: 'list', value: RtValue, repr: '[...]' }
```

where `value` mixes primitives with `obj_*` id strings. From that one fact the engine already:

- **derives reference edges** — `nestedRefs` (memory.ts:86) and `containerRefs` (ui/memory.ts:125)
  walk a container's slots for `obj_*` strings and return them;
- **draws them** — `renderMemory` (ui/memory.ts:103-114) renders name→object edges and
  container→child edges with the amber draw animation;
- **checks goals** — `checkGoal` + `preds` (checks.ts:49, 145) read a normalized `Snapshot`
  (ids rewritten to `h_*`) and assert facts about it.

Two consequences drive the whole design:

1. **Shallow copy already renders.** A shallow `.copy()` (evaluator.ts:426) allocates a new box whose
   `value` *reuses* the parent's nested `obj_*` ids; a deep copy would allocate fresh children. The
   "two boxes point at one shared child" picture that makes shallow-vs-deep *click* is drawn for free.
2. **Adding a library = filling tables**, not writing a new runtime.

---

## 1. The five extension points (with anchors)

| # | Concern | Anchor (current) | Additive change |
|---|---------|------------------|-----------------|
| 1 | New value shape | `allocObject(type, value, repr)` — memory.ts:30 | `type` is a free string. New library types are just new `type` values + a documented `value` shape in `types.ts`. **No schema change.** |
| 2 | Construction / methods | `evalCall` (evaluator.ts:253) dispatches builtins by `name`; `callMethod` (evaluator.ts:381) dispatches by `obj.type` | New builtins: add a `if (name === …)` branch. New methods (incl. module methods): add a `if (obj.type === …)` block. |
| 3 | `import` | parser `parseStatement` (parser.ts:61); `execStatement` (evaluator.ts:49) | **The only genuinely new mechanism.** Add an `Import` AST node + one `execStatement` case. |
| 4 | Goals / predicates | `preds` (checks.ts:145); `checkGoal` (checks.ts:49) | Add predicate builders and, only if a goal needs a new *shape*, a `goal.type` branch. |
| 5 | Canvas drawing | `drawObject` (ui/memory.ts:201), `objectHeight` (ui/memory.ts:136), `containerRefs` (ui/memory.ts:125) | `drawObject` already renders any unknown type as a labeled box. Add per-type cell layout + height. **Free for most types.** |

The recurring pattern is a **dispatch table keyed on `type`/`name`**. A library is one row each.

---

## 2. `import` = a module object (the one new mechanism)

### 2.1 Key observation

`np.array([1, 2])` parses to a `Call` whose `func` is an `Attribute`
(object `np`, attr `array`). `evalCall` **already** resolves `np` and calls
`callMethod(np, 'array', [ … ])` (evaluator.ts:333-336). So once `np` is *bound*, **no parser
change is needed for any call** — only for the `import` statement itself.

### 2.2 Design

- `import numpy as np` → allocate a module object `{ id, type:'module', name:'numpy', value:{} }`
  and bind the local `np` to it.
- `import os` → binds `os`; `from X import y` (if needed later) binds `y` to a member object.
- Every library API is implemented as a **method on the module object**, i.e. an `if
  (obj.type === 'module' && obj.name === 'numpy')` block inside `callMethod`.

```ts
// evaluator.ts callMethod — additive block
if (obj.type === 'module' && obj.name === 'numpy') {
  if (method === 'array')  return makeNdarray(args, state);
  if (method === 'linspace') return makeNdarray(linspace(args, state), state);
  // …
}
```

This keeps the *only* new parsing in one statement and reuses the exact dispatch pattern used by
`list`/`dict`.

### 2.3 Parser change (small, isolated)

`parseStatement` (parser.ts:61) gains a case for `import`: read `NAME`, optional `as NAME`,
consume the newline → `AstNode { kind:'Import', name, alias, line }`. `execStatement`
(evaluator.ts:49) gains `case 'Import': bindModule(node, state)`.

---

## 3. The one new primitive: stateful iterator objects

iterator / iterable / map / filter all need a value shape that **holds a reference to another
object plus internal state**:

```ts
// types.ts — new heap type
{ id:'obj_12', type:'listiter', value:{ source:'obj_5', index:0 }, repr:'<list_iterator at 0x…>' }
```

`map`/`filter`/generators are the same shape with an extra `fn` (a function-object id) and, for
filter, a `pred` id. This is the **single new value shape the whole program needs**.

Three small changes:

| Point | Anchor | Change |
|-------|--------|--------|
| Keep it alive + draw its edge | `nestedRefs` (memory.ts:86), `containerRefs` (ui/memory.ts:125) | add: `if (type==='listiter'\|\|'map'\|\|'filter'\|\|'generator') return [value.source]` |
| Build + advance | `evalCall` (evaluator.ts:256) | two builtins: `iter(x)` and `next(it)`. `next` bumps `value.index`, returns the element, or throws `StopIteration`. |
| Target it | `preds` (checks.ts:145) | `isIterator`, `nextReturns(v)`, `exhausted` |

**`iterable` vs `iterator`** is taught by the contrast: `iter(iterable)` returns a *fresh iterator*
object each call. Two calls over the same list → two separate iterator boxes over the *same* list box —
aliasing (series S2) applied to iterators.

**`for` is out of the subset** (ADR 001: control flow in v0). Consumption is taught with explicit
`next(it)`, which is *deliberately better here*: each step is visible on the canvas (index 0→1→2,
then `StopIteration`), whereas `for` would hide consumption. The lesson states the real idiom
(`for x in it:`) and that it is syntactic sugar over `next()`.

### map / filter / reduce

- `map(fn, it)` / `filter(pred, it)` → a lazy iterator object whose `value` carries `source`, `fn`
  (function-object id), and `index`. `next` pulls from the source, applies the function, returns.
  The canvas shows a **reference chain**: `mapobj → iterator → list`, plus the `fn` box — the
  functional shape made visible.
- `reduce(fn, it)` — not lazy; a fold returning a value. Capped: one level, noted as interview/common
  rather than core. `import functools as f` → `f.reduce`.

---

## 4. The `import numpy as np` example end-to-end

`np.array([1, 2, 3])` → `Call(func=Attribute(np, array), args=[List])`. `evalCall` resolves `np`
(the module object) → `callMethod(module:numpy, 'array', [listId])`. The numpy block allocates an
**ndarray** whose `value` points at a **buffer** box:

```
np  (module)                     a   (ndarray)  ──→  buffer (float64[3])
                                     repr "[1. 2. 3.]"      [1, 2, 3]
```

- `.copy()` → new ndarray → **new buffer**.
- `a[:2]` (slice) → new ndarray with `view: true` → **same buffer** (a numpy view is a reference
  onto the buffer). This is the flagship identity concept and reuses the *exact* aliasing teaching
  from S2, now on ndarrays.

---

## 5. Per-library contract + inventory

Every library `L` is built by filling this contract:

1. **module object** — `import L as x`
2. **value type(s)** — one or more `type` strings + their `value` shape (documented in `types.ts`)
3. **constructors** — methods on the module (`L.array`, `L.DataFrame`, …)
4. **methods** — `callMethod` branches
5. **repr + canvas** — compact `repr` for the box + per-type `drawObject`/`objectHeight` (free if the
   default box suffices)
6. **predicates** — what a goal asserts
7. **levels** — one series (5-ladder, see §7)

### Type inventory (value shapes)

| Library | `type` | `value` shape | Canvas box |
|---------|--------|---------------|------------|
| `copy` | *(none — reuses list/dict)* | — | *(existing)* |
| `numpy` | `ndarray` | `{ buffer: id, shape, dtype, view?: bool }` | ndarray box → buffer box (grid) |
| `pandas` | `Series` / `DataFrame` | `{ buffer: id, index, columns?, dtype }` | box → buffer; DF shows column headers |
| `beautifulsoup` | `DomNode` | `{ tag, children: id[] }` | **heap tree** (parent→child edges) |
| `re` | `Pattern` / `Match` | `{ source }` / `{ span, groups: id[] }` | box + group chips |
| `datetime` | `Datetime` / `TZ` | `{ iso }` (immutable) | box (identity = value) |
| `pytz` | `TZ` | `{ zone }` | box |
| `requests` | `Response` | `{ status, body: id }` | box → body → (`.json()` → dict) |
| `SQLAlchemy` | `Model` / `Session` | `{ table }` / `{ models: id[] }` | boxes + 1-to-many links |
| `pyodbc` | `Connection` / `Cursor` | `{ dsn }` / `{ rows: id[] }` | box → row boxes |
| `matplotlib` | `Figure` / `Axes` | `{ axes: id[] }` / `{ artists: id[] }` | box + artist chips |
| `plotly` | `Figure` | `{ data: id[] }` | box + data chips |
| `pickle` | `Bytes` | `{ source: id, frozen: true }` | bytes box "→ frozen graph of X" |
| `h5py` | `H5File` / `H5Dataset` | `{ path }` / `{ buffer: id }` | box → dataset → buffer |

### pandas specifics

- **`loc` / `iloc`** — extend `Subscript` (evaluator.ts:680) and `bindTarget` (evaluator.ts:125) to
  a DataFrame/Series: `df.loc[rowLabel, colLabel]` (label-based) vs `df.iloc[0, 1]` (integer
  position). Same `Subscript` AST; the object's `type` selects the semantics.
- **I/O** — `read_csv('x.csv')`, `to_csv`, `to_excel`, `read_excel`: see §6 fidelity boundary.
  `read_*` allocates a DataFrame box labeled with the source filename; `to_*` allocates an `Export`
  box. The teaching point is the *structure of the resulting object*, not disk access.

### core specifics

- **defaultdict** — a `dict` box that carries a `factory` (function-object id); missing-key read
  allocates the default. Renders as a dict with a "⚙ factory" tag.
- **pickle** — `dumps(x)` → a `Bytes` box that records the *object graph* (ids reachable from `x`);
  `loads` → **fresh** boxes with the **same aliasing** as the source. This is deep-copy-via-bytes and
  ties directly to the shallow/deep copy phase.

---

## 6. Fidelity boundary (stated honestly, in every lesson)

The sandbox **cannot read/write real files** and **has no `for`**. Therefore:

- I/O levels model the **result object** + the **serialization meaning**, not real disk. A level for
  `read_csv` checks that a DataFrame with the expected columns/rows exists on the canvas.
- Pickle/h5py levels check the **graph semantics** (frozen graph, restored aliasing, dataset→buffer),
  not on-disk bytes.
- Iterator consumption is **`next()`-driven** (visible), with the `for` idiom named in the lesson.

This is a *feature* of a memory-model tool, not a defect: it forces the learner to see the object
graph, which is the whole point.

---

## 7. Phases (0 → 90) and effort

Each library runs the same 5-ladder: mental model (0→20) → daily API (20→45) → real patterns
(45→65) → depth/gotchas (65→80) → capstone project (80→90). The "90" is reached by the **capstone
project**, not by lessons alone.

```
Phase 0 — Core Python (expanded)  ──────────────────────────
  0a. copy / deepcopy            shallow vs deep        (no new heap type)
  0b. iterator / iterable        NEW PRIMITIVE, most on-canvas
  0c. defaultdict
  0d. map / filter / reduce      lazy iterator chains
Phase 1 — numpy        view vs copy on buffers (flagship)
Phase 2 — pandas       loc/iloc → read_csv/to_csv/to_excel → groupby
Phase 3 — Serialization  pickle (freeze the graph) ; h5py (File/Dataset)
Phase 4 — beautifulsoup  HTML → heap tree
Phase 5 — re + datetime + pytz
Phase 6 — requests     Response + r.json() → dict
Phase 7 — SQLAlchemy + pyodbc
Phase 8 — matplotlib + plotly  (Figure/Axes = object, not magic)
Phase 9 — capstones (multi-library)
```

Ordering is deliberate: **Phase 0 first** because (a) it is foundational and (b) the iterator
primitive it introduces is reused by pandas iterators later. **numpy** is the flagship for the
identity thesis (view vs copy). **matplotlib/plotly** are last and weakest on-canvas (their point is
output, not identity) — they only get "Figure/Axes are objects."

### Risk & controls

| Risk | Control |
|------|---------|
| `import` parsing entangles | one isolated `Import` node; parse tests before/after |
| `callMethod` grows | per-type handler helpers if needed (refactor, not rewrite) |
| repr fidelity (DF tables) | compact repr for the box, not the full table |
| scope creep ("real numpy") | cap to identity semantics + "daily 80%" per ladder; no real math/I/O |
| unknown-type rendering gaps | `drawObject` already falls back to a labeled box; add only where it matters |

---

## 8. Build order (recommended)

1. **Phase 0a** (copy/deepcopy) — no new heap type; proves the "shared child" teaching renders.
2. **Phase 0b** (iterator/iterable) — the one new primitive; also the most on-canvas.
3. **Phase 0c/0d** (defaultdict, map/filter/reduce) — reuse iterator + module dispatch.
4. **Phase 1** (numpy) — first module with a buffer-backed type; validates the `import` path.
5. Continue through Phase 9, each phase: engine → canvas → predicates → tests → levels.

Every phase ships with: engine change, `renderMemory` (if not free), new `preds`, unit tests in
`tests/`, and level entries in `src/levels/index.ts`. Tests run with `npm test` (vitest).
