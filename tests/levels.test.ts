/**
 * Catalog integrity + integration. Invariant-based so the catalog can grow to
 * 200+ levels without touching this file: the counts are floors, the per-level
 * rules are invariants, and the solvability gate proves every level actually
 * works. Set LEVEL_FILTER=<series-id> to run the (expensive) solvability gate
 * against a single series during development.
 */

import { test, expect } from 'vitest';

import { runFresh, snapshot } from '../src/engine/session';
import { checkGoal } from '../src/engine/checks';
import { allLevels, sequences } from '../src/levels/index';
import { countStatements } from '../src/ui/app';
import type { EliBand } from '../src/engine/types';

const BANDS: EliBand[] = ['eli5', 'eli10', 'eli15', 'eli20', 'eliphd'];

/** ELI band tracks difficulty (1→5 = eli5→eliphd); enforce the pairing. */
const BAND_DIFFICULTY: Record<EliBand, number> = {
  eli5: 1,
  eli10: 2,
  eli15: 3,
  eli20: 4,
  eliphd: 5,
};

/** A per-topic deep lesson must ramp through the core ELI bands. */
const DEEP_LESSON_BANNERS = ['## ELI5', '## ELI10', '## ELI15', '## ELI20'];

test('catalog is well-formed: unique ids, valid fields, valid ELI bands', () => {
  const levels = allLevels();
  expect(sequences.length, 'need at least the ten core series').toBeGreaterThanOrEqual(10);
  expect(levels.length, 'need at least the forty core levels').toBeGreaterThanOrEqual(40);

  const ids = new Set(levels.map((l) => l.id));
  expect(ids.size, 'duplicate level ids').toBe(levels.length);

  for (const level of levels) {
    expect(level.brief, `${level.id} missing brief`).toBeTruthy();
    expect(level.hint, `${level.id} missing hint`).toBeTruthy();
    expect(level.solution, `${level.id} missing solution`).toBeTruthy();
    expect(level.lesson, `${level.id} missing lesson`).toBeTruthy();
    expect(level.difficulty, `${level.id} difficulty out of range`).toBeGreaterThanOrEqual(1);
    expect(level.difficulty, `${level.id} difficulty out of range`).toBeLessThanOrEqual(5);
    expect(level.par, `${level.id} par must be >= 1`).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(level.learning), `${level.id} learning must be an array`).toBe(true);
    expect(Array.isArray(level.fieldNotes), `${level.id} fieldNotes must be an array`).toBe(true);
    // The ELI band is a first-class attribute and must pair with difficulty.
    expect(BANDS.includes(level.eli), `${level.id} has invalid eli band '${level.eli}'`).toBe(true);
    expect(level.difficulty, `${level.id} eli '${level.eli}' should pair with difficulty ${BAND_DIFFICULTY[level.eli]}`)
      .toBe(BAND_DIFFICULTY[level.eli]);
  }
});

test('the catalog spans all five ELI bands', () => {
  const seen = new Set<EliBand>();
  for (const level of allLevels()) seen.add(level.eli);
  for (const band of BANDS) expect(seen.has(band), `no level in the ${band} band`).toBe(true);
});

test('every series with a deep lesson ramps through the core ELI bands', () => {
  for (const seq of sequences) {
    if (!seq.deepLesson) continue;
    for (const banner of DEEP_LESSON_BANNERS) {
      expect(seq.deepLesson.includes(banner), `${seq.id} deep lesson missing '${banner}'`).toBe(true);
    }
  }
});

test('every level has a solution that meets the goal within par', () => {
  for (const level of allLevels()) {
    const source = level.start.trim() ? level.start + '\n' + level.solution : level.solution;
    const state = runFresh(source);
    const result = checkGoal(level.goal, snapshot(state), state);
    expect(result.ok, `${level.id}: ${result.message}`).toBe(true);
    const used = countStatements(level.solution);
    expect(used, `${level.id} golf par too tight (used ${used}, par ${level.par})`).toBeLessThanOrEqual(level.par + 2);
  }
});

test('plot levels actually produce a plot when solved', () => {
  const plotLevels = allLevels().filter((l) => l.goal.type === 'plot');
  expect(plotLevels.length, 'no plot-goal levels found').toBeGreaterThanOrEqual(1);
  for (const level of plotLevels) {
    const source = level.start.trim() ? level.start + '\n' + level.solution : level.solution;
    const state = runFresh(source);
    expect(state.plots.length, `${level.id} should draw a plot`).toBeGreaterThanOrEqual(1);
  }
});
