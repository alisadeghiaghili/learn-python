/**
 * Series: Copy Semantics (shallow vs deep).
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'copy-semantics',
    title: 'Copy Semantics',
    levels: [
      {
        id: 'shallow-copy-dict',
        eli: 'eli10',
        name: 'Shallow copy',
        brief: 'Shallow-copy a dict that holds a nested list. `b` becomes a *new* dict, but it still points at the **same** inner list as `a`. See two amber edges reach one list box.',
        hint: 'b = a.copy()  (or: import copy as cp, then b = cp.copy(a))',
        start: "a = {'k': [1, 2]}",
        par: 1,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.notAliased('a', 'b'), preds.sharesChild('a', 'b')],
        },
        solution: 'b = a.copy()',
        lesson: `A *shallow* copy makes a **new outer container** but reuses the containers *inside* it. \`a.copy()\` builds a fresh dict \`b\`, yet both \`a['k']\` and \`b['k']\` point at the **very same** inner list.

Watch the canvas: two dicts, one shared list box in the middle with two amber edges into it. That shared child is the whole idea of "shallow" — the surface is copied, the interior is shared.`,
        learning: ['A shallow copy is a new outer container', 'Nested containers are shared, not copied'],
        fieldNotes: ['`.copy()` and `copy.copy()` are both shallow', 'This is why mutating a nested element "leaks" across a shallow copy'],
      },
      {
        id: 'deep-copy-independence',
        eli: 'eli15',
        name: 'Deep copy',
        brief: 'Deep-copy `a` so that `b` is **fully independent** — even the inner list is a separate object. No box is shared between them.',
        hint: 'import copy as cp, then b = cp.deepcopy(a)',
        start: "a = {'k': [1, 2]}",
        par: 2,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.notAliased('a', 'b'), preds.independent('a', 'b')],
        },
        solution: 'import copy as cp\nb = cp.deepcopy(a)',
        lesson: `A *deep* copy rebuilds **every** level. \`cp.deepcopy(a)\` makes a new dict *and* a new inner list, so nothing on \`b\`'s side is the same object as anything on \`a\`'s side.

Contrast with the last level: there the inner list was shared (shallow); here it is independent (deep). \`import copy as cp\` binds the simulated \`copy\` module; \`cp.deepcopy\` then allocates fresh boxes all the way down.`,
        learning: ['A deep copy clones nested containers recursively', 'Nothing is shared after a deep copy'],
        fieldNotes: ['`copy.deepcopy` is what you reach for before mutating a structure you do not own', 'Shallow is faster but shares interior objects — deep is slower but safe'],
      },
      {
        id: 'shared-child-mutation',
        eli: 'eli15',
        name: 'The shared child mutates both',
        brief: 'Shallow-copy `a`, then append to the shared inner list through `a`. Because `b` shares that list, `b` changes too — without touching it.',
        hint: 'a[1].append(3) edits the shared inner list.',
        start: 'a = [1, [2]]\nb = a.copy()',
        par: 1,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [
            preds.notAliased('a', 'b'),
            preds.sharesChild('a', 'b'),
            preds.hasRepr('a', '[1, [2, 3]]'),
            preds.hasRepr('b', '[1, [2, 3]]'),
          ],
        },
        solution: 'a[1].append(3)',
        lesson: `Here is the "aha." \`a\` and \`b\` are different lists, but their inner list is the **same object**. Calling \`a[1].append(3)\` mutates that shared inner list — so reading \`b\` shows the change too, even though you only touched \`a\`.

This is the single most common copy bug in Python. The canvas makes it unavoidable to see: one inner box, two edges, one mutation, two observers. A *deep* copy would have broken the shared edge and prevented this.`,
        learning: ['Mutating a shared nested object is visible through every alias', 'Shallow copy + nested mutation is the classic foot-gun'],
        fieldNotes: ['Reach for a deep copy (or defensive copies) before mutating data you share', 'Detect the share with `id(a[1]) == id(b[1])`'],
      },
    ],
  },
];
