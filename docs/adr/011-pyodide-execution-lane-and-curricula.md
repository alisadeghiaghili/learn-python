# learn-python — ADR 011: Pyodide Execution Lane and Curricula Architecture

## Status

Accepted

## Context

Phase 10 addresses the extended curricula requested for advanced Python topics:
1. Slicing semantics, contrasts, and step indexing
2. Closures, generators, and lazy evaluation
3. Recursion, call stack frames, and `RecursionError`
4. NumPy multi-dimensional arrays, slicing views, and broadcasting rules
5. pandas 3.x Copy-on-Write data transformations (`merge`, `concat`, `melt`, `pivot`, `apply`, `groupby`, `dropna`, `fillna`)
6. Regular expressions (`re`)
7. Type annotations, generics, and Pydantic v2 schemas
8. Docstrings and doctests (PEP 257, Google/NumPy styles)
9. Testing with pytest, fixtures, and parameterization
10. SQLAlchemy ORM, relationship mappings, and identity-map semantics
11. Production architecture, FastAPI, dependency injection, and environment configuration

Attempting to implement a mini-SQLAlchemy, mini-Pydantic, mini-pytest, mini-FastAPI, or full regex NFA engine inside a hand-written TypeScript simulator would drastically compromise fidelity, multiply maintenance overhead, and inevitably violate CPython semantics.

## Decision

We introduce a **dual-lane execution architecture**:
1. **Simulator Lane (`sim`)**:
   - The lightweight, instant, hand-written TypeScript simulator handles core control flow, variable bindings, object mutation, memory references, NumPy views, and pandas operations.
   - Ideal for low-latency visual animation, single-stepping, and immediate pedagogical feedback without runtime download overhead.
2. **Real-Python Lane (`pyodide`)**:
   - Complex standard libraries and third-party ecosystems (`re`, `pydantic`, `pytest`, `sqlalchemy`, `fastapi`, `unittest.mock`) run via self-hosted Pyodide WebAssembly in the browser (or native CPython in test/CI harnesses).
   - Pyodide is lazy-loaded on demand when a `pyodide`-lane level or sandbox mode is activated, and precached by the service worker for offline use.
   - Levels explicitly declare `engine?: 'sim' | 'pyodide'` (defaulting to `'sim'`).
3. **Unified Memory Introspection Bridge**:
   - A standardized Python introspection script walks the execution frame locals and referents (`gc.get_referents`, `id`, `type`, `repr`), serializing execution state into the identical `MemoryState` structure consumed by the existing Stack, Heap, and RAM boards.
   - The user interface, canvases, and step visualizers remain 100% unified and agnostic to which lane executed the code.
4. **Goal Evaluation**:
   - Pyodide levels evaluate goals either via standard snapshot assertions or Python predicate functions evaluated directly in the Python runtime.
   - All level solutions are verified differentially against real CPython in automated tests.

## Consequences

- Third-party packages run with 100% CPython fidelity without fragile TypeScript reimplementations.
- The browser experience remains fast and lightweight for introductory levels, downloading Pyodide only when required.
- Visualizers seamlessly display stack, heap, and RAM models for both execution lanes.
- Full offline capability is preserved via service worker caching.
