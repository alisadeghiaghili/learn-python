/**
 * Series: Plotting & Capstone.
 *
 * The full data-visualization set: scatter, line, bar, countplot, histogram,
 * pie, area, boxplot, heatmap, and regression. The deep lesson is the
 * "which chart answers which question" map — plus a per-chart "how to build
 * it" reference (the builtin, its argument shape, and a runnable example).
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';
import { schematicBlock, type SchematicSpec } from '../ui/schematic';

/**
 * The selection map the series is built on: a *data question* at the top, each
 * family of question fanning out to the chart that answers it.
 */
const CHART_MAP: SchematicSpec = {
  id: 'plotting-chart-map',
  title: 'A question chooses its chart',
  nodes: [
    { id: 'q', label: 'your question', type: 'note' },
    { id: 'rel', label: 'relationship' },
    { id: 'dist', label: 'distribution' },
    { id: 'comp', label: 'composition' },
    { id: 'cmp', label: 'comparison' },
    { id: 'freq', label: 'frequency' },
    { id: 'corr', label: 'correlation' },
    { id: 'xy', label: 'scatter / line / area / reg' },
    { id: 'dist2', label: 'hist / boxplot' },
    { id: 'pie', label: 'pie / area' },
    { id: 'bar', label: 'bar / countplot' },
    { id: 'heat', label: 'heatmap' },
  ],
  edges: [
    { from: 'q', to: 'rel' },
    { from: 'q', to: 'dist' },
    { from: 'q', to: 'comp' },
    { from: 'q', to: 'cmp' },
    { from: 'q', to: 'freq' },
    { from: 'q', to: 'corr' },
    { from: 'rel', to: 'xy' },
    { from: 'dist', to: 'dist2' },
    { from: 'comp', to: 'pie' },
    { from: 'cmp', to: 'bar' },
    { from: 'freq', to: 'bar' },
    { from: 'corr', to: 'heat' },
  ],
  legend: [
    { color: 'amber', label: 'question → chart' },
  ],
};

export const series: Sequence[] = [
  {
    id: 'plotting',
    title: 'Plotting & Capstone',
    deepLesson: `## Beginner

A chart is a **choice**, not a decoration. Your data is silently asking a
question, and the chart type is the answer. Before you pick a chart, name the
question. The five questions you almost always want to answer:

- **Relationship** — "how do these two numbers move together?" → scatter, line, area
- **Distribution** — "how are the values spread out?" → histogram, boxplot
- **Composition** — "what share does each part have of the whole?" → pie, area
- **Comparison** — "which category is bigger?" → bar
- **Frequency** — "how often does each thing happen?" → countplot
- **Correlation** — "how strongly are many columns related?" → heatmap

Pick the chart that matches the question, and the chart explains itself.

## Intermediate

The decision map. Every arrow is "this question is best answered by this chart":

${schematicBlock(CHART_MAP)}

A few quick rules that resolve most picks:

- Two continuous series → **scatter** (do they correlate?) or **line** (is one
  ordered, like time?).
- One column of raw numbers → **hist** (the shape) or **boxplot** (the spread +
  outliers).
- A handful of categories with values → **bar**; if the values are a *share of a
  total* → **pie**.
- Many categories, just counting them → **countplot**.
- A grid of values (rows × columns) → **heatmap**.

## Advanced

**How to build each one.** Every chart is a single builtin that pushes a plot
spec onto \`state.plots\`; the Plot tab renders it. Here is the argument shape of
each, with a runnable example:

| chart        | call                                | what each argument is                          |
|--------------|-------------------------------------|------------------------------------------------|
| scatter      | \`scatter(xs, ys)\`                    | two aligned number lists                       |
| line         | \`line(xs, ys)\`                       | two aligned number lists, drawn in order       |
| area         | \`area(xs, ys)\`                       | two aligned number lists, filled under the line |
| reg          | \`reg(xs, ys)\`                        | two aligned number lists; fits a line          |
| bar          | \`bar(labels, values)\`                | a list of labels, a list of values             |
| countplot    | \`countplot(labels)\`                  | one list of raw labels (may repeat)            |
| hist         | \`hist(values)\`                       | one list of raw numbers (auto-binned)          |
| pie          | \`pie(labels, values)\`                | a list of labels, a list of values             |
| boxplot      | \`boxplot(values)\`                    | one list of raw numbers (quartiles computed)   |
| heatmap      | \`heatmap(rows, cols, matrix)\`        | row labels, col labels, a list of lists        |

Two shapes to memorize: **aligned number lists** (\`scatter(xs, ys)\`) for the
2-D charts, and **labels + values** (\`bar(labels, values)\`) for the categorical
charts. The odd one out is \`heatmap\`, which takes a *matrix* — a list of lists,
one inner list per row.

\`\`\`python
xs = [1, 2, 3]
ys = [1, 4, 9]
scatter(xs, ys)        # relationship
reg(xs, ys)            # same data, fitted line
\`\`\`

## Expert

The data shape decides, not your taste. Two traps that trip up real work:

- **bar needs labels and values; countplot needs only raw labels.** If you pass
  categories that repeat, use \`countplot\` — it tallies them. If you already have
  one number per category, use \`bar\`.
- **hist and boxplot take raw values, not pre-binned counts.** \`hist(data)\` and
  \`boxplot(data)\` both read one flat list of numbers and do the binning /
  quartiles for you. Don't pre-compute.
- **a pie is a ratio, a bar is a magnitude.** If the values sum to a meaningful
  whole, a pie is honest; if the categories are just being compared, a bar is.
  A pie with many tiny slices is a bar in disguise — switch to bar.
- **reg returns the fit.** \`reg(xs, ys)\` computes the least-squares
  slope and intercept in the engine and draws the line through the dots, so the
  chart and the math agree.

## Master

Production names, so you can read the real code. Every chart here has a
matplotlib / seaborn twin:

- scatter → \`plt.scatter\` · line → \`plt.plot\` · area → \`plt.fill_between\`
- bar → \`plt.bar\` / \`sns.barplot\` · countplot → \`sns.countplot\`
- hist → \`plt.hist\` / \`sns.histplot\` · boxplot → \`plt.boxplot\` / \`sns.boxplot\`
- pie → \`plt.pie\` · heatmap → \`plt.imshow\` / \`sns.heatmap\`
- reg → \`sns.regplot\` / \`sns.lmplot\`

Where it breaks: a line chart implies order, so it lies on unordered categories.
A pie past ~6 slices is unreadable. A heatmap needs a fixed, ordered axis
(usually standardized values) or the colors encode nothing. The memory-model
payoff is unchanged: every chart reads the *same* lists you hold on the canvas —
the chart is just those objects, drawn.
`,
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
        id: 'plot-bar',
        eli: 'eli10',
        name: 'Bar chart',
        brief: 'Build `labels = ["A", "B", "C"]` and `vals = [3, 5, 2]`, then `bar(labels, vals)`. A bar chart compares one value per category.',
        hint: 'bar(labels, values) — a label list and a value list.',
        start: '',
        par: 3,
        difficulty: 2,
        goal: { type: 'plot', kind: 'bar' },
        solution: 'labels = ["A", "B", "C"]\nvals = [3, 5, 2]\nbar(labels, vals)',
        lesson: `A **bar chart** answers "which category is bigger?". You give it two lists of the same length: \`labels\` (the categories) and \`vals\` (one number each). \`bar\` pairs them up and draws one vertical bar per category, its height set by the value.

The memory model is the same as scatter — two lists on the heap — but the chart reads them *positionally by category* instead of as (x, y) coordinates. The Plot tab shows each bar's category beneath it and its value on top.`,
        learning: ['`bar(labels, values)` compares one value per category', 'A bar chart needs two same-length lists: labels and values'],
        fieldNotes: ['matplotlib: `plt.bar(labels, vals)` / seaborn `sns.barplot`', 'Use a bar for a *magnitude*; use a pie only when the parts sum to a whole'],
      },
      {
        id: 'plot-countplot',
        eli: 'eli10',
        name: 'Countplot',
        brief: 'Build `cats = ["red", "blue", "red"]`, then `countplot(cats)`. A countplot tallies how often each label appears — no separate values needed.',
        hint: 'countplot(labels) — one raw list, it counts the repeats for you.',
        start: '',
        par: 2,
        difficulty: 2,
        goal: { type: 'plot', kind: 'countplot' },
        solution: 'cats = ["red", "blue", "red"]\ncountplot(cats)',
        lesson: `A **countplot** answers "how often does each thing happen?". Unlike \`bar\`, it takes a single list of raw labels that may **repeat**, and it tallies them itself: \`\`red\` appears twice, so its bar is 2.

This is the frequency question. You never write the counts — the chart counts the list. Watch the Plot tab: one bar per distinct value, its height the tally.`,
        learning: ['`countplot(labels)` tallies a raw list of repeating labels', 'Count the data, don\'t type the counts — the chart does it'],
        fieldNotes: ['seaborn: `sns.countplot(labels)`', 'countplot is the "frequency" question; bar is the "compare magnitudes" question'],
      },
      {
        id: 'plot-hist',
        eli: 'eli15',
        name: 'Histogram',
        brief: 'Build a list of raw numbers, then `hist(values)`. A histogram splits the numbers into bins and shows how many land in each — the shape of a distribution.',
        hint: 'hist(values) — one flat list of numbers; it auto-bins.',
        start: '',
        par: 2,
        difficulty: 3,
        goal: { type: 'plot', kind: 'hist' },
        solution: 'data = [2, 3, 3, 4, 5, 8, 9]\nhist(data)',
        lesson: `A **histogram** answers "how are the values spread out?". You hand it one flat list of raw numbers; it splits the range into bins and draws a bar for *how many* values fall in each bin. That silhouette is the **shape of the distribution** — a peak where values cluster, a tail where they thin out.

You pass raw values, not pre-made counts. The engine bins them, so the chart and the data always agree.`,
        learning: ['`hist(values)` auto-bins one list of raw numbers', 'A histogram shows the *shape* of a distribution, not individual points'],
        fieldNotes: ['matplotlib `plt.hist` / seaborn `sns.histplot`', 'The number of bins changes the picture — too few hides detail, too many is noise'],
      },
      {
        id: 'plot-pie',
        eli: 'eli15',
        name: 'Pie chart',
        brief: 'Build `parts = ["x", "y"]` and `vals = [70, 30]`, then `pie(parts, vals)`. A pie shows each part\'s share of the total.',
        hint: 'pie(labels, values) — same shape as bar, drawn as slices.',
        start: '',
        par: 3,
        difficulty: 3,
        goal: { type: 'plot', kind: 'pie' },
        solution: 'parts = ["x", "y"]\nvals = [70, 30]\npie(parts, vals)',
        lesson: `A **pie chart** answers "what share does each part have of the whole?". It uses the same two-list shape as \`bar\` (labels + values), but draws the values as **slices of a circle**, so the eye reads proportions of the total instead of magnitudes.

Use a pie when the values add up to something meaningful — parts of 100%, pieces of a budget. When the categories are just being compared, a bar is the more honest chart.`,
        learning: ['`pie(labels, values)` shows each part\'s share of the total', 'A pie is a ratio chart — reserve it for parts-of-a-whole'],
        fieldNotes: ['matplotlib: `plt.pie(vals, labels=parts)`', 'A pie with many tiny slices is a bar in disguise — switch to bar'],
      },
      {
        id: 'plot-area',
        eli: 'eli15',
        name: 'Area chart',
        brief: 'Build `xs` and `ys`, then `area(xs, ys)`. An area chart is a line with the region under it filled in — cumulative magnitude over an ordered axis.',
        hint: 'area(xs, ys) — like line(), but fills under the curve.',
        start: '',
        par: 3,
        difficulty: 3,
        goal: { type: 'plot', kind: 'area' },
        solution: 'xs = [1, 2, 3, 4]\nys = [1, 3, 6, 10]\narea(xs, ys)',
        lesson: `An **area chart** is a line with the region **filled in** beneath it. It is the same two aligned number lists as \`line\`, but the fill makes the *magnitude* of each point read at a glance — great when the y-values are cumulative or when you want to stress how much area has accumulated.

The x-axis must be ordered (time, an index); the fill is only meaningful over an ordered axis.`,
        learning: ['`area(xs, ys)` fills the region under a line', 'An area chart emphasizes the *magnitude* accumulating along an ordered axis'],
        fieldNotes: ['matplotlib: `plt.fill_between(xs, ys)`', 'Stacked area charts show several series summing to a total'],
      },
      {
        id: 'plot-boxplot',
        eli: 'eli20',
        name: 'Boxplot',
        brief: 'Build a list of numbers, then `boxplot(values)`. A boxplot compresses a whole distribution into a box (quartiles) with whiskers and outlier dots.',
        hint: 'boxplot(values) — one list of raw numbers; quartiles are computed.',
        start: '',
        par: 2,
        difficulty: 4,
        goal: { type: 'plot', kind: 'boxplot' },
        solution: 'v = [1, 2, 2, 3, 4, 4, 5, 20]\nboxplot(v)',
        lesson: `A **boxplot** answers "how is the data spread, and where are the outliers?" from one list of raw numbers. It computes the quartiles and draws: a **box** from the 25th to the 75th percentile, a line at the **median**, **whiskers** out to the most extreme in-range values, and a dot for each **outlier** beyond 1.5× the IQR.

That one box encodes the middle half of the data, its center, and the suspicious values at the edges — a compact alternative to a histogram when you care about spread and extremes.`,
        learning: ['`boxplot(values)` summarizes a distribution into quartiles + outliers', 'The box is the middle 50%, the line is the median, dots are outliers'],
        fieldNotes: ['matplotlib `plt.boxplot` / seaborn `sns.boxplot`', 'The classic use: several boxplots side by side to compare distributions'],
      },
      {
        id: 'plot-heatmap',
        eli: 'eli20',
        name: 'Heatmap',
        brief: 'Build `rows`, `cols`, and a `matrix` (a list of lists), then `heatmap(rows, cols, matrix)`. A heatmap colors a grid of values so high/low values pop.',
        hint: 'heatmap(rows, cols, matrix) — the matrix is a list of lists.',
        start: '',
        par: 4,
        difficulty: 4,
        goal: { type: 'plot', kind: 'heatmap' },
        solution: 'rows = ["A", "B"]\ncols = ["x", "y"]\nm = [[1, 2], [3, 4]]\nheatmap(rows, cols, m)',
        lesson: `A **heatmap** answers "where in this grid are the values high or low?". It is the one chart here that takes a **matrix** — a *list of lists*, one inner list per row — plus the row labels and the column labels. Each cell is shaded by its value, so peaks and valleys read instantly.

This is how correlation tables are drawn: rows and columns are the same set of features, and each cell is the correlation between a pair. A strong color = a strong relationship.`,
        learning: ['`heatmap(rows, cols, matrix)` shades a grid by value', 'The matrix is a list of lists — one inner list per row'],
        fieldNotes: ['matplotlib `plt.imshow` / seaborn `sns.heatmap`', 'Correlation heatmaps reuse the same features for rows and columns'],
      },
      {
        id: 'plot-regression',
        eli: 'eliphd',
        name: 'Regression line',
        brief: 'Build two aligned series `xs` and `ys`, then `reg(xs, ys)`. A regression fits the least-squares line through the scatter — the trend the dots follow.',
        hint: 'reg(xs, ys) — fits and draws the best-fit line.',
        start: '',
        par: 3,
        difficulty: 5,
        goal: { type: 'plot', kind: 'reg' },
        solution: 'xs = [1, 2, 3, 4]\nys = [2, 3.5, 5.5, 7]\nreg(xs, ys)',
        lesson: `A **regression** answers "is there a straight-line trend, and what is it?". \`reg(xs, ys)\` computes the **least-squares** slope and intercept in the engine and draws the fitted line through your scatter points — the line that minimizes the total squared distance to the dots.

This is the relationship question pushed one step past \`scatter\`: you don\'t just see that the points trend, you get the *equation* of the trend. The slope is the rate of change, the intercept is where the line crosses the axis.`,
        learning: ['`reg(xs, ys)` fits the least-squares line to a scatter', 'The slope is the trend\'s rate of change; the intercept its starting value'],
        fieldNotes: ['seaborn: `sns.regplot` / `sns.lmplot`', 'A line fit assumes a linear relationship — check the scatter first'],
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
