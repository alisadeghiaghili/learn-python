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
        brief: 'Bind the name `x` to the integer 3. A name is a label that points at an object; the canvas draws small ints right next to the name to keep the picture simple.',
        hint: 'x = 3',
        start: '',
        par: 1,
        difficulty: 1,
        goal: { type: 'vars', vars: { x: { type: 'int', repr: '3' } } },
        solution: 'x = 3',
        lesson: `A *name* is a label that points at an object. Writing \`x = 3\` creates the name \`x\` in the current stack frame and makes it refer to the integer 3.

In real Python the 3 is an object too (try \`id(x)\`). This canvas draws small immutable values, such as ints, **directly in the frame** instead of as heap boxes. That is a display simplification, not a claim that ints are not objects. The name is not a little box containing the number; it is a tag on the number itself.`,
        learning: ['A name lives in the stack frame, not on the heap', 'Every name points at an object; the canvas draws small ints inline to keep the picture readable'],
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
        name: 'Immutable vs mutable',
        brief: 'In one frame, hold both an immutable int and a mutable list: `x` is 3, `xs` is `[1, 2]`. Compare how the canvas draws them.',
        hint: 'x = 3 and xs = [1, 2]',
        start: '',
        par: 2,
        difficulty: 2,
        goal: {
          type: 'vars',
          vars: { x: { type: 'int', repr: '3' }, xs: { type: 'list', repr: '[1, 2]' } },
        },
        solution: 'x = 3\nxs = [1, 2]',
        lesson: `Put both kinds of object in one frame. Both names are references: \`x\` points at the int 3, \`xs\` points at a list.

The difference that matters is **mutability**. An int can never change in place, so the canvas draws it inline next to its name and nothing is lost. A list can change in place, so it gets its own heap box: that is how you will see several names sharing one list. When you copy a name you always copy the arrow. With an immutable object that is harmless; with a mutable one it is the source of aliasing bugs.`,
        learning: ['Every name holds a reference; what differs is whether the object can change in place', 'The canvas draws immutable ints inline and mutable lists as heap boxes'],
        fieldNotes: ['Mutable vs immutable is the split that decides whether sharing an object is risky', 'Strings are immutable objects, like ints'],
      },
      {
        id: 'shared-value',
        eli: 'eli10',
        name: 'Two names, one value',
        brief: 'Bind `a = 3`, then `b = a`. Both names now point at the same int object. Because an int can never change in place, sharing it is harmless.',
        hint: 'a = 3 then b = a',
        start: '',
        par: 2,
        difficulty: 2,
        goal: {
          type: 'vars',
          vars: { a: { type: 'int', repr: '3' }, b: { type: 'int', repr: '3' } },
        },
        solution: 'a = 3\nb = a',
        lesson: `\`b = a\` never copies anything: it makes \`b\` point at the same object as \`a\`. Here that object is the int 3, so both names refer to it (the \`identity-is\` level shows how to check this with \`is\`).

This is the same rule as for a list in the next series. The difference is that an int cannot be changed in place, so sharing it can never surprise you. The canvas shows no shared box only because it draws small ints inline.`,
        learning: ['`b = a` always shares the object; it never copies', 'Sharing an immutable object is harmless: it cannot change underneath you'],
        fieldNotes: ['This is why you can “rebind” an int freely without side effects', 'Immutable values make for safe defaults in function signatures'],
      },
    ],
  },
];
