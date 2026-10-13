/**
 * Series: Aliasing & Copy.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'aliasing',
    title: 'Aliasing & Copy',
    levels: [
      {
        id: 'two-names-one-list',
        eli: 'eli10',
        name: 'Two names, one list',
        brief: 'Create `a = [1]` and `b = a` so both names reference the same list. Then append 2 through `a`. `b` must see it.',
        hint: 'b = a copies the reference, not the list.',
        start: '',
        par: 3,
        difficulty: 2,
        goal: { type: 'predicates', predicates: [preds.sharedMutation('a', 'b', '[1, 2]')] },
        solution: 'a = [1]\nb = a\na.append(2)',
        lesson: `This is the classic Python gotcha. \`b = a\` does **not** copy the list — it binds \`b\` to the *same* object \`a\` points at. Two amber edges now reach one teal box.

When you call \`a.append(2)\`, you mutate the shared object, so \`b\` sees \`[1, 2]\` too. Aliasing is the single most common source of surprising mutations.`,
        learning: ['`b = a` shares the object; it does not copy it', 'Mutating through one alias is visible through all of them'],
        fieldNotes: ['This is why default `list` arguments are a foot-gun', 'Detect aliasing in production with `id(a) == id(b)`'],
      },
      {
        id: 'copy-dont-alias',
        eli: 'eli10',
        name: 'Copy, do not alias',
        brief: 'Create `a = [1]`. Bind `b` to a *new* list with the same contents using `.copy()`. `a` and `b` must be different objects.',
        hint: 'b = a.copy()',
        start: '',
        par: 2,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.notAliased('a', 'b'), preds.hasRepr('a', '[1]'), preds.hasRepr('b', '[1]')],
        },
        solution: 'a = [1]\nb = a.copy()',
        lesson: `Sometimes you want the same *contents* but a separate object. \`b = a.copy()\` allocates a **new** list with the same elements.

Now \`a\` and \`b\` point at two different heap boxes. Mutating one no longer affects the other. \`.copy()\` is a shallow copy — nested objects inside are still shared (a subtlety you will feel later).`,
        learning: ['`.copy()` makes a shallow, independent container', 'Shallow copy copies references to nested objects, not the nested objects'],
        fieldNotes: ['`copy.deepcopy` exists for fully independent nested structures', 'Reach for `.copy()` before mutating a list you do not own'],
      },
      {
        id: 'rebind-vs-mutate',
        eli: 'eli15',
        name: 'Rebind vs mutate',
        brief: 'Start with `a = [1]` and `b = a`. Rebind `a` to a new list `[9]`. `b` must still be the old list `[1]`.',
        hint: 'a = [9] rebinds the name; it does not edit the shared object.',
        start: '',
        par: 3,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.notAliased('a', 'b'), preds.hasRepr('a', '[9]'), preds.hasRepr('b', '[1]')],
        },
        solution: 'a = [1]\nb = a\na = [9]',
        lesson: `There are two very different things you can do: **mutate** the object, or **rebind** the name.

Here \`a = [9]\` rebinds \`a\` to a *new* list. The old \`[1]\` is untouched, and \`b\` — which still references it — keeps pointing at \`[1]\`. The two names have split apart. Mutation edits in place; rebinding just moves a label.`,
        learning: ['Rebinding one name does not affect other names on the same object', 'Mutating affects all aliases; rebinding does not'],
        fieldNotes: ['Confusing these two is the source of many “why did my list change?” bugs', 'Linters and type-checkers do not stop you — the model does'],
      },
      {
        id: 'identity-is',
        eli: 'eli15',
        name: 'Identity: `is`',
        brief: 'Bind `a = [1]` and `b = a`, then compute `ok = a is b`. `is` tests whether two names are the same object.',
        hint: 'ok = a is b',
        start: '',
        par: 3,
        difficulty: 3,
        goal: { type: 'vars', vars: { ok: { type: 'bool', repr: 'True' } } },
        solution: 'a = [1]\nb = a\nok = a is b',
        lesson: `The \`is\` operator asks a sharper question than \`==\`: are these the **same object**, or just equal? Since \`b = a\`, both names hold the same heap id, so \`a is b\` is \`True\`.

Use \`==\` to compare *values* and \`is\` to compare *identity*. For container objects they genuinely diverge: two lists can be \`==\` but not \`is\`.`,
        learning: ['`is` compares object identity, `==` compares value', 'Two aliased names are `is` the same object'],
        fieldNotes: ['`is None` is idiomatic because `None` is a singleton', 'Never use `is` for numeric equality — that is `==`'],
      },
    ],
  },
];
