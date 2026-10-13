/**
 * Series: Containers in Memory.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'containers',
    title: 'Containers in Memory',
    levels: [
      {
        id: 'list-update-in-place',
        eli: 'eli10',
        name: 'List update in place',
        brief: 'Bind `xs` to `[1, 2]`, then set index 0 to 9 so the list becomes `[9, 2]` — same object, new contents.',
        hint: 'xs[0] = 9',
        start: '',
        par: 2,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.hasType('xs', 'list'), preds.hasRepr('xs', '[9, 2]')],
        },
        solution: 'xs = [1, 2]\nxs[0] = 9',
        lesson: `\`xs[0] = 9\` edits the list **in place** — the same heap object now holds a different first element. No new object, no rebind; the amber edges are unchanged, the box’s contents changed.

Subscript assignment mutates the container it names, which is exactly what you expect for in-place updates.`,
        learning: ['Index assignment mutates the container in place', 'The object identity is preserved across in-place edits'],
        fieldNotes: ['In-place ops are what make `for` loops over lists efficient', 'Be careful mutating a list you are iterating over'],
      },
      {
        id: 'dict-entry',
        eli: 'eli10',
        name: 'Dict entry',
        brief: 'Create `d = {"lang": "Python"}` then add the key `"level"` with value `1`. Keys and values both live inside the heap object.',
        hint: "d['level'] = 1",
        start: '',
        par: 2,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.hasType('d', 'dict'), preds.hasRepr('d', "{'lang': 'Python', 'level': 1}")],
        },
        solution: 'd = {"lang": "Python"}\nd["level"] = 1',
        lesson: `A dictionary is one heap object holding **key → value pairs**. \`d["level"] = 1\` inserts a new pair into the existing box rather than rebindinng \`d\`.

Keys are part of the object; setting a brand-new key grows the object in place. The name \`d\` still points at the very same box it did before.`,
        learning: ['A dict is a single heap object of key/value pairs', 'Setting a new key mutates the dict in place'],
        fieldNotes: ['`dict` lookup is amortized O(1) via a hash table', 'Keys must be hashable — unhashable lists cannot be keys'],
      },
      {
        id: 'tuple-identity',
        eli: 'eli10',
        name: 'Tuple identity',
        brief: 'Create tuple `t = (1, 2)` and bind `u = t`. They must be the same object — tuples are immutable and identity-stable.',
        hint: 't = (1, 2) then u = t',
        start: '',
        par: 2,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.aliased('t', 'u'), preds.hasType('t', 'tuple')],
        },
        solution: 't = (1, 2)\nu = t',
        lesson: `Tuples are immutable, so aliasing one is always safe: there is no in-place edit to accidentally share. \`u = t\` binds \`u\` to the same tuple object.

Because tuples cannot change, you can freely pass them around and even use them as dictionary keys — something mutable lists cannot do.`,
        learning: ['Tuples are immutable, so aliasing is safe', 'Immutable objects are usable as dict keys'],
        fieldNotes: ['Use tuples for fixed records (e.g. a pair of coordinates)', 'Named tuples add readable field names to plain tuples'],
      },
      {
        id: 'set-semantics',
        eli: 'eli15',
        name: 'Set semantics',
        brief: 'Build the set `s = {1, 2, 2, 3}`. Sets store only unique values, so the duplicate 2 disappears.',
        hint: 's = {1, 2, 2, 3}',
        start: '',
        par: 1,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.hasType('s', 'set'), preds.hasRepr('s', '{1, 2, 3}')],
        },
        solution: 's = {1, 2, 2, 3}',
        lesson: `A set literal looks like a dict but has no \`:\`. \`s = {1, 2, 2, 3}\` allocates a **set** heap object holding only the *unique* values: the repeated \`2\` collapses to one.

Sets are a great fit for “membership” questions — \`x in s\` — and for de-duplicating a list with \`set(my_list)\`.`,
        learning: ['Sets hold unique values only', 'A set is a heap object, like a list or dict'],
        fieldNotes: ['`set(a) | set(b)` unions two collections', 'Empty sets must be written `set()`, not `{}` (that is an empty dict)'],
      },
    ],
  },
];
