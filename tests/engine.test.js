/**
 * Unit tests for the simulated Python engine and goal compare.
 * Run: node --test tests/
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { runFresh, displayValue, snapshot, referenceEdges, liveObjectIds } from '../js/engine/index.js';
import { checkGoal, preds, deepEqual } from '../js/levels/compare.js';

test('literal assignment binds name and allocates primitives without heap for ints', () => {
  const state = runFresh('x = 3');
  assert.equal(state.frames[0].locals.x, 3);
  assert.equal(displayValue(state.frames[0].locals.x, state), '3');
});

test('list allocation creates heap object and reference edge', () => {
  const state = runFresh('a = [1, 2]');
  const id = state.frames[0].locals.a;
  assert.ok(state.heap[id]);
  assert.equal(state.heap[id].type, 'list');
  assert.equal(state.heap[id].repr, '[1, 2]');
  const edges = referenceEdges(state);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].name, 'a');
  assert.equal(edges[0].toId, id);
});

test('aliasing shares one heap object', () => {
  const state = runFresh('a = [1]\nb = a\na.append(2)');
  const a = state.frames[0].locals.a;
  const b = state.frames[0].locals.b;
  assert.equal(a, b);
  assert.equal(state.heap[a].repr, '[1, 2]');
});

test('rebinding a name does not mutate the old object', () => {
  const state = runFresh('a = [1]\nb = a\na = [9]');
  assert.notEqual(state.frames[0].locals.a, state.frames[0].locals.b);
  assert.equal(state.heap[state.frames[0].locals.b].repr, '[1]');
  assert.equal(state.heap[state.frames[0].locals.a].repr, '[9]');
});

test('dict create, setitem, get', () => {
  const state = runFresh("d = {'k': 1}\nd['k'] = 2\nx = d['k']");
  assert.equal(state.frames[0].locals.x, 2);
  assert.equal(state.heap[state.frames[0].locals.d].repr, "{'k': 2}");
});

test('function call pushes frame and return value', () => {
  const state = runFresh('def add(a, b):\n    return a + b\n\nr = add(2, 3)');
  assert.equal(state.frames[0].locals.r, 5);
  assert.equal(state.frames.length, 1);
});

test('print captures stdout', () => {
  const state = runFresh('print(1, 2)');
  assert.deepEqual(state.stdout, ['1 2']);
});

test('runtime errors are recorded and thrown', () => {
  const state = runFresh();
  assert.throws(() => {
    // re-run on same state pattern
    runFresh('y = 1/0');
  }, /ZeroDivisionError/);
});

test('snapshot normalizes heap ids for compare', () => {
  const state = runFresh('a = [1]\nb = a');
  const snap = snapshot(state);
  const id = snap.frames[0].locals.a;
  assert.equal(snap.frames[0].locals.b, id);
  assert.equal(snap.heap[id].repr, '[1]');
});

test('goal vars match shared mutation', () => {
  const state = runFresh('a = [1]\nb = a\na.append(2)');
  const snap = snapshot(state);
  const goal = {
    type: 'predicates',
    predicates: [preds.sharedMutation('a', 'b', '[1, 2]'), preds.aliased('a', 'b')],
  };
  const result = checkGoal(goal, snap, state);
  assert.equal(result.ok, true);
});

test('goal vars fail with clear message', () => {
  const state = runFresh('a = [1]');
  const snap = snapshot(state);
  const goal = {
    type: 'predicates',
    predicates: [preds.hasRepr('a', '[1, 2]')],
  };
  const result = checkGoal(goal, snap, state);
  assert.equal(result.ok, false);
  assert.match(result.message, /expected \[1, 2\]/);
});

test('deepEqual handles nested structures', () => {
  assert.equal(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
  assert.equal(deepEqual({ a: [1] }, { a: [1, 2] }), false);
});

test('liveObjectIds marks unreachable garbage as dead', () => {
  const state = runFresh('a = [1]\na = [2]');
  const live = liveObjectIds(state);
  assert.equal(live.length, 1);
  assert.equal(live[0], state.frames[0].locals.a);
});

test('tuple and is-identity', () => {
  const state = runFresh('t = (1, 2)\nu = t\nok = t is u');
  assert.equal(state.frames[0].locals.ok, true);
});

test('subscript assignment on list mutates in place', () => {
  const state = runFresh('a = [1, 2]\na[0] = 9');
  assert.equal(state.heap[state.frames[0].locals.a].repr, '[9, 2]');
});
