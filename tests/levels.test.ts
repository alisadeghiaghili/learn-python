/**
 * Catalog integrity + integration: every level's solution must satisfy its own
 * goal within par, and the catalog itself must be well-formed.
 */

import { test, expect } from 'vitest';

import { runFresh, snapshot } from '../src/engine/session';
import { checkGoal } from '../src/engine/checks';
import { allLevels, sequences } from '../src/levels/index';
import { countStatements } from '../src/ui/app';

test('catalog is well-formed: 35 levels across 9 series, unique ids, valid difficulty', () => {
  const levels = allLevels();
  expect(sequences.length).toBe(9);
  expect(levels.length).toBe(35);

  const ids = new Set(levels.map((l) => l.id));
  expect(ids.size, 'duplicate level ids').toBe(levels.length);

  for (const level of levels) {
    expect(level.brief, `${level.id} missing brief`).toBeTruthy();
    expect(level.hint, `${level.id} missing hint`).toBeTruthy();
    expect(level.solution, `${level.id} missing solution`).toBeTruthy();
    expect(level.difficulty, `${level.id} missing difficulty`).toBeGreaterThanOrEqual(1);
    expect(level.difficulty, `${level.id} difficulty out of range`).toBeLessThanOrEqual(5);
    expect(level.par, `${level.id} par must be >= 1`).toBeGreaterThanOrEqual(1);
    expect(level.lesson, `${level.id} missing lesson`).toBeTruthy();
    expect(Array.isArray(level.learning), `${level.id} learning must be an array`).toBe(true);
    expect(Array.isArray(level.fieldNotes), `${level.id} fieldNotes must be an array`).toBe(true);
  }
});

test('every level has a solution that meets the goal within par', () => {
  const levels = allLevels();
  for (const level of levels) {
    const source = level.start.trim() ? level.start + '\n' + level.solution : level.solution;
    const state = runFresh(source);
    const result = checkGoal(level.goal, snapshot(state), state);
    expect(result.ok, `${level.id}: ${result.message}`).toBe(true);
    const used = countStatements(level.solution);
    expect(used, `${level.id} golf par too tight (used ${used}, par ${level.par})`).toBeLessThanOrEqual(level.par + 2);
  }
});

test('plot levels actually produce a plot when solved', () => {
  for (const id of ['plot-scatter', 'plot-trend', 'capstone-shared-mutation']) {
    const level = allLevels().find((l) => l.id === id);
    expect(level, `missing ${id}`).toBeTruthy();
    const source = level!.start.trim() ? level!.start + '\n' + level!.solution : level!.solution;
    const state = runFresh(source);
    expect(state.plots.length, `${id} should draw a plot`).toBeGreaterThanOrEqual(1);
  }
});
