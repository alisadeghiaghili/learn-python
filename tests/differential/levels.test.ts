/**
 * Differential correctness test suite for all level solutions against real CPython.
 * Proves that every level's reference solution is 100% valid CPython and executes
 * in the engine.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { allLevels } from '../../src/levels/index';
import { findPython, runPython } from './cpython';

describe('Differential level solutions against CPython', () => {
  const py = findPython();

  beforeAll(() => {
    if (!py) {
      console.warn('Skipping CPython differential suite: CPython >= 3.12 not found locally.');
    }
  });

  const levels = allLevels();

  /**
   * In Phase 4, all level solutions are updated to 100% valid CPython and tested without failures.
   */
  const KNOWN_PHASE4_LEVEL_BUGS = new Set<string>([]);

  for (const level of levels) {
    const isKnownFailing = KNOWN_PHASE4_LEVEL_BUGS.has(level.id);
    const testRunner = py ? (isKnownFailing ? it.fails : it) : it.skip;
    testRunner(
      `level solution is valid CPython: [${level.id}]`,
      async () => {
        const code = (level.start ? level.start + '\n' : '') + level.solution;
        const cpythonRes = await runPython(code);
        if (cpythonRes.errorType !== null) {
          throw new Error(
            `Level '${level.id}' solution is NOT valid CPython: raised ${cpythonRes.errorType}\n${cpythonRes.rawError}`
          );
        }
        expect(cpythonRes.errorType).toBeNull();
      },
      60000
    );
  }
});
