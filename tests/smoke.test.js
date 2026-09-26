/**
 * Headless smoke: drive the App against a fake DOM-less flow via engine only.
 * Browser screenshot QA is separate (output/qa/).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { runFresh, snapshot, referenceEdges, liveObjectIds } from '../js/engine/index.js';
import { checkGoal } from '../js/levels/compare.js';
import { getLevel } from '../js/levels/pack.js';
import { countStatements } from '../js/shell/app.js';

test('alias-1 interactive path matches the level goal', () => {
  const level = getLevel('alias-1');
  const state = runFresh('a = [1]\nb = a\na.append(2)');
  const result = checkGoal(level.goal, snapshot(state), state);
  assert.equal(result.ok, true, result.message);
  assert.equal(countStatements(level.solution), 3);
});

test('visualization inputs are well-formed after aliasing', () => {
  const state = runFresh('a = [1]\nb = a');
  const edges = referenceEdges(state);
  const live = liveObjectIds(state);
  assert.equal(edges.length, 2);
  assert.equal(live.length, 1);
  assert.equal(edges[0].toId, edges[1].toId);
});
