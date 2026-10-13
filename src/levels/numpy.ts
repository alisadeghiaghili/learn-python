/**
 * Series: NumPy — Buffers & Views.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';
import { schematicBlock, type SchematicSpec } from '../ui/schematic';

/**
 * The one picture the whole series is built on: a window over a buffer, where
 * a slice is a second window over the SAME buffer (dashed) and a copy owns its
 * own separate buffer.
 */
const VIEW_VS_COPY: SchematicSpec = {
  id: 'numpy-view-vs-copy',
  title: 'A window over a buffer — view vs copy',
  nodes: [
    { id: 'a', label: 'a', sub: 'ndarray · own' },
    { id: 'v', label: 'v = a[:2]', sub: 'ndarray · view' },
    { id: 'c', label: 'b = a.copy()', sub: 'ndarray · own' },
    { id: 'bufA', label: 'buffer A', sub: 'float64[3]', type: 'buffer' },
    { id: 'bufB', label: 'buffer B', sub: 'float64[2]', type: 'buffer' },
  ],
  edges: [
    { from: 'a', to: 'bufA', label: 'owns' },
    { from: 'v', to: 'bufA', label: 'same buffer', dashed: true },
    { from: 'c', to: 'bufB', label: 'owns (new)' },
  ],
  legend: [
    { color: 'amber', label: 'points at / owns' },
    { color: 'coral', label: 'shares the buffer' },
  ],
};

export const series: Sequence[] = [
  {
    id: 'numpy',
    title: 'NumPy: Buffers & Views',
    deepLesson: `## ELI5

A numpy array is like a **frame** you slide over a row of beads. The beads (the
numbers) sit in one long, unbroken row — that row is the **buffer**. The frame
is the **array**: it just says "start here, show this many beads." When you take
a slice, you don't copy any beads; you make a *smaller frame* over the **same**
row. When you copy, you pour the beads into a brand-new row.

${schematicBlock(VIEW_VS_COPY)}

## ELI10

Two objects, always. \`np.array([1, 2, 3])\` allocates a **buffer** (a flat,
contiguous run of raw numbers) and an **ndarray** — a *window* (an offset plus a
length) that says which part of that buffer to show. The name \`a\` points at the
window; the window points at the buffer.

- \`a.copy()\` reads \`a\`'s buffer and mints a **second** buffer with the same
  numbers. Two windows, two buffers — edits to one are invisible to the other.
- \`a[:2]\` makes a **view**: a second window over the *same* buffer. No data
  moves; only the offset and length change.
- Because a view shares its buffer, \`v[0] = 9\` writes into the shared run, and
  \`a\` sees the change. A copy, never.

## ELI15

The mental model that matters in real code: **a slice is a view, not a copy.**
This is the single most common numpy foot-gun.

- A slice \`a[i:j]\` is O(1) — it allocates a new window, moves no data, and
  shares the buffer. The result's \`base\` attribute points back at the original.
- Any operation that *builds new data* (an element-wise op like \`a + 1\`, a
  fancy index, \`a.copy()\`) allocates a **fresh** buffer.
- So the question to always ask: *does this expression share my data, or make
  new data?* Chaining views is free; chaining real operations is where you pay
  memory.

## ELI20

The memory mechanics, precisely.

- A buffer is one contiguous \`float64\` run. An ndarray stores \`{buffer,
  offset, shape, dtype, view}\`. Two ndarrays are "the same data" iff they
  point at the same buffer box (that is exactly what the RAM view's shared
  window strip shows).
- Element-wise ops are vectorized: \`a + 1\` reads \`a\`'s window and writes a
  new buffer. Chained expressions allocate an intermediate buffer per step —
  the cost to watch in a hot loop.
- \`a.sum()\` is a reduction over the window: one pass, a scalar out, no new
  buffer.
- Watch the RAM tab while you do this: addresses are monotonic, the buffer row
  shows its raw byte cells, and each view paints its \`[offset..offset+shape)\`
  window as a strip aligned to those cells.

## ELI-PHD

Where this model pays off and where it breaks.

- **Strides & broadcast**: real ndarrays carry a stride, so a non-contiguous
  slice is still a view (a window with a non-1 stride). This visualizer keeps a
  flat 1-D window to stay honest about the buffer, and says so in the lessons.
- **\`base\` / \`.copy()\` contract**: in production, \`arr.base\` is the canonical
  "does this view own its data" check; \`copy(arr)\` and \`arr.copy()\` are the
  escape hatch. A view outliving its buffer is the classic memory-safety trap.
- **Performance**: prefer in-place ops and views when you don't need the
  independence, and \`np.ascontiguousarray\` before a call that wants
  contiguity. The identity picture — shared vs owned buffer — is the whole
  decision: copy only when you must own the data.
`,
    levels: [
      {
        id: 'np-make-array',
        eli: 'eli10',
        name: 'Build an ndarray',
        brief: 'Import numpy as `np` and build `a = np.array([1, 2, 3])`. An ndarray is a *window* over a separate **buffer** box that holds the raw numbers — two boxes, not one.',
        hint: 'a = np.array([1, 2, 3])',
        start: 'import numpy as np',
        par: 1,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.isNdarray('a'), preds.hasRepr('a', '[1. 2. 3.]')],
        },
        solution: 'a = np.array([1, 2, 3])',
        lesson: `In the memory model, \`np.array([1, 2, 3])\` makes **two** heap boxes. The inner one is a *buffer* — a flat run of raw numbers \`[1, 2, 3]\`. The outer one is the **ndarray**: a *window* (offset + shape) that says "show me this slice of that buffer."

The name \`a\` points at the ndarray box, which in turn points at the buffer box. That split — the view over the raw data — is the whole idea numpy is built on, and it is exactly what makes views and copies possible.`,
        learning: ['An ndarray is a window over a separate buffer', 'The name points at the window, not the raw numbers'],
        fieldNotes: ['The buffer is contiguous C memory; the window adds shape and stride', 'dtype is fixed per buffer — here `float64`'],
      },
      {
        id: 'np-copy',
        eli: 'eli15',
        name: 'An independent copy',
        brief: 'Copy `a` into `b` with `.copy()`. `b` must get its **own** buffer — two names, two windows, two *separate* buffers.',
        hint: 'b = a.copy()',
        start: 'import numpy as np\na = np.array([1, 2])',
        par: 1,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.isNdarray('b'), preds.hasRepr('b', '[1. 2.]'), preds.independentBuffer('a', 'b')],
        },
        solution: 'b = a.copy()',
        lesson: `\`a.copy()\` does real work: it reads \`a\`'s buffer and mints a **brand-new** buffer with the same numbers, then wraps it in a fresh window. Now \`a\` and \`b\` are two windows over **two different** buffers.

Watch the canvas: two ndarray boxes, each with its own amber edge to a *different* buffer box. Because the buffers are separate, editing one is invisible to the other. This is the "safe" way to take an array off a shared one.`,
        learning: ['`.copy()` allocates a new buffer, not just a new window', 'Independent buffers means no shared mutation'],
        fieldNotes: ['Copying is O(n) — it re-reads every element into new memory', 'Reach for `.copy()` before mutating an array you do not own'],
      },
      {
        id: 'np-view-slice',
        eli: 'eli15',
        name: 'A slice is a view',
        brief: 'Slice `a[:2]` into `v`. A numpy slice is NOT a copy — it is a **view**: a second window onto the *same* buffer `a` already uses.',
        hint: 'v = a[:2]',
        start: 'import numpy as np\na = np.array([1, 2, 3])',
        par: 1,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.isNdarray('v'), preds.hasRepr('v', '[1. 2.]'), preds.sharesBuffer('a', 'v')],
        },
        solution: 'v = a[:2]',
        lesson: `This is the flagship. \`a[:2]\` does **not** copy the first two numbers into new memory. It just makes a **second window** — "show me elements 0 through 2" — pointing at the *very same* buffer \`a\` uses.

On the canvas you now see two ndarray boxes (\`a\` and \`v\`) with amber edges that converge on **one** buffer box. The tag under \`v\` says \`view\`; the tag under \`a\` says \`own\`. Same data, two windows — slicing is cheap precisely because it shares the buffer.`,
        learning: ['A slice is a view, not a copy — it shares the buffer', 'The `view` tag means "this window is not the whole buffer"'],
        fieldNotes: ['Slicing is O(1): no data is moved, just a new offset + shape', 'This is why views can be a foot-gun (next level)'],
      },
      {
        id: 'np-view-mutates',
        eli: 'eli20',
        name: 'The shared buffer bites',
        brief: '`v = a[:2]` is a view of `a`. Write `v[0] = 9`. Because `v` and `a` share one buffer, `a` **changes too** — you never touched it.',
        hint: 'v[0] = 9 writes through the shared buffer.',
        start: 'import numpy as np\na = np.array([1, 2, 3])\nv = a[:2]',
        par: 1,
        difficulty: 4,
        goal: {
          type: 'predicates',
          predicates: [
            preds.sharesBuffer('a', 'v'),
            preds.hasRepr('a', '[9. 2. 3.]'),
            preds.hasRepr('v', '[9. 2.]'),
          ],
        },
        solution: 'v[0] = 9',
        lesson: `Here is why views matter. \`v\` is just a window over \`a\`'s buffer, so \`v[0] = 9\` writes **into that shared buffer** at position 0. Reading \`a\` again shows \`9\` where the \`1\` used to be — \`a\` changed because it and \`v\` are two views onto one buffer.

The canvas makes it unavoidable: one buffer box, two windows, one write, two observers. If you wanted \`v\` to be its own independent data, you would have needed \`a[:2].copy()\` instead — a view plus a copy.`,
        learning: ['Writing through a view mutates the shared buffer', 'Every view onto that buffer sees the change'],
        fieldNotes: ['`a[:]` (a full slice) is still a view — copy it if you must not share', 'numpy exposes `v.base` to find the buffer a view points at'],
      },
      {
        id: 'np-vector-capstone',
        eli: 'eli20',
        name: 'Capstone: vectorize + fold',
        brief: 'The numpy finale. `b = a + 1` is *vectorized* — it reads `a` and builds a **new** buffer `[2. 3. 4.]`. Then `s = b.sum()` folds that buffer into a single scalar.',
        hint: 'b = a + 1 (a new array), then s = b.sum()',
        start: 'import numpy as np\na = np.array([1, 2, 3])',
        par: 2,
        difficulty: 4,
        goal: {
          type: 'predicates',
          predicates: [
            preds.isNdarray('b'),
            preds.hasRepr('b', '[2. 3. 4.]'),
            preds.independentBuffer('a', 'b'),
            preds.hasRepr('s', '9'),
          ],
        },
        solution: 'b = a + 1\ns = b.sum()',
        lesson: `NumPy's payoff is *vectorization*: \`a + 1\` adds 1 to **every** element in one expression. Under the hood that is the memory story you have just learned — it reads \`a\`'s buffer, builds a **new** buffer \`[2, 3, 4]\`, and wraps it in a fresh window \`b\`. No element is shared with \`a\`.

\`b.sum()\` then walks that buffer once and folds it into the scalar \`9\`. Three ideas at once: a window over a buffer, a vectorized op that mints a new buffer, and a reduction over it. That is the shape of real numpy.`,
        learning: ['A vectorized op builds a new buffer from the operand', '`.sum()` reduces a buffer to a scalar'],
        fieldNotes: ['Element-wise ops always allocate a new result buffer', 'Chaining ops allocates intermediate buffers — that is the cost to watch in real code'],
      },
    ],
  },
];
