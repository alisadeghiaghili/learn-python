/**
 * Series: Iterators & Iterables.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'iterators',
    title: 'Iterators & Iterables',
    levels: [
      {
        id: 'iter-basic',
        eli: 'eli10',
        name: 'Make an iterator',
        brief: 'Create `it` as an iterator over the list `xs` using `iter`. `it` is a *new object* that remembers its place in `xs`.',
        hint: 'it = iter(xs)',
        start: 'xs = [1, 2, 3]',
        par: 1,
        difficulty: 2,
        goal: { type: 'predicates', predicates: [preds.iteratesOver('it', 'xs')] },
        solution: 'it = iter(xs)',
        lesson: `An **iterable** (like a list) can hand you an **iterator**. \`it = iter(xs)\` allocates a *new* object on the heap that holds a reference to \`xs\` **plus a cursor** starting at 0.

Watch the canvas: a new \`list_iterator\` box appears, with an edge back to the list \`xs\`. The iterator is a separate object that *walks* the list one element at a time. The list itself is untouched — the position lives on the iterator, not the list.`,
        learning: ['An iterable produces an iterator', 'The iterator is a separate object holding a cursor'],
        fieldNotes: ['`iter()` is what the `for` loop calls for you', 'One iterable can hand out many independent iterators'],
      },
      {
        id: 'iter-next',
        eli: 'eli10',
        name: 'Advance with next()',
        brief: 'Call `next(it)` to pull the first element off the iterator and move its cursor forward.',
        hint: 'first = next(it)',
        start: 'xs = [1, 2, 3]\nit = iter(xs)',
        par: 1,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.hasRepr('first', '1'), preds.iteratorIndex('it', 1)],
        },
        solution: 'first = next(it)',
        lesson: `\`next(it)\` returns the element at the cursor and then **moves the cursor forward**. After one call, \`first\` holds \`1\` and the iterator is now at index 1.

The cursor is real state stored on the iterator object — you can watch it advance on the canvas. This is exactly what a \`for x in xs\` loop does, hidden inside the loop: it calls \`next()\` until the iterator runs out. Here we do it one visible step at a time.`,
        learning: ['`next(it)` returns the current element and advances the cursor', 'The cursor is state stored on the iterator object'],
        fieldNotes: ['`for` is syntactic sugar over repeated `next()`', 'In real code you rarely call `next()` by hand'],
      },
      {
        id: 'iter-independence',
        eli: 'eli15',
        name: 'Two iterators, one list',
        brief: 'Make **two** iterators over the same list. Advancing one must not move the other — each has its own cursor.',
        hint: 'it = iter(xs) and jt = iter(xs), then next(jt)',
        start: 'xs = [1, 2, 3]',
        par: 3,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [
            preds.notAliased('it', 'jt'),
            preds.iteratesOver('it', 'xs'),
            preds.iteratesOver('jt', 'xs'),
            preds.iteratorIndex('it', 0),
            preds.iteratorIndex('jt', 1),
          ],
        },
        solution: 'it = iter(xs)\njt = iter(xs)\nnext(jt)',
        lesson: `Calling \`iter(xs)\` twice gives **two separate iterator objects**, each pointing at the *same* list but with its *own* cursor. Advancing \`jt\` leaves \`it\` at 0.

The canvas shows two iterator boxes both edged at one list, but their cursors are independent. This is the aliasing idea from earlier, applied to iterators: shared source, independent state.`,
        learning: ['Two iterators over one list are independent', 'Each iterator owns its own cursor'],
        fieldNotes: ['You can walk the same collection from two places at once', 'Mutating the source list mid-iteration is undefined — avoid it'],
      },
      {
        id: 'iter-exhaust',
        eli: 'eli15',
        name: 'Exhaust the iterator',
        brief: 'Call `next(it)` until the iterator has walked every element — it ends up **exhausted** (cursor at the end).',
        hint: 'next(it) three times over [1, 2, 3]',
        start: 'xs = [1, 2, 3]\nit = iter(xs)',
        par: 3,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.iteratesOver('it', 'xs'), preds.exhausted('it')],
        },
        solution: 'next(it)\nnext(it)\nnext(it)',
        lesson: `Keep calling \`next(it)\` and the cursor climbs 1, 2, 3. After the last element, the iterator is **exhausted** — its cursor sits at the end of the list.

In real Python, calling \`next()\` on an exhausted iterator raises \`StopIteration\`; that is precisely the signal a \`for\` loop watches for to know it is done. Here the goal is simply to reach the end: the iterator has consumed the whole list without the list ever changing.`,
        learning: ['An iterator is exhausted when its cursor reaches the end', 'Exhaustion is how iteration knows to stop'],
        fieldNotes: ['`StopIteration` ends a `for` loop', 'An exhausted iterator is reusable by calling `iter()` again on the source'],
      },
    ],
  },
];
