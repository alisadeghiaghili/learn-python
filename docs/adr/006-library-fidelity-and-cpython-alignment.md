# learn-python — ADR 006: Library Fidelity and CPython Alignment

## Status

Accepted

## Context

Previously, `src/engine/evaluator.ts` housed thousands of lines of monolithic dispatch and ad-hoc pseudo-implementations of third-party and standard libraries (`numpy`, `pandas`, `threading`, `asyncio`, and plotting). Several level solutions used non-standard syntax and APIs (e.g., `scatter(xs, ys)` instead of `plt.scatter(xs, ys)`, `t.Thread(bump, box)` instead of `threading.Thread(target=bump, args=(box,))`, and `await None` instead of `await asyncio.sleep(0)`). These diverged from CPython, violating the non-negotiable principle that a simulator disagreeing with CPython is a defect rather than a simplification.

Furthermore, the parser lacked support for keyword arguments (`kw=val`), context managers (`with expr:`), and 3-argument slicing (`[start:stop:step]`), which prevented standard library idioms from being parsed or executed.

## Decision

1. **Modularization of Library Dispatch**:
   - Extracted library execution into isolated, single-responsibility modules under `src/engine/libs/`:
     - `src/engine/libs/matplotlib.ts`
     - `src/engine/libs/threading.ts`
     - `src/engine/libs/asyncio.ts`
     - `src/engine/libs/numpy.ts`
     - `src/engine/libs/pandas.ts`
   - Unified error handling across modules using shared exception classes (`PySuspend`, `PyReturn`, `PyStopIteration`, `PyException`) exported from `src/engine/errors.ts`.

2. **Parser and AST Extensions**:
   - Added `KeywordNode` and `keywords` array to `CallNode` in `src/engine/parser.ts` to support keyword argument calls such as `Thread(target=f, args=(x,))`.
   - Added `WithNode` to support Python context managers (`with lock:`).
   - Added optional `step` expression node to `SliceNode` to support extended slicing (`[::step]`, `[::-1]`).

3. **Standard CPython Concurrency and Plotting APIs**:
   - **Threading**: Aligned with `threading.Thread(target=..., args=...)`, `.start()`, `.join()`, `threading.Lock()`, and `with lock:`.
   - **Asyncio**: Aligned with `async def main(): ...`, `asyncio.run(main())`, `asyncio.create_task(...)`, `await asyncio.sleep(0)` yield points, and `asyncio.gather(...)`.
   - **Matplotlib**: Standardized plotting under `matplotlib.pyplot as plt` (`plt.plot`, `plt.scatter`, `plt.bar`, `plt.title`, `plt.xlabel`, `plt.ylabel`, `plt.show()`), maintaining legacy aliases only for backwards compatibility.
   - Updated all level definitions and solutions in `plotting.ts`, `threading.ts`, and `asyncio.ts` to valid CPython code.

4. **NumPy and Pandas Memory Model**:
   - Maintained full fidelity with CPython NumPy 1D/2D arrays, scalar types, broadcasting rules, and view `.base` semantics.
   - Preserved row-major shared-buffer memory model for Pandas `DataFrame` and `Series` slices (`iloc`), maintaining visual fidelity with the RAM board layout.

## Consequences

- 100% of the 78 curriculum level solutions now execute identically in the simulator and real CPython (≥ 3.12).
- `evaluator.ts` is substantially cleaner and unburdened by monolithic library code (~1,100 lines removed).
- Differential tests in CI verify all level solutions against CPython on every push.
