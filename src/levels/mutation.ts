/**
 * Series: Mutation & Methods.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'mutation',
    title: 'Mutation & Methods',
    levels: [
      {
        id: 'grow-with-append',
        eli: 'eli10',
        name: 'Grow with append',
        brief: 'Bind `a = [1]`, then grow it with `a.append(2)` so it becomes `[1, 2]`. The object is the same, just longer.',
        hint: 'a.append(2)',
        start: '',
        par: 2,
        difficulty: 2,
        goal: { type: 'predicates', predicates: [preds.hasRepr('a', '[1, 2]')] },
        solution: 'a = [1]\na.append(2)',
        lesson: `Methods like \`append\` mutate the object in place and return \`None\`. The name \`a\` still points at the same list — it has just grown.

This is different from \`a = a + [2]\`, which would build a *new* list and rebind \`a\`. Append edits; concatenation rebinds.`,
        learning: ['`.append()` mutates in place and returns None', 'In-place methods keep the object’s identity'],
        fieldNotes: ['Prefer `append` in a loop over `a = a + [x]` (O(1) vs O(n))', '`.extend()` appends many items at once'],
      },
      {
        id: 'pop-returns',
        eli: 'eli15',
        name: 'Pop returns',
        brief: 'Bind `a = [1, 2]`, then `last = a.pop()`. `pop` removes the last item *and* hands it back — `last` should be 2.',
        hint: 'last = a.pop()',
        start: '',
        par: 2,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.hasRepr('a', '[1]'), preds.hasType('last', 'int'), preds.hasRepr('last', '2')],
        },
        solution: 'a = [1, 2]\nlast = a.pop()',
        lesson: `Unlike \`append\`, \`pop\` has a **return value**: the item it removed. After \`last = a.pop()\`, the list shrinks to \`[1]\` and \`last\` holds the removed \`2\`.

“Mutate and return” is a common pattern — the same list is edited while a useful value is produced at the same time.`,
        learning: ['`.pop()` both mutates the list and returns the removed item', 'The return value can be bound to a new name'],
        fieldNotes: ['`pop` is how you implement a stack: `push = append`, `pop = pop`', 'Popping from the end is O(1); from the front is O(n)'],
      },
      {
        id: 'dict-get-safe',
        eli: 'eli15',
        name: 'Safe dict get',
        brief: 'With `d = {"a": 1}`, read a missing key safely: `v = d.get("b", 0)`. `get` returns the default instead of raising.',
        hint: "v = d.get('b', 0)",
        start: '',
        par: 2,
        difficulty: 3,
        goal: { type: 'vars', vars: { v: { type: 'int', repr: '0' } } },
        solution: "d = {'a': 1}\nv = d.get('b', 0)",
        lesson: `\`d["b"]\` would raise \`KeyError\` for a missing key. \`d.get("b", 0)\` instead returns the **default** \`0\` when the key is absent.

This makes \`get\` the idiomatic way to read optional entries without wrapping every access in \`try\`/\`except\`.`,
        learning: ['`.get(key, default)` returns a default instead of raising', 'Reading an optional key is a common real-world pattern'],
        fieldNotes: ['`dict.setdefault` inserts the default on a miss — a useful side effect', 'Avoid `try/except KeyError` when `get` expresses the intent'],
      },
      {
        id: 'dict-update-merge',
        eli: 'eli15',
        name: 'Dict update / merge',
        brief: 'With `d = {"a": 1}`, merge in more pairs using `d.update({"b": 2})` so `d` becomes `{"a": 1, "b": 2}`.',
        hint: "d.update({'b': 2})",
        start: '',
        par: 2,
        difficulty: 3,
        goal: { type: 'predicates', predicates: [preds.hasRepr('d', "{'a': 1, 'b': 2}")] },
        solution: "d = {'a': 1}\nd.update({'b': 2})",
        lesson: `\`update\` merges another mapping into \`d\` **in place**: matching keys are overwritten, new keys are added. The name \`d\` still points at the same dict.

This is the basis of configuration layering — start with defaults, then \`update\` with user overrides.`,
        learning: ['`.update()` merges another dict in place', 'Existing keys are overwritten; new keys are added'],
        fieldNotes: ['`defaults.update(user_config)` is a standard config pattern', 'The `|` merge operator builds a *new* dict instead of mutating'],
      },
    ],
  },
];
