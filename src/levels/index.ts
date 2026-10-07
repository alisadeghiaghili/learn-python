/**
 * Level catalog: 24 levels across 6 series, each themed on the memory model.
 *
 * English is the base language (lives here). Phase D overlays FA/DE per-key.
 */

import { preds } from '../engine/checks';
import type { Level, Sequence } from '../engine/types';

export const sequences: Sequence[] = [
  /* —— S1 · Names & Bindings —— */
  {
    id: 'names',
    title: 'Names & Bindings',
    levels: [
      {
        id: 'first-name',
        name: 'First name',
        brief: 'Bind the name `x` to the integer 3. Names live in the stack frame; small integers live as values, not heap boxes.',
        hint: 'x = 3',
        start: '',
        par: 1,
        difficulty: 1,
        goal: { type: 'vars', vars: { x: { type: 'int', repr: '3' } } },
        solution: 'x = 3',
        lesson: `A *name* is a label that points at a value. Writing \`x = 3\` creates the name \`x\` in the current stack frame and makes it refer to the integer 3.

Small integers like 3 are stored **directly in the frame** — you will not see a box on the heap for them. The name is not a little box containing the number; it is a tag on the number itself.`,
        learning: ['A name lives in the stack frame, not on the heap', 'Small ints are values, stored directly in the frame'],
        fieldNotes: ['Name binding is O(1) — a single table lookup', 'Python names are case-sensitive: `X` and `x` are different'],
      },
      {
        id: 'rebind',
        name: 'Rebind',
        brief: 'Bind `x` to 1, then rebind `x` to 2. The name just points somewhere new — there is no “slot” that gets edited.',
        hint: 'Two assignments to the same name.',
        start: '',
        par: 2,
        difficulty: 1,
        goal: { type: 'vars', vars: { x: { type: 'int', repr: '2' } } },
        solution: 'x = 1\nx = 2',
        lesson: `Assigning to a name you already used does not *update* anything — it **rebinds** the name to a new value. After \`x = 2\`, the name \`x\` no longer refers to 1.

This is why “variables” is a slightly misleading word: the name is what changes, not a fixed slot.`,
        learning: ['Rebinding moves the name, it does not edit a slot', 'The old value is gone unless another name still points at it'],
        fieldNotes: ['Useful for counters and accumulators: `n = 0` then `n = n + 1`', 'Rebinding a name inside a function is local to that function (see S5)'],
      },
      {
        id: 'a-real-object',
        name: 'A real object',
        brief: 'Bind `xs` to the list `[1, 2, 3]`. Lists are heap objects — the name `xs` holds a *reference*, not the list itself.',
        hint: 'xs = [1, 2, 3]',
        start: '',
        par: 1,
        difficulty: 1,
        goal: {
          type: 'predicates',
          predicates: [preds.hasType('xs', 'list'), preds.hasRepr('xs', '[1, 2, 3]')],
        },
        solution: 'xs = [1, 2, 3]',
        lesson: `Now build something mutable. \`xs = [1, 2, 3]\` allocates a **list object on the heap** and makes the name \`xs\` a reference to it.

Watch the canvas: the frame shows \`xs\` with a small arrow to a teal box on the heap. The box holds the list; the name only points at it. That separation is the heart of the memory model.`,
        learning: ['Mutable containers are heap objects', 'A name holds a reference (an arrow), not the object'],
        fieldNotes: ['Heap objects have identity — `id()` reveals it', 'Two names can point at the same object (next series)'],
      },
      {
        id: 'values-vs-refs',
        name: 'Values vs references',
        brief: 'In one frame, hold both a value and a reference: `x` is the int 3, `xs` is a list. See the contrast on the canvas.',
        hint: 'x = 3 and xs = [1, 2]',
        start: '',
        par: 2,
        difficulty: 2,
        goal: {
          type: 'vars',
          vars: { x: { type: 'int', repr: '3' }, xs: { type: 'list', repr: '[1, 2]' } },
        },
        solution: 'x = 3\nxs = [1, 2]',
        lesson: `Put both kinds of binding in one frame. \`x = 3\` is a **value** (no heap box); \`xs = [1, 2]\` is a **reference** (arrow to a heap list).

The visualizer keeps this distinction visible: \`x\` sits alone in the frame, while \`xs\` carries an amber edge to a box. When you copy a value you copy the number; when you copy a reference you copy the arrow.`,
        learning: ['Values are stored in the frame; references point at the heap', 'Copying a value vs copying a reference are different operations'],
        fieldNotes: ['NumPy/`dataclasses` lean on this value-vs-reference split', 'Strings in CPython are immutable value-like objects'],
      },
      {
        id: 'shared-value',
        name: 'Two names, one value',
        brief: 'Bind `a = 3`, then `b = a`. Unlike a list, `b` gets its own copy of the value 3 — there is no shared box.',
        hint: 'a = 3 then b = a',
        start: '',
        par: 2,
        difficulty: 2,
        goal: {
          type: 'vars',
          vars: { a: { type: 'int', repr: '3' }, b: { type: 'int', repr: '3' } },
        },
        solution: 'a = 3\nb = a',
        lesson: `For a small int, \`b = a\` copies the **value**, not a reference. Both names point at the number 3, but there is no heap object connecting them.

Compare this with a list (next series): for a list, \`b = a\` shares one object. Whether an assignment shares or copies depends entirely on whether the value is a heap object.`,
        learning: ['Assigning a value copies the value', 'Assigning a reference copies the arrow'],
        fieldNotes: ['This is why you can “rebind” an int freely without side effects', 'Immutable values make for safe defaults in function signatures'],
      },
    ],
  },

  /* —— S2 · Aliasing & Copy —— */
  {
    id: 'aliasing',
    title: 'Aliasing & Copy',
    levels: [
      {
        id: 'two-names-one-list',
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

  /* —— S3 · Containers in Memory —— */
  {
    id: 'containers',
    title: 'Containers in Memory',
    levels: [
      {
        id: 'list-update-in-place',
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

  /* —— S3b · Copy Semantics (shallow vs deep) —— */
  {
    id: 'copy-semantics',
    title: 'Copy Semantics',
    levels: [
      {
        id: 'shallow-copy-dict',
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

  /* —— Iterators & Iterables —— */
  {
    id: 'iterators',
    title: 'Iterators & Iterables',
    levels: [
      {
        id: 'iter-basic',
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

  /* —— S4 · Mutation & Methods —— */
  {
    id: 'mutation',
    title: 'Mutation & Methods',
    levels: [
      {
        id: 'grow-with-append',
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

  /* —— S5 · Functions & Frames —— */
  {
    id: 'functions',
    title: 'Functions & Frames',
    levels: [
      {
        id: 'define-function',
        name: 'Define a function',
        brief: 'Define `double(n)` that returns `n * 2`. Do not call it — just define it so a function object sits on the heap.',
        hint: 'def double(n):\n    return n * 2',
        start: '',
        par: 2,
        difficulty: 2,
        goal: { type: 'predicates', predicates: [preds.hasFunction('double')] },
        solution: 'def double(n):\n    return n * 2',
        lesson: `\`def\` creates a **function object** on the heap and binds its name in the current frame. Until you call it, the body never runs.

The name \`double\` is just another name — one that happens to point at a callable object. Defining and calling are two separate steps.`,
        learning: ['`def` builds a function object and binds its name', 'A function does not run until it is called'],
        fieldNotes: ['Functions are first-class values: you can pass them around', 'The body runs fresh on every call'],
      },
      {
        id: 'call-and-bind',
        name: 'Call and bind',
        brief: 'Define `double(n)` returning `n * 2`, then bind `r = double(21)` so `r` is 42. Watch the call frame appear and disappear.',
        hint: 'r = double(21)',
        start: '',
        par: 3,
        difficulty: 2,
        goal: { type: 'vars', vars: { r: { type: 'int', repr: '42' } } },
        solution: 'def double(n):\n    return n * 2\nr = double(21)',
        lesson: `Calling \`double(21)\` pushes a **new frame** onto the stack with its own local \`n = 21\`, runs the body, and returns \`42\` back to the module frame where \`r\` captures it.

When the call returns, the temporary frame is popped — only its return value survives, now bound to \`r\`. That push/pop of frames is how Python keeps local variables isolated.`,
        learning: ['A call creates a temporary frame that is popped on return', 'Local variables exist only while the call is running'],
        fieldNotes: ['Deep call stacks are how recursion works', 'Each frame has its own `locals()` namespace'],
      },
      {
        id: 'print-is-not-magic',
        name: 'Print is not magic',
        brief: 'Print the line `hello 3` using `print`. Printing writes to stdout — it does not bind any name.',
        hint: "print('hello', 3)",
        start: '',
        par: 1,
        difficulty: 1,
        goal: { type: 'stdout', lines: ['hello 3'] },
        solution: "print('hello', 3)",
        lesson: `\`print\` is a function, not a keyword. It takes values, writes them to **stdout**, and returns \`None\`. It binds no name, so nothing new appears in your frame.

In the visualizer, printing shows up in the terminal and in \`state.stdout\` — not as a new object on the canvas.`,
        learning: ['`print` writes to stdout and binds nothing', 'A function call can produce output without producing a value'],
        fieldNotes: ['`print` is how you observe state while debugging', 'Redirecting stdout is how logging and capture work'],
      },
      {
        id: 'rebind-in-fn-is-local',
        name: 'Rebind inside a function',
        brief: 'This is the subtle one. After `x = 1`, a function that does `x = 2` should NOT change the module-level `x` — it stays 1.',
        hint: 'The inner x = 2 is a local rebind.',
        start: '',
        par: 4,
        difficulty: 4,
        goal: { type: 'vars', vars: { x: { type: 'int', repr: '1' } } },
        solution: 'x = 1\ndef bump():\n    x = 2\nbump()',
        lesson: `Inside \`bump\`, the statement \`x = 2\` **rebinds a local** \`x\` in the function’s own frame. It does not touch the module-level \`x\`, which stays \`1\`.

Because there is no assignment to \`x\` that Python can see as a reference (it sees an assignment), the inner \`x\` is treated as a fresh local. This is the most common “my function didn’t change my global” surprise — and the reason \`global\`/\`nonlocal\` exist.`,
        learning: ['An assignment to a name inside a function creates a local', 'Rebinding a local does not affect the outer scope'],
        fieldNotes: ['Use `global x` (or `nonlocal`) to deliberately rebind an outer name', 'Mutating a shared mutable object *does* escape the function — rebinding does not'],
      },
    ],
  },

  /* —— S6 · Plotting & Capstone —— */
  {
    id: 'plotting',
    title: 'Plotting & Capstone',
    levels: [
      {
        id: 'plot-scatter',
        name: 'First plot',
        brief: 'Create two lists `x` and `y`, then `scatter(x, y)` to draw a scatter plot on the Plot tab.',
        hint: 'x = [1, 2, 3], y = [1, 4, 9], then scatter(x, y)',
        start: '',
        par: 3,
        difficulty: 3,
        goal: { type: 'plot', kind: 'scatter' },
        solution: 'x = [1, 2, 3]\ny = [1, 4, 9]\nscatter(x, y)',
        lesson: `Now connect the memory model to a chart. \`scatter(x, y)\` pairs up the two lists point-by-point and pushes a **plot spec** onto \`state.plots\`.

Watch the board: a small dot appears on the Plot tab badge, and clicking it shows the drawn points. The plot is just data — a list of \`(x, y)\` pairs — rendered as SVG.`,
        learning: ['`scatter(xs, ys)` pairs two lists into (x, y) points', 'Plots live in `state.plots` and render on the Plot tab'],
        fieldNotes: ['Real work uses matplotlib; this is a tiny stand-in', 'Keep the data (lists) and the chart separate, as here'],
      },
      {
        id: 'plot-trend',
        name: 'Plot a computed trend',
        brief: 'Define `sq(n)`, build a list of squared values, then `line(xs, ys)` to draw a connected trend.',
        hint: 'line() connects points in order.',
        start: '',
        par: 5,
        difficulty: 4,
        goal: { type: 'plot', kind: 'line' },
        solution: 'def sq(n):\n    return n * n\nxs = [1, 2, 3]\nys = [sq(1), sq(2), sq(3)]\nline(xs, ys)',
        lesson: `Here the series is **computed**, not typed. \`sq\` produces each \`y\`, the \`ys\` list is built from those results, and \`line(xs, ys)\` connects the points in order.

This is the shape of real plotting: transform some data, gather it into aligned series, then draw. The function call frames you saw in S5 are doing work that feeds the chart.`,
        learning: ['Compute a series first, then plot the aligned lists', '`line()` joins points in order to show a trend'],
        fieldNotes: ['NumPy vectorizes this: `ys = sq(xs)` in one step', 'Always keep `xs` and `ys` the same length before plotting'],
      },
      {
        id: 'capstone-shared-mutation',
        name: 'Capstone: alias + mutate + plot',
        brief: 'The finale. `data` and `mirror` share one list; a function grows it in place; then `scatter` the result. All three ideas at once.',
        hint: 'mirror = data, a function appends, then scatter.',
        start: '',
        par: 6,
        difficulty: 5,
        goal: {
          type: 'predicates',
          predicates: [
            preds.aliased('data', 'mirror'),
            preds.hasRepr('data', '[1, 2, 3, 4]'),
            preds.hasPlot('scatter'),
          ],
        },
        solution: 'data = [1, 2, 3]\nmirror = data\ndef bump(d):\n    d.append(4)\nbump(mirror)\nscatter(data, data)',
        lesson: `This level strings together everything you have learned. \`data\` and \`mirror\` **alias** one list. \`bump\` **mutates** it in place through \`mirror\`, so \`data\` sees the growth too — then we **plot** the result.

Three core ideas in six statements: aliasing (S2), in-place mutation that escapes a function (S4/S5), and turning data into a chart (S6). If you can see all three on the canvas at once, you understand the model.`,
        learning: ['Aliasing + in-place mutation + plotting compose', 'A function can mutate a shared object even when called through an alias'],
        fieldNotes: ['This exact pattern underlies reactive/observable data', 'Mutate-and-publish is how charts stay in sync with state'],
      },
    ],
  },
];

/**
 * Flatten all levels in order.
 */
export function allLevels(): Level[] {
  return sequences.flatMap((s) => s.levels);
}

/**
 * Look up a level by id.
 */
export function getLevel(id: string): Level | null {
  return allLevels().find((l) => l.id === id) || null;
}

/**
 * Index of a level in the flat list, or -1.
 */
export function levelIndex(id: string): number {
  return allLevels().findIndex((l) => l.id === id);
}

/**
 * The level that follows `id` in flat order, or null at the end.
 */
export function getNextLevel(id: string): Level | null {
  return allLevels()[levelIndex(id) + 1] || null;
}
