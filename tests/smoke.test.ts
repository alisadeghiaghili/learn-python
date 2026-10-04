/**
 * Headless smoke: drive the flow through the engine only.
 * Browser screenshot QA is separate.
 */

import { test, expect } from 'vitest';
import { runFresh, snapshot, referenceEdges, liveObjectIds } from '../src/engine/session';
import { checkGoal } from '../src/engine/checks';
import { getLevel } from '../src/levels/index';
import { countStatements } from '../src/ui/app';

test('two-names-one-list interactive path matches the level goal', () => {
  const level = getLevel('two-names-one-list')!;
  const state = runFresh('a = [1]\nb = a\na.append(2)');
  const result = checkGoal(level.goal, snapshot(state), state);
  expect(result.ok, result.message).toBe(true);
  expect(countStatements(level.solution as string)).toBe(3);
});

test('visualization inputs are well-formed after aliasing', () => {
  const state = runFresh('a = [1]\nb = a');
  const edges = referenceEdges(state);
  const live = liveObjectIds(state);
  expect(edges.length).toBe(2);
  expect(live.length).toBe(1);
  expect(edges[0].toId).toBe(edges[1].toId);
});
