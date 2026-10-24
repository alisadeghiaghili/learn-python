/**
 * Differential level suite.
 *
 * Verifies that every level solution in the catalog is valid Python
 * and behaves identically in both real CPython and the simulator.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { locateCPython, runBatchCPython, type PythonResult } from './cpython';
import { runSimulator } from './simulator';
import { allLevels } from '../../src/levels/index';

const hasCPython = locateCPython() !== null;

// Levels known to use non-standard CPython APIs or unsupported idioms as of baseline.
// These are remediated in Phases 4 & 5.
const KNOWN_NON_CPYTHON_LEVELS = new Set<string>([
  // Plotting levels: call global scatter()/line() instead of matplotlib
  'plot-scatter',
  'plot-trend',
  'capstone-shared-mutation',
  // Threading levels: use Thread(fn, args) without target= keyword, and manual join scheduler
  'th-make-thread',
  'th-start-join',
  'th-race',
  'th-lock',
  'th-critical-capstone',
  // Asyncio levels: use await None and create_task outside running loop
  'as-create-task',
  'as-run-one',
  'as-await-yields',
  'as-produce-consume',
]);

describe.skipIf(!hasCPython)('differential levels (solution validity against CPython)', () => {
  const levels = allLevels();
  let batchResults: Record<string, PythonResult> = {};

  beforeAll(() => {
    const items = levels.map((l) => ({
      id: l.id,
      source: l.start.trim() ? `${l.start}\n${l.solution}` : l.solution,
    }));
    batchResults = runBatchCPython(items);
  });

  for (const level of levels) {
    const isKnownFailing = KNOWN_NON_CPYTHON_LEVELS.has(level.id);
    const testFn = isKnownFailing ? it.fails : it;

    testFn(`level ${level.id} solution matches CPython`, () => {
      const source = level.start.trim() ? `${level.start}\n${level.solution}` : level.solution;
      const py = batchResults[level.id];
      expect(py, `Missing CPython result for level ${level.id}`).toBeDefined();

      const sim = runSimulator(source);

      // A valid level solution must not raise an unhandled exception in CPython
      expect(
        py.exceptionType,
        `CPython raised ${py.exceptionType} on ${level.id}:\n${source}\nStderr: ${py.stderr}`,
      ).toBeNull();

      // Simulator must also not raise an unhandled exception
      expect(
        sim.exceptionType,
        `Simulator raised ${sim.exceptionType} on ${level.id}:\n${source}`,
      ).toBeNull();

      // If output is produced, stdout should match
      if (py.stdout.length > 0) {
        expect(sim.stdout, `Stdout mismatch on level ${level.id}`).toBe(py.stdout);
      }
    });
  }
});
