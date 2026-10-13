# The learn-python curriculum

This is the design document for the teaching program: **what we teach, how hard
it is, and how each piece is built on the memory canvas.** It is the map that
every new library and every deep lesson hangs off. If you are adding a series,
start at [§2 Enabling infrastructure](#2-enabling-infrastructure) and
[§6 Roadmap](#6-roadmap-the-090-plan), and follow the checklist at the end.

The engine itself is documented in [ENGINE-EXTENSION.md](ENGINE-EXTENSION.md);
this document is about the *curriculum* that runs on it.

---

## 1. The Model

### 1.1 One thesis: make identity visible

Everything here is built on a single idea: **the hard part of data libraries is
not the API — it is identity.** Does `v` *share* `df`'s data, or does it own its
own? Is `b` a second name for `a`, or a fresh object? Where does the data actually
live, and who can see a write to it?

The memory canvas answers that by drawing the object graph the way the interpreter
holds it: names on the stack, mutable objects on the heap, amber edges for
references. The whole program is engineered so that **the lesson is a picture you
can watch change** — not a paragraph you have to imagine.

### 1.2 What "85% full professional" means

We do not pretend to be CPython. We model **the memory model of each library to
~85%** — the identity, structure, and ownership semantics a professional actually
relies on — and we stop honestly at the boundary where a real runtime matters
(real I/O, a real event loop, real numerics). That boundary is stated in every
lesson (§1.7), not hidden.

- **Covered (the 85%):** shared vs owned buffers, view vs copy, aliasing,
  reference counts, object structure, what an expression *builds* vs what it
  *shares*, the shape a result has.
- **Out of scope (and said so):** real disk/network I/O, real floating-point
  results, real wall-clock concurrency, a real scheduler.

"Professional" is a claim about *depth of model*, not breadth of API. A
professional pandas user's instinct about `df.iloc[1:3]` — *that's a view, it
shares the frame* — is exactly what we teach, and we teach it so it's visible.

### 1.3 The five-ladder (0 → 90)

Every library is taught on the same five rungs. "90" is reached by the **capstone
project**, not by lessons alone — the ladder is a path, and the capstone is where
the pieces are assembled into something real.

| Rung | Range | What the learner can do |
|------|-------|--------------------------|
| 1. Mental model | 0 → 20 | Name the core object(s) and what "the data lives in" is. |
| 2. Daily API | 20 → 45 | Build the object, read it, do the two or three things everyone does. |
| 3. Real patterns | 45 → 65 | Compose: selection, transforms, the idioms you use in production. |
| 4. Depth / gotchas | 65 → 80 | The foot-guns: the shared buffer that bites, the view that mutates the source. |
| 5. Capstone | 80 → 90 | A multi-step task that uses the whole ladder in one level. |

Each **series** in the catalog is one library running this ladder. A series has
roughly one level per rung, so a five-level series spans ELI10 (rung 1/2) up to a
capstone on rung 4/5.

### 1.4 ELI bands — a first-class attribute

Each level carries an `eli` band. This is **not a report of difficulty — it is a
teaching target**, and it is woven through the levels *and* the lessons:

| Band   | Difficulty | "Explain it like I'm…" | Ladder range |
|--------|------------|--------------------------|--------------|
| `eli5`   | 1 | a curious beginner | 0 → 10 |
| `eli10`  | 2 | a motivated newcomer | 10 → 25 |
| `eli15`  | 3 | a working dev | 25 → 45 |
| `eli20`  | 4 | an experienced dev | 45 → 65 |
| `eliphd` | 5 | a specialist / "post-graduate" | 65 → 90 |

The catalog invariant enforces the pairing (`eli` ↔ `difficulty`) and that the
catalog spans all five bands. A **deep lesson** (per series) must ramp through the
core bands — it is structured as `## ELI5 … ## ELI10 … ## ELI15 … ## ELI20 …
## ELI-PHD` — so the same idea is re-explained from each altitude. See §4.

### 1.5 The RAM view — a second way to see the same state

The Memory tab draws the *graph* (who references whom). The **RAM tab**
(`renderRam` in `src/ui/memory.ts`) draws the *layout*: a memory map with columns
`ADDR · OBJ · TYPE · BYTES · REFC · VALUE`.

- **ADDR** — a stable, monotonic hex address (models malloc: addresses are never
  reused). It makes "this is a *place*" concrete.
- **BYTES** — an approximate CPython-ish size (16-byte header + payload).
- **REFC** — the live reference count, recomputed after every statement. A buffer
  at `REFC 2` is *shared*; that is the shared-buffer fact, read off a number.
- **VALUE** — for a buffer, the raw byte cells; for a view, a color-coded window
  strip aligned to those cells.

The RAM fields live on `HeapObject` (`addr`/`byteSize`/`refCount`/`seg`) and are
**deliberately invisible to the abstract model**: `snapshot()`, goals, and
predicates never read them. The RAM view is a pure teaching aid over the same
state the Memory tab uses.

### 1.6 Schematics — a picture in a lesson

Some ideas are just clearer as a static diagram than as a live canvas. A
**schematic** (`src/ui/schematic.ts`) is a small declarative spec —
`{ id, title, nodes, edges, legend? }` — rendered to a self-contained inline SVG
via a ` ```schematic ` fenced block in `renderMarkdown`. It uses the same palette
as the canvas, so a diagram and the live board read as the same language.

Schematics are for the *shape* of an idea (view-vs-copy, a frame push/pop, a
refcount graph); the live canvas is for *watching it happen*. Both live in the
same lesson. The full inventory is in §5.

### 1.7 The fidelity boundary

The sandbox cannot read files, run a real event loop, or do real numerics. So we
model **the result object and the meaning of the operation**, and we say plainly
what is simulated:

- `pd.read_csv(name, data)` builds a real DataFrame; the *content* is supplied
  (there is no disk), the *structure* is the lesson.
- A view mutation is real in-model (it writes the shared buffer); a real
  `for`-loop is out of the subset (consumption is `next()`-driven and visible).
- Every deep lesson names where the model stops and CPython takes over.

This is a feature, not a defect: it forces the learner to see the object graph,
which is the whole point.

---

## 2. Enabling infrastructure

These are the pieces that make "teach a new library" a fill-in-the-blanks task.
All are additive — nothing in `engine/`, `levels/`, or `ui/` is rewritten.

### 2.1 Type & data model

| Piece | Where | What it does |
|-------|-------|--------------|
| `HeapObject.addr / byteSize / refCount / seg` | `types.ts` | RAM-view fields; ignored by the abstract model. |
| `EliBand` (`eli5…eliphd`) + required `Level.eli` | `types.ts` | The band is a first-class level attribute. |
| `Sequence.deepLesson?` | `types.ts` | The per-series ELI5→ELI-PHD ramp, rendered in the lesson panel. |
| `estimateByteSize`, `computeRefCounts`, `nestedRefs`, `snapshot` | `memory.ts` | RAM sizing, refcount graph, layout-free snapshot. |
| `isNdarrayValue` / `isPandasValue` guards | `memory.ts` | Keep a view's buffer alive + draw its edge. |

The invariant rule that keeps the model honest: **new value shapes hold `obj_*`
id refs in their `value`**, so `nestedRefs` keeps them alive and the canvas draws
the edges for free. A new type is a new `type` string + a documented `value`
shape — no schema change.

### 2.2 Rendering

- **Memory tab** — `renderMemory`: the reference graph (frames → heap → amber
  edges). Per-type cell layout in `drawObject` / `objectHeight`.
- **RAM tab** — `renderRam`: the memory map (§1.5). A buffer draws its byte
  cells; each view paints its window strip aligned to those cells.

### 2.3 The schematic engine

`renderSchematic(spec)` → an SVG string. Layered auto-layout (a node's layer is
its longest path from a source; cycles are capped so they never hang). A
```schematic fence in a lesson is parsed and inlined; a malformed spec degrades to
showing its source. `schematicBlock(spec)` emits a ready-to-interpolate fence
string, so lesson template literals never hand-escape backticks. ~12 reusable
archetypes are catalogued in §5.

### 2.4 Deep-lesson surfacing

The level **lesson** modal (`openLesson`) shows the full per-level lesson (objective,
lesson, "what this teaches", field notes) **plus a "Deep lesson" button**; the
levels modal has a per-series deep-lesson entry point. Both render through
`renderMarkdown`, so schematics render there too.

### 2.5 Predicates (goal checks)

A level's goal is a list of **predicates** over the normalized snapshot
(`checks.ts`). Predicates assert *facts about the graph*, not exact reprs:
`isNdarray`, `sharesBuffer`/`independentBuffer`, `sharesFrameBuffer`/
`independentFrameBuffer`, `isSeries`/`isDataFrame`, `rows`, `aliased`,
`sharesChild`/`independent`, `iteratesOver`/`exhausted`, … New library, new
predicates — same pattern.

### 2.6 Catalog invariants

`tests/levels.test.ts` is invariant-based so the catalog can grow without
touching the test. It enforces: unique ids; every level has brief/hint/solution/
lesson/difficulty/par/learning/fieldNotes **and `eli`**; the `eli`↔difficulty
pairing; the catalog spans all five bands; every series with a `deepLesson` ramps
through the core ELI bands; and — the important one — **every level's own
`solution` solves its goal within `par + 2` statements.** That last gate is what
proves the whole catalog actually works, not just compiles. Set
`LEVEL_FILTER=<series-id>` to run the (expensive) solvability gate on one series.

### 2.7 The TDD build order for a new library

Every series ships the same way: **engine → canvas → predicates → tests → levels**,
with `npx tsc --noEmit` + `npm test` (and the browser) green at the end of each
step. The numpy and pandas series are the two worked references.

---

## 3. The catalog (current)

**45 levels across 11 series.** Series are in teaching order. `band` is the
level's ELI band.

| Series | Title | Levels |
|--------|-------|--------|
| `names` | Names & Bindings | 5 |
| `aliasing` | Aliasing & Copy | 4 |
| `containers` | Containers in Memory | 4 |
| `copy-semantics` | Copy Semantics | 3 |
| `iterators` | Iterators & Iterables | 4 |
| `functional` | Defaults & Functional | 4 |
| `numpy` | NumPy: Buffers & Views | 5 |
| `pandas` | Pandas: Tables as windows over a buffer | 5 |
| `mutation` | Mutation & Methods | 4 |
| `functions` | Functions & Frames | 4 |
| `plotting` | Plotting & Capstone | 3 |

### Core Python

**`names` — Names & Bindings**

| id | band | name |
|----|------|------|
| `first-name` | eli5 | First name |
| `rebind` | eli5 | Rebind |
| `a-real-object` | eli5 | A real object |
| `values-vs-refs` | eli10 | Values vs references |
| `shared-value` | eli10 | Two names, one value |

**`aliasing` — Aliasing & Copy**

| id | band | name |
|----|------|------|
| `two-names-one-list` | eli10 | Two names, one list |
| `copy-dont-alias` | eli10 | Copy, do not alias |
| `rebind-vs-mutate` | eli15 | Rebind vs mutate |
| `identity-is` | eli15 | Identity: `is` |

**`containers` — Containers in Memory**

| id | band | name |
|----|------|------|
| `list-update-in-place` | eli10 | List update in place |
| `dict-entry` | eli10 | Dict entry |
| `tuple-identity` | eli10 | Tuple identity |
| `set-semantics` | eli15 | Set semantics |

**`copy-semantics` — Copy Semantics**

| id | band | name |
|----|------|------|
| `shallow-copy-dict` | eli10 | Shallow copy |
| `deep-copy-independence` | eli15 | Deep copy |
| `shared-child-mutation` | eli15 | The shared child mutates both |

**`iterators` — Iterators & Iterables**

| id | band | name |
|----|------|------|
| `iter-basic` | eli10 | Make an iterator |
| `iter-next` | eli10 | Advance with `next()` |
| `iter-independence` | eli15 | Two iterators, one list |
| `iter-exhaust` | eli15 | Exhaust the iterator |

**`functional` — Defaults & Functional**

| id | band | name |
|----|------|------|
| `defaultdict-basic` | eli10 | A dict that invents its defaults |
| `defaultdict-list` | eli15 | Auto-default to a fresh list |
| `map-lazy` | eli15 | `map`: a lazy transform |
| `filter-truthy` | eli15 | `filter`: keep what is truthy |

**`mutation` — Mutation & Methods**

| id | band | name |
|----|------|------|
| `grow-with-append` | eli10 | Grow with `append` |
| `pop-returns` | eli15 | `pop` returns |
| `dict-get-safe` | eli15 | Safe `dict.get` |
| `dict-update-merge` | eli15 | `dict` update / merge |

**`functions` — Functions & Frames**

| id | band | name |
|----|------|------|
| `print-is-not-magic` | eli5 | `print` is not magic |
| `define-function` | eli10 | Define a function |
| `call-and-bind` | eli10 | Call and bind |
| `rebind-in-fn-is-local` | eli20 | Rebind inside a function |

**`plotting` — Plotting & Capstone**

| id | band | name |
|----|------|------|
| `plot-scatter` | eli15 | First plot |
| `plot-trend` | eli20 | Plot a computed trend |
| `capstone-shared-mutation` | eliphd | Capstone: alias + mutate + plot |

### Data libraries

**`numpy` — NumPy: Buffers & Views** (the flagship identity series)

| id | band | name |
|----|------|------|
| `np-make-array` | eli10 | Build an ndarray |
| `np-copy` | eli15 | An independent copy |
| `np-view-slice` | eli15 | A slice is a view |
| `np-view-mutates` | eli20 | The shared buffer bites |
| `np-vector-capstone` | eli20 | Capstone: vectorize + fold |

**`pandas` — Pandas: Tables as windows over a buffer** (the Milestone-1 exemplar)

| id | band | name |
|----|------|------|
| `pd-make-series` | eli5 | Build a Series |
| `pd-make-frame` | eli10 | Build a DataFrame |
| `pd-col-select` | eli15 | Read a column |
| `pd-iloc-view` | eli20 | A row-slice is a view |
| `pd-copy-independent` | eliphd | Capstone: view vs copy |

---

## 4. The lesson spec

A **level** teaches one step; a series **deep lesson** teaches the whole topic.
Both follow the ELI bands.

### 4.1 A level

Every level is self-contained and beginner-to-expert in one: a `brief` (the
task), a `hint`, a `lesson` (the *why*, in markdown), `learning` bullets ("what
this teaches"), and `fieldNotes` ("in production"). The `lesson` is written at
the level's band; the deep lesson below re-covers the series at every band.

### 4.2 The deep lesson (the per-series ramp)

A deep lesson is one idea, re-explained from five altitudes, with a schematic
where a picture clarifies. The shape:

```
## ELI5      — the metaphor. One picture a curious beginner can hold.
## ELI10     — the object model. What the thing actually is.
## ELI15     — the daily mental model. The question to always ask.
## ELI20     — the mechanics. Precise structure, what's shared, what's copied.
## ELI-PHD   — where it pays off and where it breaks. Edge cases, the escape hatch.
```

The catalog invariant requires the `## ELI5`…`## ELI20` banners; `## ELI-PHD` is
convention. Each band is a *different explanation of the same idea*, not a
section of trivia — ELI5 for pandas is beads, ELI-PHD for pandas is
copy-on-write.

### 4.3 Worked exemplar — **Pandas** (shipped)

The pandas series is the reference for "one library, one thesis." The thesis:
**a DataFrame is a window over one row-major buffer; a row-slice is a second
window over the *same* buffer (a view); `.copy()` owns a new buffer.** Every
level and every ELI band is that thesis at an altitude.

- `pd-make-series` (eli5): a Series is the 1-D case — a column, a window over a
  buffer + an index. Two boxes.
- `pd-make-frame` (eli10): a DataFrame pours rows into **one** row-major buffer
  (`[1, 3, 2, 4]` for `{"x":[1,2],"y":[3,4]}`) and wraps it with columns + index.
- `pd-col-select` (eli15): `df["x"]` reads a column as a Series — a column is
  carved out of the row-major buffer, not a contiguous run.
- `pd-iloc-view` (eli20): the flagship. `df.iloc[1:3]` is a **view** — a second
  window over the *same* buffer; the goal is `sharesFrameBuffer('df','v')`.
- `pd-copy-independent` (eliphd): capstone. `v = df.iloc[1:3]` (shares) vs
  `c = df.copy()` (independent) — the whole identity model in two statements,
  asserted by `sharesFrameBuffer` + `independentFrameBuffer`.

The deep lesson ramps from "a grid of beads" (ELI5) to "copy-on-write, and why
a view can mutate its source" (ELI-PHD), with the *DataFrame window over one
buffer* schematic in the ELI5 section.

### 4.4 Worked exemplar — **asyncio** (design; on the roadmap)

Concurrency is the second named exemplar. It is not built yet; this is the
worked *design*, so it is ready to implement the same way numpy/pandas were.

**Thesis:** a coroutine is an object; `await` is *suspension*, not blocking; the
event loop is a **tick-based scheduler** that advances ready tasks one step at a
time. "90" means the learner can *see* two coroutines interleave by watching the
loop hand the tick back and forth.

**Fidelity boundary (stated up front):** there is no real event loop and no real
I/O. We simulate the *schedule*: an event loop that, each tick, advances the
current task to its next `await` (or completion) and moves to the next ready task.
That is exactly the mental model; the wall-clock is not simulated.

**Value shapes (fill `types.ts` + a value guard):**

| type | value shape | canvas box |
|------|-------------|------------|
| `coroutine` | `{ fn: id, status: 'pending'|'ready'|'done', pc: int }` | box with a status chip |
| `task` | `{ coro: id, name, status }` | box → coroutine |
| `eventloop` | `{ queue: [task ids], tick }` | box with a ready-queue chip |

**Constructor / methods (module dispatch on `import asyncio as a`):**
`a.create_task(coro)`, `a.gather(*tasks)`, `a.run(loop)`, and the `await` idiom
rendered as `await x` advancing the current task. `loop` is the thing you watch.

**Schematics (from §5):** `event-loop-tick` (the loop handing a tick to a task,
then the next), `producer-consumer` (a queue box between two tasks), and
`task-states` (pending → ready → done).

**The five-ladder, as levels:**

| level (id) | band | task | goal |
|------------|------|------|------|
| `as-make-coro` | eli10 | `task = a.create_task(coro)` — a task is an object | `isTask('task')` |
| `as-two-tasks` | eli15 | two tasks on the loop | both `ready` in the loop's queue |
| `as-await-yields` | eli20 | one `await` yields the tick to the other task | the other task advanced (status/pc) |
| `as-interleave` | eli20 | watch two tasks interleave over ticks | the loop's `tick` advanced, both progressed |
| `as-produce-consume` | eliphd | capstone: producer/consumer through a queue | the queue drains; both tasks `done` |

**Deep-lesson ramp:** ELI5 = "two people taking turns at one stove" (the loop is
the stove); ELI10 = a task is a saved place in a function, `await` sets the place
and yields; ELI15 = "the loop is a queue of ready things; `await` puts you back
on it"; ELI20 = the tick advances the current task to its next `await` then
deques the next; ELI-PHD = real `asyncio` is a real loop + a real event model
(wall-clock, I/O, threads), and where our tick model stops being the same.

---

## 5. Schematic inventory

Reusable archetypes. Each is a `SchematicSpec`; the ones marked ✅ are in use.
All use the canvas palette (amber = points at / owns, coral = shared / view,
teal = a buffer/data box, muted = a note).

| # | Archetype | Teaches | Status |
|---|-----------|---------|--------|
| 1 | name → pointer → object | aliasing, "two names, one object" | reusable |
| 2 | shallow vs deep copy | the shared child | reusable |
| 3 | **numpy view vs copy** | a window over a buffer | ✅ (`numpy` deep lesson) |
| 4 | **pandas view vs copy** | a DataFrame window over one buffer | ✅ (`pandas` deep lesson) |
| 5 | frame push / pop | a function call is a new frame | reusable |
| 6 | iterator protocol | `iter` → `next`, the cursor | reusable |
| 7 | refcount graph | who keeps an object alive | reusable |
| 8 | buffer + overlapping views | two windows, one run | reusable (numpy/pandas) |
| 9 | event-loop tick | the loop handing a tick back and forth | for `asyncio` |
| 10 | producer–consumer | a queue box between two tasks | for `asyncio` |
| 11 | lock / critical section | two tasks, one lock | for `threading` |
| 12 | DataFrame structure | columns as virtual slices of a row-major buffer | for `pandas` depth |
| 13 | DOM tree | parent → child heap edges | for `beautifulsoup` |
| 14 | regex groups | pattern → match → group chips | for `re` |
| 15 | pickle freeze / restore | a frozen graph, restored with the same aliasing | for `pickle` |

When you add a series, add its archetype(s) here with a one-line "teaches" so the
diagram library stays a map, not a graveyard.

---

## 6. Roadmap: the 0 → 90 plan

The full professional surface, as a per-library contract. Every library fills
the same seven-point contract (module object, value type(s), constructors,
methods, repr + canvas, predicates, a 5-ladder series) and gets a deep lesson +
schematics. "On the canvas" rates how strong the memory lens is for that library —
the whole reason we prioritize.

| Phase | Library | Mental model (the thesis) | New value shape(s) | Schematic(s) | On-canvas |
|-------|---------|---------------------------|--------------------|--------------|-----------|
| 0 | copy / deepcopy, iterator, defaultdict, map/filter | shared child; the stateful iterator | `listiter`/`mapiter`/`filteriter`, `defaultdict` | #1, #2, #6 | ★★★ |
| 1 | **numpy** ✅ | a window over a buffer | `ndarray`, `buffer` | #3, #8 | ★★★ |
| 2 | **pandas** ✅ | a table as a window over a row-major buffer | `series`, `dataframe` | #4, #12 | ★★★ |
| 3 | pickle, h5py | freeze the graph; file → dataset → buffer | `Bytes`, `H5File`/`H5Dataset` | #7, #15 | ★★ |
| 4 | beautifulsoup | HTML is a heap **tree** | `DomNode` | #13 | ★★★ |
| 5 | re, datetime, pytz | a compiled pattern; identity = value | `Pattern`/`Match`, `Datetime`/`TZ` | #14 | ★★ |
| 6 | requests | a Response box → body → `.json()` dict | `Response` | (response chain) | ★ |
| 7 | SQLAlchemy, pyodbc | a Model/Session; a Connection → row boxes | `Model`/`Session`, `Connection`/`Cursor` | (1-to-many links) | ★★ |
| 8 | **asyncio**, threading/multiprocessing | a coroutine; the tick loop; a lock | `coroutine`/`task`/`eventloop` (or `Thread`) | #9, #10, #11 | ★★★ |
| 9 | matplotlib, plotly | a Figure/Axes **is an object**, not magic | `Figure`/`Axes`, `Figure` | (artist chips) | ★ |
| 10 | capstones | multi-library assembly | (composes) | (mix) | — |

Ordering is deliberate: **Phase 0 first** (foundational; its iterator primitive is
reused later), **numpy** as the identity flagship, **pandas** as the table
exemplar, **asyncio** as the concurrency exemplar, and **matplotlib/plotly last**
(their point is output, not identity — they only get "Figure/Axes are objects").

### Adding a library — checklist

1. **Value shape** — a new `type` + a `value` shape in `types.ts`, holding `obj_*`
   refs so edges/refs are derived for free. Add a guard (`isXValue`) in
   `memory.ts`.
2. **Constructor + methods** — module dispatch in `evaluator.ts` `callMethod`;
   `import X as x` binds a module object (parser already supports `import`).
3. **Canvas** — per-type cell layout in `drawObject` / `objectHeight` (free if the
   default box suffices); the RAM view picks up the new type automatically.
4. **Predicates** — what the goal asserts, in `checks.ts`.
5. **Tests** — engine tests for the operations, *before* the levels.
6. **Levels** — one 5-ladder series in `src/levels/<lib>.ts`, every level `eli`-
   banded, solution solves the goal within `par + 2`.
7. **Deep lesson** — the ELI5→ELI-PHD ramp with at least one schematic; wire it
   via `schematicBlock(...)`.
8. **Catalog** — add the series to `src/levels/index.ts`; run `npx tsc --noEmit`
   + `npm test`; verify the canvas, the RAM tab, and the deep lesson in the
   browser.
9. **Doc** — add the series to §3 and its archetype(s) to §5.

Verify the gate at every step: `npx tsc --noEmit` clean, `npm test` green, and the
level **and** its deep lesson visible in the browser. That is the bar.
