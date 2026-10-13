/**
 * Series: Plotting & Capstone.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'plotting',
    title: 'Plotting & Capstone',
    levels: [
      {
        id: 'plot-scatter',
        eli: 'eli15',
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
        eli: 'eli20',
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
        eli: 'eliphd',
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
