# learn-python — ADR 005: Engine Semantics and CPython Fidelity

## Status

Accepted

## Context

Prior to Phase 2, the simulator evaluator in `src/engine/evaluator.ts` was an over-concentrated monolith of more than 2,600 lines containing statement evaluation, expression parsing, built-in library shims (`numpy`, `pandas`, `asyncio`, `threading`, `math`), collection methods, display formatting, and runtime state tracking.

This architectural entanglement caused several semantic discrepancies against real CPython:
- Floating point values were conflated with JavaScript numbers; true division `/` produced JavaScript numbers without type distinction.
- Large integers beyond $2^{53} - 1$ overflowed into standard IEEE-754 floats rather than arbitrary-precision integers.
- Variables referenced before assignment silently evaluated to `undefined` or outer scope values instead of raising `UnboundLocalError`.
- In-place augmented assignments (`+=`, `*=`) on lists and NumPy array views rebound variable targets rather than mutating underlying memory buffers.
- Closures lost access to outer lexical environments after enclosing frames returned.
- Container keys for `1` and `True` (or `0` and `False`) were treated as distinct keys rather than hashing to identical values.
- Self-referencing recursive containers caused stack overflows during representation formatting instead of emitting cycle-detected ellipses (`[...]`).

## Decision

1. **De-monolithisation (Rule 6)**:
   Decompose `evaluator.ts` into decoupled, single-responsibility modules:
   - `src/engine/signals.ts`: Control flow signals (`PyReturn`, `PySuspend`, `PyBreak`, `PyContinue`).
   - `src/engine/common.ts`: Core helpers (`valuesEqual`, `dictKeyMatch`, `formatObject`, `cycle-detecting repr`, `lengthOf`, `typeName`).
   - `src/engine/builtins/index.ts`: Built-in function and constructor dispatch table.
   - `src/engine/methods/`: Method handlers partitioned by data type (`list.ts`, `dict.ts`, `set.ts`, `str.ts`, `index.ts`).
   - `src/engine/libs/`: Modular standard and third-party library shims (`numpy.ts`, `pandas.ts`, `asyncio.ts`, `threading.ts`, `math.ts`).
   - `src/engine/evaluator.ts`: Lean orchestrator (~800 lines) handling AST statements, expressions, and frame lifecycle.

2. **CPython Fidelity Semantics**:
   - **Object Identity & Small-Int Cache**: Integer `id(x)` produces deterministic addresses; values in $[-5, 256]$ map to fixed addresses (`0x1000 + (val + 5) * 32`), and heap objects use stable hexadecimal addresses.
   - **Floats & BigInts**: Float literals and division results allocate dedicated float heap objects with explicit `<class 'float'>` types. Large integer exponents ($2^{64}$, $2^{100}$) use native JavaScript `BigInt` with transparent interoperability.
   - **Static Scope Analysis**: Pre-walk function bodies to detect local bindings at definition time. Accesses prior to binding raise `UnboundLocalError`.
   - **Closures & Nonlocal/Global**: Function objects capture enclosing lexical scopes (`closureFrames`). Outer closures persist across function returns, and `nonlocal` statements mutate the shared lexical frame.
   - **In-Place Mutation**: `AugAssign` (`+=`, `*=`) performs in-place mutation on lists and ndarray slice views while preserving reference identity.
   - **Container Semantics**: Dict keys and set elements follow Python equality and hashing (`1 == True`, `0 == False`). Recursive structures emit `[...]` and `{...}` without recursion errors. Unicode string length measures code points rather than UTF-16 code units.
   - **Standard Exceptions**: Discard silent `NaN` or unhandled errors in favor of standard Python exceptions (`TypeError`, `ValueError`, `KeyError`, `IndexError`, `AttributeError`, `ZeroDivisionError`, `UnboundLocalError`, `RecursionError`, `ModuleNotFoundError`).

## Consequences

- All 67 probes in `tests/differential/semantics.test.ts` pass natively against real CPython >= 3.12 without `it.fails`.
- The full test suite (283 tests across 9 files) is 100% green.
- Evaluator modules are cleanly separated, easy to audit, and prepared for Phase 3 (Grammar & Builtins Remediation).
