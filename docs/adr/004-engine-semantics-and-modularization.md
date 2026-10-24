# learn-python — ADR 004: Engine Semantics Fidelity and Evaluator Modularization

## Status

Accepted

## Context

The initial prototype in `src/engine/evaluator.ts` was an unstructured single-file interpreter (~2,600 lines) with chained `if (name === ...)` conditionals, returning string representations for object IDs (`"id(obj_1)"`), conflating integers and floats, lacking Python scope rules (e.g. compile-time local detection), and producing silent `NaN` or unhandled exceptions instead of standard Python errors.

To satisfy the product promise — *make Python's object identity visible with strict CPython fidelity* — the simulator's semantics must match real CPython (≥ 3.12). A simulator that disagrees with CPython is a defect.

## Decision

1. **Modular Architecture & Dispatch Tables**:
   - Decompose `evaluator.ts` into domain-specific modules:
     - `src/engine/errors.ts`: Standard Python exception hierarchy (`PyError` base class with `PyTypeError`, `PyValueError`, `PyZeroDivisionError`, `PyIndexError`, `PyKeyError`, `PyAttributeError`, `PyNameError`, `PyUnboundLocalError`, `PyRecursionError`, `PySyntaxError`, `PyModuleNotFoundError`, etc.).
     - `src/engine/builtins/types.ts`: CPython-compliant small integer interning cache (`[-5, 256]`), distinct `float` allocation, and integer `id(x)` generation.
     - `src/engine/builtins/math.ts`: Math functions and constants (`sqrt`, `sin`, `cos`, `log`, `floor`, `ceil`, `gcd`, `comb`, `factorial`, etc.).
     - `src/engine/builtins/range.ts`: Lazy `range` object with $O(1)$ length, indexing, and membership checking.
     - `src/engine/methods/`: Registry dispatch tables for `list.ts`, `dict.ts`, `set.ts`, and `str.ts`.

2. **Accurate Python Types and Math**:
   - Model arbitrary precision integers using JavaScript `BigInt`.
   - Distinguish `int` and `float` as separate runtime types; floor division `//` and modulo `%` follow Python flooring semantics (flooring toward negative infinity).
   - Support scientific notation (`1e5`), hex literals (`0x10`), and numeric underscores (`1_000`).

3. **Scope Semantics & Closures**:
   - Implement compile-time local detection per function: any name bound anywhere in the function body is treated as local unless declared `global` or `nonlocal`.
   - Raise `UnboundLocalError` when referencing a local name prior to its assignment.
   - Support nested function closures via surviving environment cells, and default arguments evaluated once at function definition time.

4. **Augmented Assignment In-Place Mutation**:
   - `+=` and `*=` mutate mutable targets (`list`, `ndarray`) in-place, preserving object identity.
   - Immutable targets (`tuple`, `int`, `str`) rebind to newly created objects.

5. **Differential Verification Harness**:
   - Enforce behavioral alignment against CPython ≥ 3.12 through an automated differential test suite (`tests/differential/`).

## Consequences

- All 67 differential probes across Phase 2 requirements pass against real CPython 3.12/3.14.
- Evaluator dispatch is modular, clean, and easily extensible for new builtins and methods without bloating `evaluator.ts`.
- The engine guarantees truthful Python execution and error propagation.
