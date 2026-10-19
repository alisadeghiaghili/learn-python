/**
 * Unit tests for the simulated Python engine and goal compare.
 */

import { describe, test, expect } from 'vitest';

import { runFresh, displayValue, snapshot, referenceEdges, liveObjectIds } from '../src/engine/session';
import { setTraceEnabled, isTraceEnabled } from '../src/engine/evaluator';
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

  test('manual iter() only walks list/tuple/set (strings are walked with for)', () => {
    // The stateful iter()/next() protocol is for containers; a string is walked
    // by a for-loop over its one-letter characters instead.
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

describe('pandas (Phase 2)', () => {
  test('pd.Series builds a Series backed by a buffer', () => {
    const state = runFresh('import pandas as pd\ns = pd.Series([1, 2, 3])');
    const o = state.heap[state.frames[0].locals.s as string];
    expect(o.type).toBe('series');
    const v = o.value as { buffer: string };
    expect(state.heap[v.buffer].type).toBe('buffer');
  });

  test('pd.DataFrame builds a DataFrame over one row-major buffer', () => {
    const state = runFresh('import pandas as pd\ndf = pd.DataFrame({"x": [1, 2], "y": [3, 4]})');
    const o = state.heap[state.frames[0].locals.df as string];
    expect(o.type).toBe('dataframe');
    const v = o.value as { buffer: string; columns: string[] };
    expect(v.columns).toEqual(['x', 'y']);
    // row-major: [1, 3, 2, 4]
    expect(state.heap[v.buffer].repr).toBe('[1, 3, 2, 4]');
  });

  test("df['col'] reads a column as a Series", () => {
    const state = runFresh('import pandas as pd\ndf = pd.DataFrame({"x": [1, 2], "y": [3, 4]})\nc = df["x"]');
    const o = state.heap[state.frames[0].locals.c as string];
    expect(o.type).toBe('series');
    expect(preds.isSeries('c')(snapshot(state), state)).toBe(true);
  });

  test('df.iloc[i] reads a row; iloc slice is a live view (shared buffer)', () => {
    const state = runFresh('import pandas as pd\ndf = pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})\nv = df.iloc[1:3]');
    const dfo = state.heap[state.frames[0].locals.df as string];
    const vo = state.heap[state.frames[0].locals.v as string];
    expect(vo.type).toBe('dataframe');
    // a row-range shares the SAME buffer box as the frame (a view)
    expect(preds.sharesFrameBuffer('df', 'v')(snapshot(state), state)).toBe(true);
    expect(preds.independentFrameBuffer('df', 'v')(snapshot(state), state)).toBe(false);
    expect(preds.rows('v', 2)(snapshot(state), state)).toBe(true);
    expect(dfo).toBeTruthy();
  });

  test('a view mutation is seen through the original (shared buffer)', () => {
    const state = runFresh('import pandas as pd\ndf = pd.DataFrame({"x": [1, 2, 3]})\nv = df.iloc[1:3]\nv.iloc[0] = [99]');
    // the original frame row 1 changed because v is a view over the same buffer
    const bufId = (state.heap[state.frames[0].locals.df as string].value as { buffer: string }).buffer;
    const data = (state.heap[bufId].value as { data: number[] }).data;
    expect(data[1]).toBe(99);
  });

  test('df.copy() mints an independent buffer', () => {
    const state = runFresh('import pandas as pd\ndf = pd.DataFrame({"x": [1, 2], "y": [3, 4]})\nc = df.copy()');
    expect(preds.independentFrameBuffer('df', 'c')(snapshot(state), state)).toBe(true);
    expect(preds.sharesFrameBuffer('df', 'c')(snapshot(state), state)).toBe(false);
  });

  test('df.sum() reduces each column into a Series', () => {
    const state = runFresh('import pandas as pd\ndf = pd.DataFrame({"x": [1, 2], "y": [3, 4]})\ns = df.sum()');
    expect(preds.isSeries('s')(snapshot(state), state)).toBe(true);
  });

  test('pd.read_csv returns a DataFrame labeled with the source file', () => {
    const state = runFresh('import pandas as pd\ndf = pd.read_csv("data.csv", {"x": [1, 2], "y": [3, 4]})');
    const o = state.heap[state.frames[0].locals.df as string];
    expect(o.type).toBe('dataframe');
    expect(o.repr.startsWith('DataFrame (from data.csv)')).toBe(true);
  });

  test('pandas predicates: isDataFrame, rows', () => {
    const state = runFresh('import pandas as pd\ndf = pd.DataFrame({"x": [1, 2, 3]})');
    expect(preds.isDataFrame('df')(snapshot(state), state)).toBe(true);
    expect(preds.rows('df', 3)(snapshot(state), state)).toBe(true);
  });
});

describe('asyncio (concurrency exemplar)', () => {
  test('an async def returns a coroutine (not a result)', () => {
    const state = runFresh(
      'async def greet():\n    print("hi")\n    await None\nc = greet()',
    );
    const o = state.heap[state.frames[0].locals.c as string];
    expect(o.type).toBe('coroutine');
    expect((o.value as { status: string }).status).toBe('pending');
    // calling it did NOT run the body
    expect(state.stdout).toEqual([]);
    expect(preds.isCoroutine('c')(snapshot(state), state)).toBe(true);
  });

  test('create_task wraps a coroutine in a Task', () => {
    const state = runFresh(
      'import asyncio as a\nasync def greet():\n    print("hi")\nc = greet()\nt = a.create_task(c)',
    );
    const to = state.heap[state.frames[0].locals.t as string];
    expect(to.type).toBe('task');
    const tv = to.value as { coro: string; name: string };
    expect(tv.name).toBe('greet');
    // the task points at the same coroutine object
    expect(tv.coro).toBe(state.frames[0].locals.c as string);
    expect(preds.isTask('t')(snapshot(state), state)).toBe(true);
  });

  test('a.run runs one task to completion', () => {
    const state = runFresh(
      'import asyncio as a\nasync def greet():\n    print("A")\n    await None\nt = a.create_task(greet())\na.run(t)',
    );
    expect(state.stdout).toEqual(['A']);
    const to = state.heap[state.frames[0].locals.t as string];
    expect((to.value as { status: string }).status).toBe('done');
    expect(preds.taskStatus('t', 'done')(snapshot(state), state)).toBe(true);
  });

  test('a.run interleaves two tasks (A, B, A, B) via the event loop', () => {
    const state = runFresh(
      [
        'import asyncio as a',
        'async def a_task():',
        '    print("A")',
        '    await None',
        '    print("A done")',
        'async def b_task():',
        '    print("B")',
        '    await None',
        '    print("B done")',
        'ta = a.create_task(a_task())',
        'tb = a.create_task(b_task())',
        'a.run(ta, tb)',
      ].join('\n'),
    );
    // round-robin: each task prints once, yields, and the loop alternates
    expect(state.stdout).toEqual(['A', 'B', 'A done', 'B done']);
    expect(state.ticks).toBe(4);
    expect(preds.loopRan(4)(snapshot(state), state)).toBe(true);
    expect(preds.taskStatus('ta', 'done')(snapshot(state), state)).toBe(true);
    expect(preds.taskStatus('tb', 'done')(snapshot(state), state)).toBe(true);
  });

  test('an await yields a tick; the loop hands it to the other task', () => {
    const state = runFresh(
      [
        'import asyncio as a',
        'async def first():',
        '    print("1a")',
        '    await None',
        '    print("1b")',
        'async def second():',
        '    print("2")',
        't1 = a.create_task(first())',
        't2 = a.create_task(second())',
        'a.run(t1, t2)',
      ].join('\n'),
    );
    // t1 prints "1a", suspends on await; loop moves to t2 ("2"); back to t1 ("1b")
    expect(state.stdout).toEqual(['1a', '2', '1b']);
    // after a.run, t1 finished but t2 also did; exactly the interleaved order above
    expect(preds.loopRan(2)(snapshot(state), state)).toBe(true);
  });

  test('a.sleep is a no-op builtin (the waiting is the await)', () => {
    const state = runFresh(
      [
        'import asyncio as a',
        'async def wait():',
        '    await a.sleep(0.1)',
        '    print("woke")',
        't = a.create_task(wait())',
        'a.run(t)',
      ].join('\n'),
    );
    expect(state.stdout).toEqual(['woke']);
    expect(preds.taskStatus('t', 'done')(snapshot(state), state)).toBe(true);
  });

  test('gather collects finished task results', () => {
    const state = runFresh(
      [
        'import asyncio as a',
        'async def one():',
        '    print("1")',
        '    return 1',
        'async def two():',
        '    print("2")',
        '    return 2',
        't1 = a.create_task(one())',
        't2 = a.create_task(two())',
        'a.run(t1, t2)',
        'r = a.gather(t1, t2)',
      ].join('\n'),
    );
    const ro = state.heap[state.frames[0].locals.r as string];
    expect(ro.type).toBe('list');
    // the coroutines returned 1 and 2
    expect(ro.value).toEqual([1, 2]);
  });

  test('asyncio predicates: isTask, differentTasks, taskStatus', () => {
    const state = runFresh(
      [
        'import asyncio as a',
        'async def x():',
        '    print("x")',
        'async def y():',
        '    print("y")',
        'tx = a.create_task(x())',
        'ty = a.create_task(y())',
      ].join('\n'),
    );
    expect(preds.isTask('tx')(snapshot(state), state)).toBe(true);
    expect(preds.isTask('ty')(snapshot(state), state)).toBe(true);
    expect(preds.differentTasks('tx', 'ty')(snapshot(state), state)).toBe(true);
    // not run yet, so not done
    expect(preds.taskStatus('tx', 'done')(snapshot(state), state)).not.toBe(true);
  });
});

describe('threading (concurrency exemplar)', () => {
  test('a threading.Thread builds a not-started thread (target has not run)', () => {
    const state = runFresh(
      [
        'import threading as t',
        'def bump(box):',
        '    v = box[0]',
        '    box[0] = v + 1',
        'box = [0]',
        'w = t.Thread(bump, (box,))',
      ].join('\n'),
    );
    const o = state.heap[state.frames[0].locals.w as string];
    expect(o.type).toBe('thread');
    const tv = o.value as { name: string; status: string };
    expect(tv.name).toBe('bump');
    expect(tv.status).toBe('not-started');
    // the target did NOT run — box is still [0]
    expect(state.stdout).toEqual([]);
    expect(preds.isThread('w')(snapshot(state), state)).toBe(true);
    expect(preds.threadStatus('w', 'not-started')(snapshot(state), state)).toBe(true);
  });

  test('join runs one thread to completion, mutating the shared box', () => {
    const state = runFresh(
      [
        'import threading as t',
        'def bump(box):',
        '    v = box[0]',
        '    box[0] = v + 1',
        'box = [0]',
        'w = t.Thread(bump, (box,))',
        'w.start()',
        'w.join()',
      ].join('\n'),
    );
    // one thread did its read-modify-write once → box is [1]
    expect(preds.listValueAt('box', 0, 1)(snapshot(state))).toBe(true);
    expect(preds.threadStatus('w', 'done')(snapshot(state), state)).toBe(true);
  });

  test('two threads interleave on shared state → lost update (box ends at 1, not 2)', () => {
    const state = runFresh(
      [
        'import threading as t',
        'def bump(box):',
        '    v = box[0]',
        '    box[0] = v + 1',
        'box = [0]',
        't1 = t.Thread(bump, (box,))',
        't2 = t.Thread(bump, (box,))',
        't1.start()',
        't2.start()',
        't1.join()',
      ].join('\n'),
    );
    // Both read box[0]=0 before either wrote: the second write clobbers the first.
    // The counter ends at 1 — a data race (lost update) — not the expected 2.
    expect(preds.listValueAt('box', 0, 1)(snapshot(state))).toBe(true);
    expect(preds.threadStatus('t1', 'done')(snapshot(state), state)).toBe(true);
    expect(preds.threadStatus('t2', 'done')(snapshot(state), state)).toBe(true);
  });

  test('wrapping the critical section in a lock fixes the race (box ends at 2)', () => {
    const state = runFresh(
      [
        'import threading as t',
        'def bump(box, lk):',
        '    lk.acquire()',
        '    v = box[0]',
        '    box[0] = v + 1',
        '    lk.release()',
        'box = [0]',
        'lk = t.Lock()',
        't1 = t.Thread(bump, (box, lk))',
        't2 = t.Thread(bump, (box, lk))',
        't1.start()',
        't2.start()',
        't1.join()',
      ].join('\n'),
    );
    // Mutual exclusion serializes the read-modify-write → no lost update.
    expect(preds.listValueAt('box', 0, 2)(snapshot(state))).toBe(true);
    expect(preds.threadStatus('t1', 'done')(snapshot(state), state)).toBe(true);
    expect(preds.threadStatus('t2', 'done')(snapshot(state), state)).toBe(true);
    // back to free once every thread has released
    expect(preds.lockFree('lk')(snapshot(state), state)).toBe(true);
  });

  test('a held lock blocks the caller (suspends, retries on the next round)', () => {
    const state = runFresh(
      [
        'import threading as t',
        'def hold(lk):',
        '    lk.acquire()',
        '    print("A holds")',
        '    lk.release()',
        'def wait_then(lk):',
        '    lk.acquire()',
        '    print("B proceeds")',
        '    lk.release()',
        'lk = t.Lock()',
        'ta = t.Thread(hold, (lk,))',
        'tb = t.Thread(wait_then, (lk,))',
        'ta.start()',
        'tb.start()',
        'ta.join()',
      ].join('\n'),
    );
    // B could only print AFTER A released the lock → the output is ordered
    expect(state.stdout).toEqual(['A holds', 'B proceeds']);
    expect(preds.lockFree('lk')(snapshot(state), state)).toBe(true);
  });

  test('threading predicates: isThread, differentThreads, threadStatus, isLock', () => {
    const state = runFresh(
      [
        'import threading as t',
        'def x(box):',
        '    v = box[0]',
        '    box[0] = v + 1',
        'def y(box):',
        '    print("y")',
        'box = [0]',
        'tx = t.Thread(x, (box,))',
        'ty = t.Thread(y, (box,))',
        'lk = t.Lock()',
      ].join('\n'),
    );
    expect(preds.isThread('tx')(snapshot(state), state)).toBe(true);
    expect(preds.isThread('ty')(snapshot(state), state)).toBe(true);
    expect(preds.differentThreads('tx', 'ty')(snapshot(state), state)).toBe(true);
    expect(preds.threadStatus('tx', 'not-started')(snapshot(state), state)).toBe(true);
    expect(preds.isLock('lk')(snapshot(state), state)).toBe(true);
    expect(preds.lockFree('lk')(snapshot(state), state)).toBe(true);
  });
});

describe('control flow (if / for / while / range / break / continue)', () => {
  test('if / elif / else branches on the truthy condition', () => {
    const state = runFresh([
      'n = 3',
      'if n > 5:',
      '    print("big")',
      'elif n > 1:',
      '    print("mid")',
      'else:',
      '    print("small")',
    ].join('\n'));
    expect(state.stdout).toEqual(['mid']);
  });

  test('for over range(4) accumulates and leaves the loop variable bound', () => {
    const state = runFresh([
      'total = 0',
      'for i in range(4):',
      '    total = total + i',
    ].join('\n'));
    expect(state.frames[0].locals.total).toBe(6); // 0+1+2+3
    expect(state.frames[0].locals.i).toBe(3); // last value stays bound
  });

  test('for over a list walks each element in order', () => {
    const state = runFresh([
      'xs = [10, 20, 30]',
      'n = 0',
      'for x in xs:',
      '    n = n + x',
    ].join('\n'));
    expect(state.frames[0].locals.n).toBe(60);
  });

  test('for over a raw string literal yields one-letter strings', () => {
    const state = runFresh([
      'n = 0',
      'for c in "ab":',
      '    n = n + 1',
    ].join('\n'));
    expect(state.frames[0].locals.n).toBe(2);
  });

  test('while loops until the condition is false', () => {
    const state = runFresh([
      'i = 0',
      'while i < 3:',
      '    i = i + 1',
    ].join('\n'));
    expect(state.frames[0].locals.i).toBe(3);
  });

  test('break exits the innermost loop early', () => {
    const state = runFresh([
      'out = []',
      'for i in range(10):',
      '    if i == 3:',
      '        break',
      '    out.append(i)',
    ].join('\n'));
    expect(state.heap[state.frames[0].locals.out as string].repr).toBe('[0, 1, 2]');
  });

  test('continue skips to the next iteration', () => {
    const state = runFresh([
      'out = []',
      'for i in range(4):',
      '    if i == 2:',
      '        continue',
      '    out.append(i)',
    ].join('\n'));
    expect(state.heap[state.frames[0].locals.out as string].repr).toBe('[0, 1, 3]');
  });

  test('range supports start/stop and step (including negative step)', () => {
    const a = runFresh('r = range(2, 8, 2)');
    expect(a.heap[a.frames[0].locals.r as string].repr).toBe('[2, 4, 6]');
    const b = runFresh('r = range(5, 0, -1)');
    expect(b.heap[b.frames[0].locals.r as string].repr).toBe('[5, 4, 3, 2, 1]');
  });

  test('nested control flow (if inside a for) composes', () => {
    const state = runFresh([
      'n = 0',
      'for i in range(3):',
      '    if i > 0:',
      '        n = n + i',
    ].join('\n'));
    expect(state.frames[0].locals.n).toBe(3); // 1 + 2
  });
});

describe('step recording (watch it run)', () => {
  test('is off by default so normal runs never pay for cloning', () => {
    expect(isTraceEnabled()).toBe(false);
    const state = runFresh('x = 1\nfor i in range(3):\n    x = x + 1');
    expect(state.trace).toBeUndefined();
    expect(state.frames[0].locals.x).toBe(4);
  });

  test('records the pre-run frame and one frame per loop iteration', () => {
    setTraceEnabled(true);
    try {
      const state = runFresh([
        'n = 0',
        'for i in range(4):',
        '    n = n + i',
      ].join('\n'));
      const trace = state.trace ?? [];
      expect(trace.length).toBeGreaterThanOrEqual(5);
      // The accumulator visibly grows as the loop builds: a mid-loop 1 and a final 6.
      const ns = trace.map((f) => f.frames[0].locals.n as number | undefined);
      expect(ns).toContain(1);
      expect(ns[ns.length - 1]).toBe(6);
      // Frames do not nest the (growing) trace array inside themselves.
      expect(trace[0].trace).toBeUndefined();
    } finally {
      setTraceEnabled(false);
    }
  });
});
