/**
 * Level pack for LearnPyState.
 *
 * Each level: start source, brief text, goal, par (statement golf), optional hint.
 */

import { preds } from './compare.js';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   brief: string,
 *   hint: string,
 *   start: string,
 *   par: number,
 *   goal: Object,
 *   goalPreview: {vars: Object, aliased?: Array},
 *   solution?: string
 * }} Level
 */

/** @type {{id: string, title: string, levels: Level[]}[]} */
export const sequences = [
  {
    id: 'intro',
    title: 'Bindings',
    levels: [
      {
        id: 'intro-1',
        name: 'First name',
        brief:
          'Bind the name `x` to the integer 3. Names live in the stack frame; small integers live as values, not heap boxes.',
        hint: 'x = 3',
        start: '',
        par: 1,
        goal: {
          type: 'vars',
          vars: { x: { type: 'int', repr: '3' } },
        },
        goalPreview: { vars: { x: { type: 'int', repr: '3' } } },
        solution: 'x = 3',
      },
      {
        id: 'intro-2',
        name: 'Rebind',
        brief:
          'Bind `x` to 1, then rebind `x` to 2. Only the name moves — there is no “slot change” story here, just a new edge.',
        hint: 'Two assignments to the same name.',
        start: '',
        par: 2,
        goal: {
          type: 'vars',
          vars: { x: { type: 'int', repr: '2' } },
        },
        goalPreview: { vars: { x: { type: 'int', repr: '2' } } },
        solution: 'x = 1\nx = 2',
      },
      {
        id: 'intro-3',
        name: 'A real object',
        brief:
          'Bind `xs` to the list `[1, 2, 3]`. Lists are heap objects — the name `xs` holds a reference, not the list itself.',
        hint: 'xs = [1, 2, 3]',
        start: '',
        par: 1,
        goal: {
          type: 'predicates',
          predicates: [
            preds.hasType('xs', 'list'),
            preds.hasRepr('xs', '[1, 2, 3]'),
          ],
        },
        goalPreview: { vars: { xs: { type: 'list', repr: '[1, 2, 3]' } } },
        solution: 'xs = [1, 2, 3]',
      },
    ],
  },
  {
    id: 'aliasing',
    title: 'Aliasing',
    levels: [
      {
        id: 'alias-1',
        name: 'Two names, one list',
        brief:
          'Create `a = [1]` and `b = a` so both names reference the same list. Then append 2 through `a`. `b` must see it.',
        hint: 'b = a copies the reference, not the list.',
        start: '',
        par: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.sharedMutation('a', 'b', '[1, 2]')],
        },
        goalPreview: {
          vars: { a: { type: 'list', repr: '[1, 2]' }, b: { type: 'list', repr: '[1, 2]' } },
          aliased: [['a', 'b']],
        },
        solution: 'a = [1]\nb = a\na.append(2)',
      },
      {
        id: 'alias-2',
        name: 'Copy, do not alias',
        brief:
          'Create `a = [1]`. Bind `b` to a *new* list with the same contents (use `.copy()`). `a` and `b` must be different objects.',
        hint: 'b = a.copy()',
        start: '',
        par: 2,
        goal: {
          type: 'predicates',
          predicates: [
            preds.notAliased('a', 'b'),
            preds.hasRepr('a', '[1]'),
            preds.hasRepr('b', '[1]'),
          ],
        },
        goalPreview: {
          vars: { a: { type: 'list', repr: '[1]' }, b: { type: 'list', repr: '[1]' } },
        },
        solution: 'a = [1]\nb = a.copy()',
      },
      {
        id: 'alias-3',
        name: 'Rebind vs mutate',
        brief:
          'Start with `a = [1]` and `b = a`. Rebind `a` to a new list `[9]`. `b` must still be the old list `[1]`.',
        hint: 'a = [9] rebinds the name; it does not edit the shared object.',
        start: '',
        par: 3,
        goal: {
          type: 'predicates',
          predicates: [
            preds.notAliased('a', 'b'),
            preds.hasRepr('a', '[9]'),
            preds.hasRepr('b', '[1]'),
          ],
        },
        goalPreview: {
          vars: { a: { type: 'list', repr: '[9]' }, b: { type: 'list', repr: '[1]' } },
        },
        solution: 'a = [1]\nb = a\na = [9]',
      },
    ],
  },
  {
    id: 'containers',
    title: 'Containers',
    levels: [
      {
        id: 'box-1',
        name: 'List update in place',
        brief:
          'Bind `xs` to `[1, 2]`, then set index 0 to 9 so the list becomes `[9, 2]` — same object, new contents.',
        hint: 'xs[0] = 9',
        start: '',
        par: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.hasType('xs', 'list'), preds.hasRepr('xs', '[9, 2]')],
        },
        goalPreview: { vars: { xs: { type: 'list', repr: '[9, 2]' } } },
        solution: 'xs = [1, 2]\nxs[0] = 9',
      },
      {
        id: 'box-2',
        name: 'Dict entry',
        brief:
          'Create `d = {"lang": "Python"}` then add the key `"level"` with value `1`. Dict keys are part of the heap object.',
        hint: "d['level'] = 1",
        start: '',
        par: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.hasType('d', 'dict'), preds.hasRepr('d', "{'lang': 'Python', 'level': 1}")],
        },
        goalPreview: { vars: { d: { type: 'dict', repr: "{'lang': 'Python', 'level': 1}" } } },
        solution: 'd = {"lang": "Python"}\nd["level"] = 1',
      },
      {
        id: 'box-3',
        name: 'Tuple identity',
        brief:
          'Create tuple `t = (1, 2)` and bind `u = t`. They must be the same object (`t is u` is True). Tuples are immutable and identity-stable.',
        hint: 'ok = t is u — then bind ok? Goal only checks identity of t and u.',
        start: '',
        par: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.aliased('t', 'u'), preds.hasType('t', 'tuple')],
        },
        goalPreview: {
          vars: { t: { type: 'tuple', repr: '(1, 2)' }, u: { type: 'tuple', repr: '(1, 2)' } },
          aliased: [['t', 'u']],
        },
        solution: 't = (1, 2)\nu = t',
      },
    ],
  },
  {
    id: 'calls',
    title: 'Frames',
    levels: [
      {
        id: 'call-1',
        name: 'Define a function',
        brief:
          'Define `double(n)` that returns `n * 2`. Do not call it yet — just define it so a function object sits on the heap.',
        hint: 'def double(n):\n    return n * 2',
        start: '',
        par: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.hasFunction('double')],
        },
        goalPreview: { vars: { double: { type: 'function', repr: 'function double' } } },
        solution: 'def double(n):\n    return n * 2',
      },
      {
        id: 'call-2',
        name: 'Call and bind',
        brief:
          'Define `double(n)` returning `n * 2`, then bind `r = double(21)` so `r` is 42. Watch the call frame appear and disappear.',
        hint: 'r = double(21)',
        start: '',
        par: 3,
        goal: {
          type: 'vars',
          vars: { r: { type: 'int', repr: '42' } },
        },
        goalPreview: { vars: { r: { type: 'int', repr: '42' } } },
        solution: 'def double(n):\n    return n * 2\nr = double(21)',
      },
      {
        id: 'call-3',
        name: 'Print is not magic',
        brief:
          'Print the line `hello 3` using `print`. Printing does not bind names — it only writes to stdout.',
        hint: "print('hello', 3)",
        start: '',
        par: 1,
        goal: {
          type: 'stdout',
          lines: ['hello 3'],
        },
        goalPreview: { vars: { __stdout__: { type: 'str', repr: "'hello 3'" } } },
        solution: "print('hello', 3)",
      },
    ],
  },
];

/**
 * Flatten all levels in order.
 *
 * @returns {Level[]}
 */
export function allLevels() {
  return sequences.flatMap((s) => s.levels);
}

/**
 * @param {string} id
 * @returns {Level | null}
 */
export function getLevel(id) {
  return allLevels().find((l) => l.id === id) || null;
}

/**
 * @param {string} id
 * @returns {number} index in flat list, or -1
 */
export function levelIndex(id) {
  return allLevels().findIndex((l) => l.id === id);
}
