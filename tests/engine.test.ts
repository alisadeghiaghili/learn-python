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

describe('import + copy/deepcopy (Phase 0a)', () => {
  test('import binds a module object', () => {
    const state = runFresh('import copy as cp');
    const id = state.frames[0].locals.cp as string;
    expect(state.heap[id].type).toBe('module');
    expect(state.heap[id].repr).toBe("<module 'copy'>");
  });

  test('bare import binds the module name', () => {
    const state = runFresh('import copy');
    const id = state.frames[0].locals.copy as string;
    expect(state.heap[id].type).toBe('module');
  });

  test('cp.copy shallow-copies: new outer, shared nested child', () => {
    const state = runFresh('import copy as cp\na = {"k": [1, 2]}\nb = cp.copy(a)');
    const a = state.frames[0].locals.a as string;
    const b = state.frames[0].locals.b as string;
    expect(a).not.toBe(b); // different dict boxes
    expect(state.heap[a].type).toBe('dict');
    expect(state.heap[b].type).toBe('dict');
    // both dicts point at the SAME inner list
    const innerOf = (id: string) => (state.heap[id].value as Array<[string, string]>)[0]![1];
    expect(innerOf(a)).toBe(innerOf(b));
    expect(state.heap[innerOf(a)].type).toBe('list');
  });

  test('cp.deepcopy is fully independent: no shared child', () => {
    const state = runFresh('import copy as cp\na = {"k": [1, 2]}\nc = cp.deepcopy(a)');
    const a = state.frames[0].locals.a as string;
    const c = state.frames[0].locals.c as string;
    expect(a).not.toBe(c);
    const innerOf = (id: string) => (state.heap[id].value as Array<[string, string]>)[0]![1];
    expect(innerOf(a)).not.toBe(innerOf(c)); // independent inner lists
  });

  test('deepcopy of a nested list is independent', () => {
    const state = runFresh('import copy as cp\na = [1, [2, 3]]\nc = cp.deepcopy(a)');
    const a = state.frames[0].locals.a as string;
    const c = state.frames[0].locals.c as string;
    const innerOf = (id: string) => (state.heap[id].value as string[])[1]!;
    expect(innerOf(a)).not.toBe(innerOf(c));
  });

  test('sharesChild: true for shallow copy, false for deep copy', () => {
    const shallow = runFresh('import copy as cp\na = {"k": [1, 2]}\nb = cp.copy(a)');
    expect(preds.sharesChild('a', 'b')(snapshot(shallow), shallow)).toBe(true);
    const deep = runFresh('import copy as cp\na = {"k": [1, 2]}\nc = cp.deepcopy(a)');
    expect(preds.sharesChild('a', 'c')(snapshot(deep), deep)).toBe(false);
  });

  test('independent: false for shallow copy, true for deep copy', () => {
    const shallow = runFresh('import copy as cp\na = {"k": [1, 2]}\nb = cp.copy(a)');
    expect(preds.independent('a', 'b')(snapshot(shallow), shallow)).toBe(false);
    const deep = runFresh('import copy as cp\na = {"k": [1, 2]}\nc = cp.deepcopy(a)');
    expect(preds.independent('a', 'c')(snapshot(deep), deep)).toBe(true);
  });

  test('shallow .copy() shares the nested list; mutating through one is seen by the other', () => {
    const state = runFresh('a = [1, [2]]\nb = a.copy()\na[1].append(3)');
    expect(state.heap[state.frames[0].locals.a as string].repr).toBe('[1, [2, 3]]');
    expect(state.heap[state.frames[0].locals.b as string].repr).toBe('[1, [2, 3]]');
  });
});

describe('iterators (Phase 0b)', () => {
  test('iter() returns a stateful iterator over the source', () => {
    const state = runFresh('xs = [1, 2, 3]\nit = iter(xs)');
    const id = state.frames[0].locals.it as string;
    const src = state.frames[0].locals.xs as string;
    const o = state.heap[id];
    expect(o.type).toBe('listiter');
    expect((o.value as { source: string }).source).toBe(src);
    expect((o.value as { index: number }).index).toBe(0);
  });

  test('next() advances the iterator one step at a time', () => {
    const state = runFresh('xs = [1, 2, 3]\nit = iter(xs)\na = next(it)\nb = next(it)');
    expect(state.frames[0].locals.a).toBe(1);
    expect(state.frames[0].locals.b).toBe(2);
    const it = state.frames[0].locals.it as string;
    expect((state.heap[it].value as { index: number }).index).toBe(2);
  });

  test('two iterators over the same list are independent objects', () => {
    const state = runFresh('xs = [1, 2]\nit = iter(xs)\njt = iter(xs)\nnext(it)');
    const it = state.frames[0].locals.it as string;
    const jt = state.frames[0].locals.jt as string;
    const src = state.frames[0].locals.xs as string;
    expect(it).not.toBe(jt);
    expect((state.heap[it].value as { source: string }).source).toBe(src);
    expect((state.heap[jt].value as { source: string }).source).toBe(src);
    expect((state.heap[it].value as { index: number }).index).toBe(1);
    expect((state.heap[jt].value as { index: number }).index).toBe(0);
  });

  test('next() on an exhausted iterator raises StopIteration', () => {
    expect(() => runFresh('it = iter([])\nnext(it)')).toThrow(/StopIteration/);
    expect(() => runFresh('xs = [1]\nit = iter(xs)\nnext(it)\nnext(it)')).toThrow(/StopIteration/);
  });

  test('iterator predicates: iteratesOver, iteratorIndex, exhausted', () => {
    const state = runFresh('xs = [1, 2, 3]\nit = iter(xs)\nnext(it)');
    expect(preds.iteratesOver('it', 'xs')(snapshot(state), state)).toBe(true);
    expect(preds.iteratorIndex('it', 1)(snapshot(state), state)).toBe(true);
    const done = runFresh('xs = [1]\nit = iter(xs)\nnext(it)');
    expect(preds.exhausted('it')(snapshot(done), done)).toBe(true);
    expect(preds.exhausted('it')(snapshot(state), state)).toBe(false);
  });

  test('iter() works over tuples too', () => {
    const state = runFresh('it = iter((7, 8, 9))\na = next(it)');
    expect(state.frames[0].locals.a).toBe(7);
  });

  test('iter() of a non-iterable raises TypeError', () => {
    expect(() => runFresh('x = 5\nit = iter(x)')).toThrow(/not iterable/);
  });

  test('iter() of a string literal raises (strings are not heap objects here)', () => {
    expect(() => runFresh('it = iter("ab")')).toThrow(/not iterable/);
  });

  test('next() of a non-iterator raises TypeError', () => {
    expect(() => runFresh('x = [1]\nnext(x)')).toThrow(/not an iterator/);
  });

  test('deep copy does NOT clone a nested iterator (it is shared, not a container)', () => {
    const state = runFresh('import copy as cp\nxs = [1, 2]\nit = iter(xs)\ndata = [[1], it]\ncp2 = cp.deepcopy(data)');
    const data = state.frames[0].locals.data as string;
    const cp2 = state.frames[0].locals.cp2 as string;
    const itv = state.frames[0].locals.it as string;
    // the inner [1] is a fresh container...
    expect((state.heap[data].value as string[])[0]).not.toBe((state.heap[cp2].value as string[])[0]);
    // ...but the iterator element is the SAME object (deepcopy treats it as a leaf)
    expect((state.heap[data].value as string[])[1]).toBe(itv);
    expect((state.heap[cp2].value as string[])[1]).toBe(itv);
  });

  test('an unreachable iterator is garbage-collected', () => {
    const state = runFresh('a = [1, 2]\nit = iter(a)\nit = [9]'); // old iterator now unreachable
    const live = liveObjectIds(state);
    expect(live.some((id) => state.heap[id]?.type === 'listiter')).toBe(false);
    // the list `a` is still alive via its own name
    expect(state.heap[state.frames[0].locals.a as string].repr).toBe('[1, 2]');
  });
});

describe('defaultdict + functional (Phase 0c/0d)', () => {
  test('defaultdict(int) auto-defaults missing keys to 0', () => {
    const state = runFresh("import collections as c\nd = c.defaultdict(int)\nk = d['missing']");
    const d = state.frames[0].locals.d as string;
    expect(state.frames[0].locals.k).toBe(0);
    expect(state.heap[d].type).toBe('defaultdict');
    expect(state.heap[d].repr).toBe("{'missing': 0}");
  });

  test('defaultdict(list) auto-defaults to a fresh empty list', () => {
    const state = runFresh("import collections as c\nd = c.defaultdict(list)\nxs = d['nums']");
    const xs = state.frames[0].locals.xs as string;
    expect(state.heap[xs].type).toBe('list');
    expect(state.heap[xs].repr).toBe('[]');
  });

  test('setitem on defaultdict stores the given value', () => {
    const state = runFresh("import collections as c\nd = c.defaultdict(int)\nd['a'] = 5\nx = d['a']");
    expect(state.frames[0].locals.x).toBe(5);
    expect(state.heap[state.frames[0].locals.d as string].repr).toBe("{'a': 5}");
  });

  test('map applies a builtin over an iterator lazily', () => {
    const state = runFresh("xs = ['1', '2']\nms = map(int, xs)\na = next(ms)");
    const ms = state.frames[0].locals.ms as string;
    expect(state.heap[ms].type).toBe('mapiter');
    expect(state.frames[0].locals.a).toBe(1);
  });

  test('filter keeps only truthy elements', () => {
    const state = runFresh('xs = [0, 1, 2, 3]\nfs = filter(bool, xs)\na = next(fs)');
    const fs = state.frames[0].locals.fs as string;
    expect(state.heap[fs].type).toBe('filteriter');
    expect(state.frames[0].locals.a).toBe(1);
  });

  test('reduce folds a two-arg function over the sequence', () => {
    const state = runFresh(
      'def add(a, b):\n    return a + b\nimport functools as f\nr = f.reduce(add, [1, 2, 3, 4])',
    );
    expect(state.frames[0].locals.r).toBe(10);
  });

  test('map chain keeps the function and source visible', () => {
    const state = runFresh('xs = [1, 2]\nms = map(int, xs)');
    const v = state.heap[state.frames[0].locals.ms as string].value as { source: string; fn: string };
    expect(state.heap[v.source]?.type).toBe('listiter');
    expect(state.heap[v.fn]?.type).toBe('builtin');
  });

  test('isDefaultDict predicate', () => {
    const state = runFresh('import collections as c\nd = c.defaultdict(int)');
    expect(preds.isDefaultDict('d')(snapshot(state))).toBe(true);
    const plain = runFresh("d = {'a': 1}");
    expect(preds.isDefaultDict('d')(snapshot(plain))).toBe(false);
  });
});

describe('numpy (Phase 1)', () => {
  test('np.array builds an ndarray backed by a separate buffer', () => {
    const state = runFresh('import numpy as np\na = np.array([1, 2, 3])');
    const a = state.frames[0].locals.a as string;
    const o = state.heap[a];
    expect(o.type).toBe('ndarray');
    const v = o.value as { buffer: string };
    const buf = state.heap[v.buffer];
    expect(buf.type).toBe('buffer');
    expect(buf.repr).toBe('[1, 2, 3]');
  });

  test('ndarray repr mirrors numpy float style', () => {
    const state = runFresh('import numpy as np\na = np.array([1, 2, 3])');
    expect(state.heap[state.frames[0].locals.a as string].repr).toBe('[1. 2. 3.]');
  });

  test('.copy() mints a new buffer (independent)', () => {
    const state = runFresh('import numpy as np\na = np.array([1, 2])\nb = a.copy()');
    const a = state.frames[0].locals.a as string;
    const b = state.frames[0].locals.b as string;
    const bufA = (state.heap[a].value as { buffer: string }).buffer;
    const bufB = (state.heap[b].value as { buffer: string }).buffer;
    expect(bufA).not.toBe(bufB);
  });

  test('a slice is a view sharing the SAME buffer', () => {
    const state = runFresh('import numpy as np\na = np.array([1, 2, 3])\nv = a[:2]');
    const a = state.frames[0].locals.a as string;
    const v = state.frames[0].locals.v as string;
    const vObj = state.heap[v];
    expect(vObj.type).toBe('ndarray');
    const vv = vObj.value as { buffer: string; view: boolean };
    const av = state.heap[a].value as { buffer: string };
    expect(vv.buffer).toBe(av.buffer); // same buffer
    expect(vv.view).toBe(true);
    // the buffer keeps the full run; the view is a window over its front
    expect(state.heap[vv.buffer].repr).toBe('[1, 2, 3]');
    expect(state.heap[v].repr).toBe('[1. 2.]');
  });

  test('a view mutation is seen through the original (shared buffer)', () => {
    const state = runFresh('import numpy as np\na = np.array([1, 2, 3])\nv = a[:2]\nv[0] = 9');
    const a = state.frames[0].locals.a as string;
    const buf = (state.heap[a].value as { buffer: string }).buffer;
    expect(state.heap[buf].repr).toBe('[9, 2, 3]');
  });

  test('vectorized a + 1 builds a new independent buffer', () => {
    const state = runFresh('import numpy as np\na = np.array([1, 2])\nb = a + 1');
    const b = state.frames[0].locals.b as string;
    const bObj = state.heap[b];
    expect(bObj.type).toBe('ndarray');
    expect(bObj.repr).toBe('[2. 3.]');
    const bufA = (state.heap[state.frames[0].locals.a as string].value as { buffer: string }).buffer;
    const bufB = (bObj.value as { buffer: string }).buffer;
    expect(bufA).not.toBe(bufB);
  });

  test('.sum() folds the buffer into a scalar', () => {
    const state = runFresh('import numpy as np\na = np.array([1, 2, 3])\ns = a.sum()');
    expect(state.frames[0].locals.s).toBe(6);
  });

  test('numpy predicates: isNdarray, sharesBuffer, independentBuffer', () => {
    const view = runFresh('import numpy as np\na = np.array([1, 2, 3])\nv = a[:2]');
    expect(preds.isNdarray('a')(snapshot(view), view)).toBe(true);
    expect(preds.sharesBuffer('a', 'v')(snapshot(view), view)).toBe(true);
    expect(preds.independentBuffer('a', 'v')(snapshot(view), view)).toBe(false);

    const copy = runFresh('import numpy as np\na = np.array([1, 2])\nb = a.copy()');
    expect(preds.sharesBuffer('a', 'b')(snapshot(copy), copy)).toBe(false);
    expect(preds.independentBuffer('a', 'b')(snapshot(copy), copy)).toBe(true);
  });
});
