/**
 * Unit tests for the simulated Python engine and goal compare.
 */

import { describe, test, expect } from 'vitest';

import { runFresh, displayValue, snapshot, referenceEdges, liveObjectIds } from '../src/engine/session';
import { checkGoal, preds, deepEqual } from '../src/engine/checks';

describe('engine', () => {
  test('literal assignment binds name and allocates primitives without heap for ints', () => {
    const state = runFresh('x = 3');
    expect(state.frames[0].locals.x).toBe(3);
    expect(displayValue(state.frames[0].locals.x, state)).toBe('3');
  });

  test('list allocation creates heap object and reference edge', () => {
    const state = runFresh('a = [1, 2]');
    const id = state.frames[0].locals.a as string;
    expect(state.heap[id]).toBeTruthy();
    expect(state.heap[id].type).toBe('list');
    expect(state.heap[id].repr).toBe('[1, 2]');
    const edges = referenceEdges(state);
    expect(edges.length).toBe(1);
    expect(edges[0].name).toBe('a');
    expect(edges[0].toId).toBe(id);
  });

  test('aliasing shares one heap object', () => {
    const state = runFresh('a = [1]\nb = a\na.append(2)');
    const a = state.frames[0].locals.a as string;
    const b = state.frames[0].locals.b as string;
    expect(a).toBe(b);
    expect(state.heap[a].repr).toBe('[1, 2]');
  });

  test('rebinding a name does not mutate the old object', () => {
    const state = runFresh('a = [1]\nb = a\na = [9]');
    expect(state.frames[0].locals.a).not.toBe(state.frames[0].locals.b);
    expect(state.heap[state.frames[0].locals.b as string].repr).toBe('[1]');
    expect(state.heap[state.frames[0].locals.a as string].repr).toBe('[9]');
  });

  test('dict create, setitem, get', () => {
    const state = runFresh("d = {'k': 1}\nd['k'] = 2\nx = d['k']");
    expect(state.frames[0].locals.x).toBe(2);
    expect(state.heap[state.frames[0].locals.d as string].repr).toBe("{'k': 2}");
  });

  test('function call pushes frame and return value', () => {
    const state = runFresh('def add(a, b):\n    return a + b\n\nr = add(2, 3)');
    expect(state.frames[0].locals.r).toBe(5);
    expect(state.frames.length).toBe(1);
  });

  test('print captures stdout', () => {
    const state = runFresh('print(1, 2)');
    expect(state.stdout).toEqual(['1 2']);
  });

  test('runtime errors are recorded and thrown', () => {
    expect(() => runFresh('y = 1/0')).toThrow(/ZeroDivisionError/);
  });

  test('snapshot normalizes heap ids for compare', () => {
    const state = runFresh('a = [1]\nb = a');
    const snap = snapshot(state);
    const id = snap.frames[0].locals.a;
    expect(snap.frames[0].locals.b).toBe(id);
    expect(snap.heap[id as string].repr).toBe('[1]');
  });

  test('goal vars match shared mutation', () => {
    const state = runFresh('a = [1]\nb = a\na.append(2)');
    const snap = snapshot(state);
    const goal = {
      type: 'predicates' as const,
      predicates: [preds.sharedMutation('a', 'b', '[1, 2]'), preds.aliased('a', 'b')],
    };
    const result = checkGoal(goal, snap, state);
    expect(result.ok).toBe(true);
  });

  test('goal vars fail with clear message', () => {
    const state = runFresh('a = [1]');
    const snap = snapshot(state);
    const goal = {
      type: 'predicates' as const,
      predicates: [preds.hasRepr('a', '[1, 2]')],
    };
    const result = checkGoal(goal, snap, state);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/expected \[1, 2\]/);
  });

  test('deepEqual handles nested structures', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1] }, { a: [1, 2] })).toBe(false);
  });

  test('liveObjectIds marks unreachable garbage as dead', () => {
    const state = runFresh('a = [1]\na = [2]');
    const live = liveObjectIds(state);
    expect(live.length).toBe(1);
    expect(live[0]).toBe(state.frames[0].locals.a);
  });

  test('tuple and is-identity', () => {
    const state = runFresh('t = (1, 2)\nu = t\nok = t is u');
    expect(state.frames[0].locals.ok).toBe(true);
  });

  test('subscript assignment on list mutates in place', () => {
    const state = runFresh('a = [1, 2]\na[0] = 9');
    expect(state.heap[state.frames[0].locals.a as string].repr).toBe('[9, 2]');
  });

  test('set literal de-duplicates and keeps set type', () => {
    const state = runFresh('s = {1, 2, 2, 3}');
    const id = state.frames[0].locals.s as string;
    expect(state.heap[id].type).toBe('set');
    expect(state.heap[id].repr).toBe('{1, 2, 3}');
  });

  test('dict literal is still a dict, not a set', () => {
    const state = runFresh('d = {1: 2, 3: 4}');
    const id = state.frames[0].locals.d as string;
    expect(state.heap[id].type).toBe('dict');
    expect(state.heap[id].repr).toBe('{1: 2, 3: 4}');
  });

  test('set() builtin builds a set from a list', () => {
    const state = runFresh('a = [1, 2, 2]\ns = set(a)');
    const id = state.frames[0].locals.s as string;
    expect(state.heap[id].type).toBe('set');
    expect(state.heap[id].repr).toBe('{1, 2}');
  });

  test('scatter() pushes a plot spec', () => {
    const state = runFresh('x = [1, 2]\ny = [1, 4]\nscatter(x, y)');
    expect(state.plots.length).toBe(1);
    expect(state.plots[0].kind).toBe('scatter');
    expect(state.plots[0].points).toEqual([[1, 1], [2, 4]]);
  });

  test('line() pushes a line plot with a title', () => {
    const state = runFresh('x = [1, 2]\ny = [2, 4]\nline(x, y, "trend")');
    expect(state.plots.length).toBe(1);
    expect(state.plots[0].kind).toBe('line');
    expect(state.plots[0].title).toBe('trend');
  });

  test('hasPlot predicate passes once a plot exists', () => {
    const state = runFresh('x = [1, 2]\ny = [1, 4]\nscatter(x, y)');
    const goal = { type: 'plot' as const, kind: 'scatter' as const };
    expect(checkGoal(goal, snapshot(state), state).ok).toBe(true);
    const none = runFresh('x = [1]');
    expect(checkGoal(goal, snapshot(none), none).ok).toBe(false);
  });
});
