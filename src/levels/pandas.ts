/**
 * Series: Pandas — Tables as windows over a buffer.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';
import { schematicBlock, type SchematicSpec } from '../ui/schematic';

/**
 * The one picture the series is built on: a DataFrame is a window over one
 * row-major buffer. An `iloc` row-slice is a second window over the SAME buffer
 * (dashed = shared); `.copy()` owns a brand-new buffer.
 */
const PD_VIEW_VS_COPY: SchematicSpec = {
  id: 'pandas-view-vs-copy',
  title: 'A DataFrame window over one buffer',
  nodes: [
    { id: 'df', label: 'df', sub: 'DataFrame · own' },
    { id: 'v', label: 'v = df.iloc[1:3]', sub: 'DataFrame · view' },
    { id: 'c', label: 'c = df.copy()', sub: 'DataFrame · own' },
    { id: 'buf', label: 'buffer', sub: 'row-major [x, y, …]', type: 'buffer' },
    { id: 'buf2', label: 'buffer B', sub: 'fresh copy', type: 'buffer' },
  ],
  edges: [
    { from: 'df', to: 'buf', label: 'owns' },
    { from: 'v', to: 'buf', label: 'row window · shared', dashed: true },
    { from: 'c', to: 'buf2', label: 'owns (new)' },
  ],
  legend: [
    { color: 'amber', label: 'points at / owns' },
    { color: 'coral', label: 'shares the buffer' },
  ],
};

export const series: Sequence[] = [
  {
    id: 'pandas',
    title: 'Pandas: Tables as windows over a buffer',
    deepLesson: `## Beginner

A pandas table is like a **grid of beads**. All the numbers are poured into one
long, unbroken row (the **buffer**) — the beads for column 1, then column 2, in
turn, row by row. The table (a **DataFrame**) is a *frame* that says "these are
the columns, these are the rows." When you take a row-slice with \`iloc\`, you
don't recopy any beads; you just slide a *smaller frame* over the **same** row.
When you copy, you pour the beads into a brand-new row.

${schematicBlock(PD_VIEW_VS_COPY)}

## Intermediate

A **DataFrame** is a window over one buffer, held row-major: row 0's cells, then
row 1's cells, and so on. A **Series** is the 1-D case — one column, its own
buffer plus a list of row labels.

- \`pd.DataFrame({"x": [1, 2], "y": [3, 4]})\` pours the rows into one buffer
  \`[1, 3, 2, 4]\` and wraps it with column names and an index.
- \`df["x"]\` reads one column out as a **Series**.
- \`df.iloc[1:3]\` is a **view**: a second window onto the *same* buffer, just
  over a row range. No data is copied.
- Because a view shares its buffer, writing through \`v\` changes \`df\` too.

## Advanced

The mental model that matters: **\`loc\`/\`iloc\` are views, not copies.** That
is the pandas identity idea, and it is exactly the numpy lesson lifted to a
table.

- \`df.iloc[a:b]\` makes a window over a row range — the data is not moved. The
  slice's buffer **is** the frame's buffer.
- \`df.copy()\` reads the window and mints a **new** buffer. Two frames, two
  buffers — edits to one are invisible to the other.
- \`df["col"] = [...]\` writes *into* the shared buffer, so every window over it
  sees the change.
- So the standing question: *does this expression share my frame's data, or make
  new data?* Slicing is free; a copy is where you pay.

## Expert

The mechanics, precisely.

- A DataFrame stores \`{buffer, columns, index, dtype, view, rowOffset}\`. A
  row-slice reuses \`buffer\` and advances \`rowOffset\`; a copy mints a new
  buffer with \`rowOffset\` 0 and \`view: false\`.
- "Same data" means "same buffer box" — that is exactly what the RAM view shows
  (the frame and its view point at one buffer; a copy points at a second).
- \`df.sum()\` reduces each column into a Series; \`df["col"]\` reads a column
  as a Series. Both *build* objects over a (new or single-column) buffer.
- Watch the RAM tab: the buffer row shows the row-major byte cells, and a view
  is a window over that shared run.

## Master

Where it pays off and where it breaks.

- **Copy-on-write**: in pandas 3.0+, Copy-on-Write (CoW) is the default and only mode,
  meaning writing through a slice triggers a defensive copy to prevent silent mutation
  of the source DataFrame. This visualizer models the underlying shared-buffer layout
  so you can see why defensive copies exist.
- **Loc vs iloc**: \`loc\` is label-based, \`iloc\` is position-based — both are
  views; neither copies. Writing through a view mutates the shared buffer (the
  classic foot-gun), while assigning a *new* column rebinds.
- **Memory**: a large frame sliced many ways is still one buffer; a chain of
  \`.copy()\` calls is where rows duplicate. The identity picture — shared vs
  owned buffer — is the whole decision, same as numpy.
`,
    levels: [
      {
        id: 'pd-make-series',
        eli: 'eli5',
        name: 'Build a Series',
        brief: 'Import pandas as `pd` and build `s = pd.Series([1, 2, 3])`. A Series is a column: one **buffer** of numbers plus a row index.',
        hint: 's = pd.Series([1, 2, 3])',
        start: 'import pandas as pd',
        par: 1,
        difficulty: 1,
        goal: {
          type: 'predicates',
          predicates: [preds.isSeries('s'), preds.rows('s', 3)],
        },
        solution: 's = pd.Series([1, 2, 3])',
        lesson: `A **Series** is the 1-D case of the numpy picture: a window over a **buffer** of raw numbers, plus a row index that labels the positions. The name \`s\` points at the Series box, which points at its buffer box. Two boxes, one column.`,
        learning: ['A Series is a column: a window over a buffer + a row index', 'The name points at the Series, not the raw numbers'],
        fieldNotes: ['dtype is fixed per buffer — here `float64`', 'The index is what `loc` addresses'],
      },
      {
        id: 'pd-make-frame',
        eli: 'eli10',
        name: 'Build a DataFrame',
        brief: 'Build `df = pd.DataFrame({"x": [1, 2], "y": [3, 4]})`. The rows are poured into ONE **buffer** (row-major: `[1, 3, 2, 4]`), wrapped with column names and an index.',
        hint: 'df = pd.DataFrame({"x": [1, 2], "y": [3, 4]})',
        start: 'import pandas as pd',
        par: 1,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [preds.isDataFrame('df'), preds.rows('df', 2)],
        },
        solution: 'df = pd.DataFrame({"x": [1, 2], "y": [3, 4]})',
        lesson: `A **DataFrame** is a window over a single **buffer** laid out row-major: row 0's cells, then row 1's, and so on. \`{"x": [1, 2], "y": [3, 4]}\` becomes the buffer \`[1, 3, 2, 4]\` — x then y for row 0, then x then y for row 1 — wrapped with the column names \`x\`, \`y\` and an index.`,
        learning: ['A DataFrame is one buffer (row-major) + columns + index', 'The buffer is [x0, y0, x1, y1, ...], not column-by-column'],
        fieldNotes: ['Columns are virtual slices of the row-major buffer', 'This is why a single column is read out as its own Series'],
      },
      {
        id: 'pd-col-select',
        eli: 'eli15',
        name: 'Read a column',
        brief: 'Take `c = df["x"]`. Selecting one column by name returns a **Series** — the x-values, with the frame\'s index.',
        hint: 'c = df["x"]',
        start: 'import pandas as pd\ndf = pd.DataFrame({"x": [1, 2], "y": [3, 4]})',
        par: 1,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.isSeries('c'), preds.rows('c', 2)],
        },
        solution: 'c = df["x"]',
        lesson: `A column is not a contiguous run of the row-major buffer — the x-values are interleaved with the y-values. So \`df["x"]\` reads them out into a **Series** with its own single-column buffer and the frame's index. A table and a column are two different shapes of the same window idea.`,
        learning: ['Selecting a column yields a Series', 'A column is carved out of the row-major buffer'],
        fieldNotes: ['`df[["x", "y"]]` (a list) yields a sub-DataFrame instead', 'Column selection is the entry point to per-column math'],
      },
      {
        id: 'pd-iloc-view',
        eli: 'eli20',
        name: 'A row-slice is a view',
        brief: 'Slice `v = df.iloc[1:3]`. An `iloc` row-slice is NOT a copy — it is a **view**: a second window onto the *same* buffer `df` already uses.',
        hint: 'v = df.iloc[1:3]',
        start: 'import pandas as pd\ndf = pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})',
        par: 1,
        difficulty: 4,
        goal: {
          type: 'predicates',
          predicates: [preds.isDataFrame('v'), preds.sharesFrameBuffer('df', 'v'), preds.rows('v', 2)],
        },
        solution: 'v = df.iloc[1:3]',
        lesson: `This is the flagship. \`df.iloc[1:3]\` does **not** copy rows 1 and 2 into new memory. It makes a **second window** over the *same* buffer, advanced to row 1. The RAM view makes it unavoidable: \`df\` and \`v\` point at **one** buffer box; \`v\` is just a row-range of it. Writing through \`v\` edits the shared buffer, so \`df\` sees it. A copy would be the escape hatch — next level.`,
        learning: ['An `iloc` row-slice is a view, not a copy — it shares the buffer', 'The view is a window advanced to a row offset'],
        fieldNotes: ['`loc` is the label-based twin of `iloc` — also a view', 'This is why `v = df[...]` can mutate `df` in real code'],
      },
      {
        id: 'pd-copy-independent',
        eli: 'eliphd',
        name: 'Capstone: view vs copy',
        brief: 'The pandas finale. `v = df.iloc[1:3]` is a *view* that **shares** `df`\'s buffer; `c = df.copy()` is *independent* — it owns a **new** buffer. Show the contrast.',
        hint: 'v = df.iloc[1:3] (shares), then c = df.copy() (independent)',
        start: 'import pandas as pd\ndf = pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})',
        par: 2,
        difficulty: 5,
        goal: {
          type: 'predicates',
          predicates: [
            preds.sharesFrameBuffer('df', 'v'),
            preds.independentFrameBuffer('df', 'c'),
            preds.independentFrameBuffer('v', 'c'),
          ],
        },
        solution: 'v = df.iloc[1:3]\nc = df.copy()',
        lesson: `NumPy's payoff, as a table. \`df.iloc[1:3]\` shares \`df\`'s buffer (a view — one box, two windows), while \`df.copy()\` mints a **new** buffer. Three facts at once: \`df\` and \`v\` are "the same data" (same buffer box), and \`df\` and \`c\` are not (different buffers). That shared-vs-owned distinction is the entire pandas memory model, and the RAM tab is where you can see it: the frame and its view aim at one buffer, the copy at a second.`,
        learning: ['A view shares the buffer; a copy owns a new one', '"Same data" means "same buffer box"'],
        fieldNotes: ['Prefer views when you only need to look; copy when you must own the rows', 'Chained `.copy()` calls are where a big frame duplicates in memory'],
      },
    ],
  },
];
