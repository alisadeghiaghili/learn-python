/**
 * Integration tests: every level solution must satisfy its own goal.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { runFresh, snapshot } from '../js/engine/index.js';
import { checkGoal } from '../js/levels/compare.js';
import { allLevels } from '../js/levels/pack.js';
import { countStatements } from '../js/shell/app.js';

test('every level has a solution that meets the goal within par', () => {
  const levels = allLevels();
  assert.ok(levels.length >= 10, 'expected a real level pack');
  for (const level of levels) {
    assert.ok(level.solution, `${level.id} missing solution`);
    const state = runFresh(level.start ? level.start + '\n' + level.solution : level.solution);
    const result = checkGoal(level.goal, snapshot(state), state);
    assert.equal(result.ok, true, `${level.id}: ${result.message}`);
    const used = countStatements(level.solution);
    assert.ok(used <= level.par + 2, `${level.id} golf par too tight (used ${used}, par ${level.par})`);
  }
});
