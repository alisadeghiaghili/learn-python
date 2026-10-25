/**
 * Series: Slicing Semantics.
 *
 * Explores basic slicing, strides, negative indexing, slice assignment,
 * and the fundamental contrast between Python list slice copies and NumPy strided views.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'slicing',
    title: 'Slicing & Strides',
    levels: [
      {
        id: 'slice-start-stop',
        eli: 'eli5',
        name: 'Basic slice allocates a copy',
        brief: 'Extract a slice `sub = xs[1:4]` from `xs`. Notice on the Memory board that `sub` is an entirely new list object on the heap.',
        hint: 'sub = xs[1:4]',
        start: 'xs = [10, 20, 30, 40, 50]',
        par: 1,
        difficulty: 1,
        goal: { type: 'vars', vars: { sub: { type: 'list', repr: '[20, 30, 40]' } } },
        solution: 'sub = xs[1:4]',
        lesson: `Slicing a built-in Python list with \`[start:stop]\` extracts elements from index \`start\` up to (but not including) \`stop\`.

**Look at the Memory Board:**
Notice that \`sub\` points to a completely distinct \`list\` box on the heap. Slicing a Python list creates a **shallow copy**. Mutating \`sub\` will never affect \`xs\`.`,
        learning: [
          'List slicing [start:stop] creates a new list object on the heap',
          'The stop index is always exclusive in Python',
        ],
        fieldNotes: [
          'List slices duplicate references; they do not share container memory',
          'For 100k-element lists, repeated slicing creates measurable memory pressure',
        ],
      },
      {
        id: 'slice-step',
        eli: 'eli10',
        name: 'Strided slicing',
        brief: 'Extract every second element from `xs` using step syntax: `evens = xs[::2]`.',
        hint: 'evens = xs[::2]',
        start: 'xs = [0, 1, 2, 3, 4, 5, 6]',
        par: 1,
        difficulty: 2,
        goal: { type: 'vars', vars: { evens: { type: 'list', repr: '[0, 2, 4, 6]' } } },
        solution: 'evens = xs[::2]',
        lesson: `The full slicing syntax in Python is \`[start:stop:step]\`. When \`start\` and \`stop\` are omitted, the slice spans the whole sequence, jumping by \`step\`.

**Look at the RAM board:**
Notice how new memory is allocated for \`evens\`, containing references to 0, 2, 4, and 6.`,
        learning: [
          'The third slice parameter is the step (stride)',
          'Omitting start and stop defaults to the sequence boundaries',
        ],
        fieldNotes: [
          'Step slicing works on strings, tuples, and lists',
          'Use step 2 for alternating elements or sampling',
        ],
      },
      {
        id: 'slice-negative-reverse',
        eli: 'eli15',
        name: 'Negative strides and reversing',
        brief: 'Reverse the list `xs` into a new list `rev` using a negative step stride `[::-1]`.',
        hint: 'rev = xs[::-1]',
        start: "xs = ['a', 'b', 'c', 'd']",
        par: 1,
        difficulty: 3,
        goal: { type: 'vars', vars: { rev: { type: 'list', repr: "['d', 'c', 'b', 'a']" } } },
        solution: 'rev = xs[::-1]',
        lesson: `A negative step traverses the sequence backwards. \`xs[::-1]\` produces a reversed copy.

**Look at the Memory Board:**
\`rev\` is a separate list with elements in reverse order. The original \`xs\` list is completely untouched.`,
        learning: [
          'Negative step values step backward through sequence indices',
          'xs[::-1] is Python standard idiom for creating a reversed shallow copy',
        ],
        fieldNotes: [
          'Unlike xs.reverse() which mutates in place and returns None, [::-1] returns a new object',
          'For iterators without memory allocation, prefer reversed(xs)',
        ],
      },
      {
        id: 'slice-assignment',
        eli: 'eli20',
        name: 'In-place slice assignment',
        brief: 'Replace the middle elements `xs[1:3]` with `[200, 300]`. Watch the heap: the list object is mutated in-place without changing its identity.',
        hint: 'xs[1:3] = [200, 300]',
        start: 'xs = [1, 2, 3, 4]\nref = xs',
        par: 1,
        difficulty: 4,
        goal: { type: 'vars', vars: { xs: { type: 'list', repr: '[1, 200, 300, 4]' } } },
        solution: 'xs[1:3] = [200, 300]',
        lesson: `Slice assignment (\`xs[start:stop] = iterable\`) mutates the existing list in-place.

**Look at the Memory Board:**
Notice that \`ref\` and \`xs\` still point to the exact same list on the heap (\`xs is ref\` remains \`True\`). The elements inside the existing container were spliced in-place.`,
        learning: [
          'Slice assignment modifies container contents in-place',
          'The right-hand side of slice assignment can be any iterable',
        ],
        fieldNotes: [
          'xs[:] = [] clears an existing list in-place, notifying all aliases',
          'Slice replacement can shrink or expand the list size dynamically',
        ],
      },
      {
        id: 'slice-object-vs-view',
        eli: 'eliphd',
        name: 'Slice objects vs NumPy views',
        brief: 'Create an explicit `s = slice(1, 4)` object and apply it to `xs` into `res = xs[s]`.',
        hint: 's = slice(1, 4)\nres = xs[s]',
        start: 'xs = [10, 20, 30, 40, 50]',
        par: 2,
        difficulty: 5,
        goal: { type: 'vars', vars: { s: { type: 'slice', repr: 'slice(1, 4, None)' }, res: { type: 'list', repr: '[20, 30, 40]' } } },
        solution: 's = slice(1, 4)\nres = xs[s]',
        lesson: `The bracket syntax \`xs[1:4]\` is syntactic sugar for \`xs[slice(1, 4)]\`. The built-in \`slice()\` constructor creates a first-class slice object.

**Contrast with NumPy on the RAM Board:**
In standard Python, slicing a list always makes a new container copy. In NumPy, array slicing creates a **strided view** that shares the exact same underlying buffer.`,
        learning: [
          'slice(start, stop, step) constructs first-class slice objects',
          'Python list slices copy data; NumPy array slices share underlying memory buffers',
        ],
        fieldNotes: [
          'Reusable slice objects are ideal for structured record processing',
          'NumPy views keep the base alive via v.base is a',
        ],
      },
    ],
    deepLesson: `## Beginner: The Basics of Slicing
Slicing allows you to access sub-sequences of lists, tuples, and strings using \`[start:stop]\`.
In Python, indices are zero-based, and the \`stop\` index is exclusive:
\`\`\`python
xs = [10, 20, 30, 40, 50]
sub = xs[1:4]  # [20, 30, 40]
\`\`\`
Every time you slice a built-in list or string, Python allocates a brand new object on the heap.

## Intermediate: Strides and Negative Indexing
You can specify a third argument: the step stride \`[start:stop:step]\`.
A negative step allows stepping backwards:
\`\`\`python
xs = [1, 2, 3, 4, 5]
evens = xs[::2]   # [1, 3, 5]
rev = xs[::-1]    # [5, 4, 3, 2, 1]
\`\`\`

## Advanced: In-Place Slice Mutation
Unlike reading a slice, assigning to a slice modifies the container in-place:
\`\`\`python
xs = [1, 2, 3, 4]
xs[1:3] = [200, 300]
print(xs)  # [1, 200, 300, 4]
\`\`\`
Because the existing list object is mutated, all variables pointing to it observe the change.

## Expert: Slice Objects and Memory View Contrasts
Under the hood, \`xs[a:b:c]\` translates to \`xs.__getitem__(slice(a, b, c))\`.
You can pass \`slice\` objects programmatically:
\`\`\`python
s = slice(1, 4)
part = xs[s]
\`\`\`
**Crucial Memory Distinction:**
- Built-in lists: \`xs[1:3]\` creates a **shallow copy**.
- NumPy arrays: \`arr[1:3]\` creates a **strided view** pointing directly into the original array buffer without copying bytes.`,
  },
];
