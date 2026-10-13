/**
 * Series: Names & Bindings.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'names',
    title: 'Names & Bindings',
    levels: [
      {
        id: 'first-name',
        eli: 'eli5',
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
        eli: 'eli5',
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
        eli: 'eli5',
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
        eli: 'eli10',
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
        eli: 'eli10',
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
];
