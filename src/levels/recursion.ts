/**
 * Series: Recursion & The Call Stack.
 *
 * Explores LIFO call stack frames, base cases, returning through frames,
 * heap objects surviving popped frames, and RecursionError limits.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'recursion',
    title: 'Recursion & The Call Stack',
    levels: [
      {
        id: 'recursion-base-case',
        eli: 'eli5',
        name: 'The base case',
        brief: 'Call `countdown(1)` and observe the return value `res`. Notice the base case stops recursion.',
        hint: 'res = countdown(1)',
        start: 'def countdown(n):\n    if n <= 0:\n        return "blastoff"\n    return countdown(n - 1)',
        par: 1,
        difficulty: 1,
        goal: { type: 'vars', vars: { res: { type: 'str', repr: "'blastoff'" } } },
        solution: 'res = countdown(1)',
        lesson: `Recursion is when a function calls itself. Every recursive function **must have a base case** — a condition that returns without making another call.

**Look at the Stack:**
Each call creates an isolated call frame on the stack. When \`n <= 0\` is met, the base case returns \`"blastoff"\` without spawning any further frames.`,
        learning: [
          'A recursive function calls itself to solve smaller sub-problems',
          'The base case terminates recursion and prevents infinite loops',
        ],
        fieldNotes: [
          'Without a base case, recursion exhausts stack space',
          'In production, recursion is common for tree and graph traversal',
        ],
      },
      {
        id: 'recursion-countdown',
        eli: 'eli10',
        name: 'Stack frame accumulation',
        brief: 'Define a function `sum_to(n)` that returns `0` if `n <= 0` else `n + sum_to(n - 1)`. Calculate `total = sum_to(3)`.',
        hint: 'def sum_to(n):\n    if n <= 0:\n        return 0\n    return n + sum_to(n - 1)\ntotal = sum_to(3)',
        start: '',
        par: 5,
        difficulty: 2,
        goal: { type: 'vars', vars: { total: { type: 'int', repr: '6' } } },
        solution: 'def sum_to(n):\n    if n <= 0:\n        return 0\n    return n + sum_to(n - 1)\ntotal = sum_to(3)',
        lesson: `Calling \`sum_to(3)\` pushes frames for \`sum_to(3)\`, \`sum_to(2)\`, \`sum_to(1)\`, and \`sum_to(0)\` onto the stack in LIFO (Last-In, First-Out) order.

**Look at the Memory Board:**
Notice how stack frames stack up vertically. Each frame has its own private variable \`n\`. Only when the top frame returns does the stack begin to unwind.`,
        learning: [
          'Call stack frames operate as a LIFO structure',
          'Each active frame retains its own local variables until it returns',
        ],
        fieldNotes: [
          'Call stack frames consume memory proportional to recursion depth',
          'Unwinding passes return values down the chain of waiting callers',
        ],
      },
      {
        id: 'recursion-call-stack',
        eli: 'eli15',
        name: 'Factorial and frame return',
        brief: 'Calculate `f = fact(4)` using the recursive function `fact`.',
        hint: 'f = fact(4)',
        start: 'def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)',
        par: 1,
        difficulty: 3,
        goal: { type: 'vars', vars: { f: { type: 'int', repr: '24' } } },
        solution: 'f = fact(4)',
        lesson: `Factorial (\`n!\`) demonstrates call stack unwinding:
- \`fact(4)\` waits for \`4 * fact(3)\`
- \`fact(3)\` waits for \`3 * fact(2)\`
- \`fact(2)\` waits for \`2 * fact(1)\`
- \`fact(1)\` hits the base case and returns \`1\`

As each frame returns, its memory frame is popped, and its computed value is multiplied and returned to the caller below it.`,
        learning: [
          'Return expressions in recursive calls evaluate after sub-calls return',
          'Frame memory is reclaimed as soon as a frame completes',
        ],
        fieldNotes: [
          'Call stack frames live in call stack memory, separate from the heap',
          'Complex data returned from functions lives on the heap and survives frame pops',
        ],
      },
      {
        id: 'recursion-accumulator',
        eli: 'eli20',
        name: 'Accumulator pattern',
        brief: 'Call `acc_sum(3, 0)` and bind to `result`. Notice how the accumulator carries state forward across frames.',
        hint: 'result = acc_sum(3, 0)',
        start: 'def acc_sum(n, acc):\n    if n <= 0:\n        return acc\n    return acc_sum(n - 1, acc + n)',
        par: 1,
        difficulty: 4,
        goal: { type: 'vars', vars: { result: { type: 'int', repr: '6' } } },
        solution: 'result = acc_sum(3, 0)',
        lesson: `In the **accumulator pattern**, intermediate results are computed and passed forward as function parameters rather than combined during the unwinding phase.

**Look at the Memory Board:**
Notice that each call frame receives the updated \`acc\` directly in its arguments.`,
        learning: [
          'Accumulator patterns pass running state forward through function arguments',
          'In tail-call optimizing runtimes, this allows running in constant stack space',
        ],
        fieldNotes: [
          'CPython does NOT perform tail-call optimization (TCO)',
          'All recursive calls consume a stack frame in standard Python',
        ],
      },
      {
        id: 'recursion-depth-limit',
        eli: 'eliphd',
        name: 'Recursion limits and safety',
        brief: 'Run `safe_recurse(5)` and bind to `val`. Inspect how recursion depth is bounded.',
        hint: 'val = safe_recurse(5)',
        start: 'def safe_recurse(n):\n    if n <= 0:\n        return "safe"\n    return safe_recurse(n - 1)',
        par: 1,
        difficulty: 5,
        goal: { type: 'vars', vars: { val: { type: 'str', repr: "'safe'" } } },
        solution: 'val = safe_recurse(5)',
        lesson: `Python protects system memory from stack overflow by enforcing a maximum recursion depth (default 1000 in CPython, configured via \`sys.getrecursionlimit()\`).

When a function recurses indefinitely without reaching a base case, Python raises:
\`\`\`
RecursionError: maximum recursion depth exceeded
\`\`\`
Never rely on catching \`RecursionError\` in production — always guarantee a valid base case or refactor to an iterative loop.`,
        learning: [
          'Python enforces a strict recursion depth limit to prevent stack overflows',
          'Exceeding stack depth raises RecursionError instead of crashing the process',
        ],
        fieldNotes: [
          'sys.setrecursionlimit() can raise the limit, but risks C-level stack overflow',
          'Convert deep recursions to iterative loops with explicit collections.deque',
        ],
      },
    ],
    deepLesson: `## Beginner: The Anatomy of a Recursive Function
A function that calls itself is recursive. A recursive solution always needs:
1. **Base Case:** When to stop recursing.
2. **Recursive Step:** How to break the problem into a smaller instance.

\`\`\`python
def countdown(n):
    if n <= 0:
        return "blastoff"
    return countdown(n - 1)
\`\`\`

## Intermediate: The Call Stack Lifecycle
Every time a Python function is invoked, the interpreter creates a **call frame** containing:
- Parameter bindings
- Local variables
- Return address

Call frames form a stack: the most recently called function is at the top of the stack and must return before the caller below it can resume.

## Advanced: Stack Frames vs Heap Objects
Stack frames are transient — they are popped as soon as their function returns.
However, objects created on the heap (such as lists, dictionaries, or custom class instances) survive as long as any reference from an outer frame or global namespace points to them.

## Expert: Recursion Limits and Tail Recursion
Python intentionally does **not** implement Tail Call Optimization (TCO) because Guido van Rossum preferred preserving full, inspectable tracebacks for debugging.
To prevent infinite loops from crashing the process with an OS segmentation fault, Python enforces a recursion limit:
\`\`\`python
import sys
print(sys.getrecursionlimit())  # Typically 1000
\`\`\`
When exceeded, CPython raises \`RecursionError\`. For deeply nested algorithms, use an explicit iterative loop with an explicit list stack.`,
  },
];
