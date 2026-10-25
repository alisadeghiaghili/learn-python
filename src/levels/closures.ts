/**
 * Series: Closures, Generators & Lazy Evaluation.
 *
 * Explores lexical scoping, closure cell bindings outliving parent frames,
 * generator functions that suspend and resume, and lazy evaluation memory profiles.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'closures',
    title: 'Closures & Lazy Evaluation',
    levels: [
      {
        id: 'closure-inner-function',
        eli: 'eli5',
        name: 'Nested functions and lexical scope',
        brief: 'Call `make_greeter("Hi")` and bind the resulting function to `greet`.',
        hint: 'greet = make_greeter("Hi")',
        start: 'def make_greeter(prefix):\n    def greeter(name):\n        return prefix + " " + name\n    return greeter',
        par: 1,
        engine: 'pyodide',
        difficulty: 1,
        goal: { type: 'vars', vars: { greet: { type: 'function' } } },
        solution: 'greet = make_greeter("Hi")',
        lesson: `Python functions can define other functions inside their bodies. The inner function has access to the outer function's parameters and local variables through **lexical scoping**.

**Look at the Heap:**
When \`make_greeter\` executes, it allocates a new function object representing \`greeter\` and returns its heap reference.`,
        learning: [
          'Functions can be defined inside other functions',
          'Inner functions can access variables from enclosing scopes',
        ],
        fieldNotes: [
          'Lexical scoping in Python follows LEGB: Local, Enclosing, Global, Builtin',
          'Nested functions are the building blocks of decorators',
        ],
      },
      {
        id: 'closure-state-capture',
        eli: 'eli10',
        name: 'State capture survives frame exit',
        brief: 'Call `counter()` twice and bind the second result to `count`. Notice how the captured count state persists across calls.',
        hint: 'c = counter()\nfirst = c()\ncount = c()',
        start: 'def counter():\n    n = [0]\n    def inc():\n        n[0] += 1\n        return n[0]\n    return inc\nc = counter()',
        par: 2,
        engine: 'pyodide',
        difficulty: 2,
        goal: { type: 'vars', vars: { count: { type: 'int', repr: '2' } } },
        solution: 'first = c()\ncount = c()',
        lesson: `A **closure** is a function that retains access to variables from its enclosing scope even after the outer function has finished executing and its stack frame has been destroyed.

**Look at the Memory Board:**
Even though \`counter()\` has returned, the captured mutable cell \`n\` lives on the heap, kept alive by the closure reference held by \`c\`.`,
        learning: [
          'A closure binds variables from an enclosing scope to an inner function',
          'Captured variables survive on the heap even after the enclosing frame pops',
        ],
        fieldNotes: [
          'Closures provide lightweight encapsulation without full class definitions',
          'In Python 3, `nonlocal` allows direct rebinding of enclosed scalar variables',
        ],
      },
      {
        id: 'generator-function',
        eli: 'eli15',
        name: 'Generator functions and yield',
        brief: 'Create a generator `g = gen_nums()` and advance it once with `first = next(g)`.',
        hint: 'g = gen_nums()\nfirst = next(g)',
        start: 'def gen_nums():\n    yield 10\n    yield 20\n    yield 30',
        par: 2,
        engine: 'pyodide',
        difficulty: 3,
        goal: { type: 'vars', vars: { first: { type: 'int', repr: '10' } } },
        solution: 'g = gen_nums()\nfirst = next(g)',
        lesson: `When a function contains the \`yield\` keyword, calling it does not execute the body immediately. Instead, it returns a **generator object**.

Calling \`next(g)\` starts or resumes execution up to the next \`yield\` expression, yielding the value and suspending the execution state.`,
        learning: [
          'Functions with yield return generator objects when called',
          'next(gen) advances execution to the next yield and pauses',
        ],
        fieldNotes: [
          'Generators maintain execution pointers and local frame variables while suspended',
          'When no more yields remain, a generator raises StopIteration',
        ],
      },
      {
        id: 'generator-expression',
        eli: 'eli20',
        name: 'Generator expressions vs list comprehensions',
        brief: 'Create a generator expression `squares_gen = (x * x for x in [1, 2, 3])` and read its first value `val = next(squares_gen)`.',
        hint: 'squares_gen = (x * x for x in [1, 2, 3])\nval = next(squares_gen)',
        start: '',
        par: 2,
        engine: 'pyodide',
        difficulty: 4,
        goal: { type: 'vars', vars: { val: { type: 'int', repr: '1' } } },
        solution: 'squares_gen = (x * x for x in [1, 2, 3])\nval = next(squares_gen)',
        lesson: `Parentheses around a comprehension produce a **generator expression**:
\`\`\`python
gen = (x * x for x in numbers)
\`\`\`
Unlike a list comprehension \`[x * x for x in numbers]\` which eagerly computes and stores every element in a list on the heap immediately, a generator expression evaluates items lazily on demand.`,
        learning: [
          '(x for x in iterable) creates a lazy generator expression',
          'Generator expressions do not allocate memory for all elements upfront',
        ],
        fieldNotes: [
          'Use generator expressions inside functions like sum(), min(), max()',
          'Generators can only be consumed once; subsequent iterations produce nothing',
        ],
      },
      {
        id: 'lazy-vs-eager-memory',
        eli: 'eliphd',
        name: 'Memory profiles of eager vs lazy evaluation',
        brief: 'Compare eager list `eager = [x * 10 for x in range(5)]` with lazy generator `lazy = (x * 10 for x in range(5))`. Read `first = next(lazy)`.',
        hint: 'eager = [x * 10 for x in range(5)]\nlazy = (x * 10 for x in range(5))\nfirst = next(lazy)',
        start: '',
        par: 3,
        engine: 'pyodide',
        difficulty: 5,
        goal: { type: 'vars', vars: { eager: { type: 'list', repr: '[0, 10, 20, 30, 40]' }, first: { type: 'int', repr: '0' } } },
        solution: 'eager = [x * 10 for x in range(5)]\nlazy = (x * 10 for x in range(5))\nfirst = next(lazy)',
        lesson: `**Look at the RAM board:**
Notice the memory difference:
- \`eager\` allocates an entire list buffer containing 5 distinct integer references.
- \`lazy\` allocates a compact generator object that computes values one at a time on demand.

For million-item datasets or file streaming, lazy pipelines keep memory consumption flat at $O(1)$.`,
        learning: [
          'Eager list comprehensions have O(N) memory complexity',
          'Lazy generator streams have O(1) memory complexity',
        ],
        fieldNotes: [
          'Pipeline generators together: (normalize(line) for line in read_lines(file))',
          'Itertools provides high-performance C-level generator combinators',
        ],
      },
    ],
    deepLesson: `## Beginner: Inner Functions and Scopes
Functions in Python are first-class citizens: you can assign them to names, pass them as arguments, and return them from other functions.
When you define a function inside another:
\`\`\`python
def outer():
    msg = "hello"
    def inner():
        return msg
    return inner
\`\`\`
The inner function has access to names in its enclosing lexical scope.

## Intermediate: What is a Closure?
When an inner function references variables from an outer scope, and is returned or passed out of that scope, it becomes a **closure**:
\`\`\`python
fn = outer()
print(fn())  # "hello"
\`\`\`
Even though \`outer()\` has completed execution and its stack frame is long gone, the closure keeps the referenced variables alive in a **closure cell** on the heap.

## Advanced: Generators and Cooperative Execution
Generators turn functions into stateful iterators using the \`yield\` keyword:
\`\`\`python
def countdown(n):
    while n > 0:
        yield n
        n -= 1
\`\`\`
When called, \`countdown(3)\` returns a generator object without running code. Calling \`next()\` runs until a \`yield\` is encountered, then freezes the local frame until the next request.

## Expert: Memory Efficiency of Lazy Pipelines
The fundamental difference between eager collections and lazy streams is memory footprint:
- **Eager List:** \`[process(x) for x in range(10_000_000)]\` consumes gigabytes of RAM to store all 10 million results simultaneously.
- **Lazy Generator:** \`(process(x) for x in range(10_000_000))\` processes one item at a time, consuming constant $O(1)$ memory.

Chaining generators together produces zero-intermediate-allocation data pipelines.`,
  },
];
