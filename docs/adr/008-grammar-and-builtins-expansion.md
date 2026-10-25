# learn-python — ADR 008: Grammar and Built-ins Expansion

## Status

Accepted

## Context

While Phase 2 established core Python semantics and modularized built-in modules, learners encountered syntax errors or unexpected behavior when using standard Python constructs:
1. **Sequence Unpacking**: Tuple/list unpacking (`a, b = (1, 2)`, `a, b = [3, 4]`, variable swaps `a, b = b, a`, unpacking in `for k, v in pairs:`) failed to parse in assignments or loop headers, or raised generic syntax errors instead of `ValueError` when sequence lengths mismatched.
2. **Keyword Arguments and Default Parameters**: Function definitions with default arguments (`def f(x, y=10):`) and calls with keyword arguments (`f(y=20, x=5)`) were unparsed or ignored keyword names.
3. **Comprehensions**: List, dictionary, and set comprehensions (`[x * 2 for x in ...]`, `{x: x*x for ...}`, `{x % 3 for ...}`), including `if` filters and nested generators (`for x in ... for y in ...`), were unsupported.
4. **F-Strings**: Formatted string literals (`f"hello {name}"`, `f"{a} + {b} = {a + b}"`) were tokenized as normal strings without expression interpolation.
5. **Class Definitions and OOP**: Class definitions (`class Dog:`), `__init__` constructor invocation, method dispatch (`self.method()`), single inheritance, `super()` proxy dispatch, and class attribute fallback on instances were absent.
6. **Exception Handling**: `try / except [Type] [as e] / else / finally` constructs lacked support for binding exception instances (`as e`) and threw `NameError` on built-in exception types (`ZeroDivisionError`, `ValueError`, `Exception`, `TypeError`, etc.).
7. **Comparison Operators**: `not in` membership and `is not` identity tests were unsupported by the parser.
8. **Built-in Functions**: Common built-in functions (`enumerate`, `zip`, `reversed`, `all`, `any`, `round`, `chr`, `ord`) were missing from global scope.

## Decision

1. **Parser & Tokenizer Grammar Extensions**:
   - Extended tokenizer to recognize f-strings (`FSTRING`), tracking nested braces and expressions.
   - Enhanced statement parser to parse tuple/list targets in assignments and `for` loops via `parseTarget()`.
   - Added AST nodes and parsing for `ClassDefNode`, `ListCompNode`, `DictCompNode`, `SetCompNode`, and `FStringNode`.
   - Added multi-token comparison operators (`not in`, `is not`).

2. **Evaluator Implementation**:
   - Implemented sequence unpacking with strict length checks raising `PyValueError` on mismatch.
   - Added class object allocation, instance instantiation with `__init__` dispatch, and class/super method resolution.
   - Built-in exception type lookup in `lookupName` mapping standard exception names (`ValueError`, `ZeroDivisionError`, `Exception`, etc.) to type objects on the heap.
   - Updated `callUserFunction` to instantiate exception objects and classes properly.
   - Added built-in functions: `enumerate` (supporting start offsets), `zip`, `reversed`, `all`, `any`, `round` (Python round-half-to-even semantics), `chr`, and `ord`.

3. **Differential Verification**:
   - Added `tests/differential/grammar.test.ts` covering 35 differential probes directly verified against real CPython (≥ 3.12).
   - Validated that all 35 probes produce identical stdout and exception types as real CPython.

## Consequences

- Simulator faithfully mirrors CPython grammar for sequence unpacking, comprehensions, f-strings, OOP, and exceptions.
- 100% of 35 Phase 3 differential grammar probes pass alongside all 78 existing level differential suites.
