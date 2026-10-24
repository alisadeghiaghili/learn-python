# learn-python — ADR 004: Differential Correctness Harness against CPython

## Status

Accepted

## Context

The core promise of learn-python is to make Python's object identity, stack/heap model, and data buffer semantics visible. When a simulator behaves differently from official CPython (such as silent `NaN` instead of `TypeError`, incorrect augmented assignment rebinding, or non-standard library APIs), learner intuition is broken and teacher trust is lost.

To guarantee that the hand-written TypeScript simulator adheres strictly to real Python semantics without behavioral drift, we need an automated, continuous verification harness that runs the same code through both the simulator and real CPython.

## Decision

1. Create a differential test suite under `tests/differential/` with:
   - System/tools discovery of real **CPython >= 3.12**.
   - Public API probe runner for the simulator (`src/engine/session.ts`).
   - Batch CPython executor (`runBatchCPython`) to execute catalog level solutions within a single process, eliminating process spawn overhead and worker RPC timeouts.
2. Verify exact stdout for successful executions and exact exception class types (e.g. `TypeError`, `ValueError`, `IndexError`, `ZeroDivisionError`) when errors are raised.
3. Include every level solution in the differential suite to guarantee every challenge is solvable in standard CPython.
4. Require CPython >= 3.12 and dependencies (`requirements-dev.txt`) in CI (`.github/workflows/deploy-pages.yml`) as a hard deployment blocker.

## Consequences

- Any semantic disagreement between the simulator and CPython is immediately surfaced as a test failure.
- Known non-standard behaviors in legacy levels or simulator features are tracked explicitly with `it.fails` until addressed in remediation phases.
- Fast batch execution keeps the full test suite running in seconds in local development and CI.
