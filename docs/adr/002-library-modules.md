# learn-python — ADR 002: Teach libraries as in-canvas heap objects, not via real imports

## Status

Accepted

## Context

The product thesis is: make Python's *invisible* state (the object memory model) visible and gameable.
The natural request that follows is "then teach me numpy / pandas / re / datetime / … — the real
libraries — from 0 to ~90, in this same interactive tool, where I can *watch RAM*."

Two broad ways to do it:

1. **Real execution.** Run CPython (Pyodide/WASM) so `import numpy` actually imports. Heavy, and it
   hides exactly the thing this tool exists to show: a Pyodide `np.array` is a black box. It also
   cannot run in a plain static Pages bundle without a ~100 MB WASM runtime, and native-only libs
   (pyodbc) are impossible in a browser either way.

2. **Simulated objects.** Keep the hand-written teaching subset, and model each library's *data
   structures* as first-class heap objects drawn on the same memory canvas. The `import` line binds
   a simulated *module object*; library calls become method dispatch on that object, exactly like the
   existing `list.append` / `dict.update`.

Option 2 was chosen. It is the *only* option that serves the thesis: the hard concepts in these
libraries are **memory-identity** concepts (numpy view-vs-copy, pandas chained assignment, shallow vs
deep copy, pickle preserving aliasing), and those are precisely what this canvas shows.

## Decision

Extend the subset, not the runtime philosophy:

- `import X as y` is parsed as a new statement and binds a **module object**
  (`type: 'module'`) into the frame. It does **not** run the real module; it stands in for "this name
  now refers to a namespace."
- Library constructors and methods are **method dispatch on the module object** (`np.array`,
  `df.copy`, `r.json` …), added to the existing `callMethod` table — no new call-path mechanism.
- New value shapes (ndarray, DataFrame, Series, Match, Datetime, Response, DomNode, iterator, …) are
  just new `type` strings on heap objects. The canvas renderer draws any unknown type as a labeled box
  already; per-type drawing is an additive branch.
- A **new primitive** is introduced to support iterators/generators/map/filter: a *stateful
  iterator object* (`{ source, index, … }`) that holds a reference to the object it iterates and
  advances on `next()`. This is the single genuinely new value shape the whole program needs.
- A new **predicate family** targets identity relationships already derivable from the snapshot
  (`sharesChild`, `independent`, `isIterator`, `nextReturns`, `exhausted`, `isViewOf` …).

## Consequences

- The memory canvas stays the single teaching surface for *everything*, core Python and libraries.
- Simulated libs are **pedagogically faithful on identity, intentionally not faithful on compute**:
  we model structure, aliasing, and in-place semantics (view vs copy, chained assignment, lazy
  iterator chains) but not real math (no FFT, no real I/O). Levels and the README state this honestly.
- **Fidelity boundary is explicit and fixed:** the sandbox cannot read/write real files. I/O levels
  (`read_csv`, `to_excel`, `to_pickle`, h5py) model the *result object* and the *serialization
  meaning* (e.g. pickle = freezing the whole object graph to bytes, preserving aliasing), not real
  disk access. `for` is not in the subset, so iterator consumption is taught with explicit `next()` —
  which is *deliberately better* for this tool: each step is visible on the canvas, whereas `for`
  would hide consumption inside the loop.
- Scope is capped per library to the 5-ladder "0→90" (mental model → daily API → real patterns →
  depth/gotchas → capstone project). See `ENGINE-EXTENSION.md` for the contract and phase plan.
