# LearnPyState — ADR 001: Simulated Python subset, not CPython

## Status

Accepted

## Context

LearnGitBranching succeeds because it *simulates* git in JS and draws the invisible commit DAG.
The Python analogue of that invisible state is the object memory model (stack frames, heap objects, reference edges).

Options for executing learner Python in the browser:

1. CPython via Pyodide / WASM — real semantics, heavy, hard to step/visualize every mutation.
2. Skulpt / other partial runtimes — similar tradeoffs, less control.
3. **Own teaching subset** — full control of alloc/bind/mutate, tiny, testable in Node.

## Decision

Implement a deliberate Python **subset** (`js/engine/*`) that models heap identity and frame locals explicitly. Not CPython. Document unsupported syntax (`if`, `for`, classes, imports) as hard errors in v0.

## Consequences

- Visualization can show every reference edge at the moment it is created.
- Goal checking compares normalized snapshots / predicates (LGB TreeCompare analogue).
- Learners may hit subset gaps; README states the scope honestly.
- We can grow the grammar level by level without shipping a full interpreter.
