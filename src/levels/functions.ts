/**
 * Series: Functions & Frames.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'functions',
    title: 'Functions & Frames',
    levels: [
      {
        id: 'define-function',
        eli: 'eli10',
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
        eli: 'eli10',
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
        eli: 'eli5',
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
        eli: 'eli20',
        name: 'Rebind inside a function',
        brief: 'Call `bump()` and store the result in `y`. Watch the call frame: `y` receives 2, but the outer `x` stays 1 because assigning inside a function creates a local name.',
        hint: 'Call bump() and assign its return to y: y = bump()',
        start: 'x = 1\ndef bump():\n    x = 2\n    return x',
        par: 1,
        difficulty: 4,
        goal: { type: 'vars', vars: { x: { type: 'int', repr: '1' }, y: { type: 'int', repr: '2' } } },
        solution: 'y = bump()',
        lesson: `Inside \`bump\`, the statement \`x = 2\` **rebinds a local** \`x\` in the function’s own call frame. It does not touch the module-level \`x\`, which stays \`1\`.

Because Python detects assignments at compile time, any name assigned anywhere in the body becomes local to that function. If you try to read \`x\` before assigning it (for example \`x = x + 1\`), Python does not fall back to the global — it raises \`UnboundLocalError: cannot access local variable 'x' where it is not associated with a value\`. To deliberately modify the outer variable, Python requires \`global x\`.`,
        learning: ['An assignment to a name inside a function creates a local variable for the entire body', 'Rebinding a local does not affect the outer scope; reading an unassigned local raises UnboundLocalError'],
        fieldNotes: ['Use `global x` (or `nonlocal`) to deliberately rebind an outer name', 'Mutating a shared mutable object escapes the function, but rebinding a name never does'],
      },
    ],
  },
];
