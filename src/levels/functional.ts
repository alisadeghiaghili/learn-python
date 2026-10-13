/**
 * Series: Defaults & Functional.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'functional',
    title: 'Defaults & Functional',
    levels: [
      {
        id: 'defaultdict-basic',
        eli: 'eli10',
        name: 'A dict that invents its defaults',
        brief: 'With `d` a `defaultdict(int)`, read a key that does not exist yet. A plain dict would raise `KeyError`; here `n` should come back as `0` — and the key is now stored.',
        hint: "import collections as c, then d = c.defaultdict(int), then n = d['missing']",
        start: 'import collections as c',
        par: 2,
        difficulty: 2,
        goal: {
          type: 'predicates',
          predicates: [
            preds.hasRepr('n', '0'),
            preds.isDefaultDict('d'),
            preds.hasRepr('d', "{'missing': 0}"),
          ],
        },
        solution: "d = c.defaultdict(int)\nn = d['missing']",
        lesson: `A **defaultdict** is a dict that knows how to invent a missing value. \`defaultdict(int)\` says "when I miss, hand back what \`int()\` would produce" — and \`int()\` is \`0\`.

Reading \`d['missing']\` does two things at once: it returns \`0\` **and** stores that \`0\` under the key (watch the box grow from empty to \`{'missing': 0}\`). With a plain dict the same read would crash with \`KeyError\`. The \`⚙ default: int()\` tag on the box is the factory that made this possible.`,
        learning: ['A defaultdict fills missing keys from a default factory', 'A missing-key read both returns the default AND stores it'],
        fieldNotes: ['`defaultdict(int)` is the idiomatic way to count things: `counts[word] += 1`', 'Unlike `.get()`, the auto-created value persists in the dict'],
      },
      {
        id: 'defaultdict-list',
        eli: 'eli15',
        name: 'Auto-default to a fresh list',
        brief: 'Use `d = c.defaultdict(list)` and read `d["nums"]`. A plain int factory would hand back a number — here the factory builds a brand-new empty list, a fresh heap box.',
        hint: "d = c.defaultdict(list), then xs = d['nums']",
        start: 'import collections as c',
        par: 2,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [
            preds.hasType('xs', 'list'),
            preds.hasRepr('xs', '[]'),
            preds.isDefaultDict('d'),
          ],
        },
        solution: "d = c.defaultdict(list)\nxs = d['nums']",
        lesson: `The factory is any callable. \`defaultdict(list)\` says "when I miss, hand back a fresh \`list()\`." So \`xs = d['nums']\` mints a **new empty list** on the heap and stores it under \`"nums"\` — watch a new teal \`list\` box appear and get wired into the dict.

This is the workhorse pattern for **grouping**: \`by_category[name].append(item)\` works even the first time a name appears, because a missing name auto-creates an empty list to append to. No \`if name not in by_category\` boilerplate.`,
        learning: ['The default factory can build containers, not just numbers', 'Grouping: `groups[key].append(x)` auto-creates the list on first use'],
        fieldNotes: ['`defaultdict(list)` + `.append()` replaces explicit `if key in d` checks', 'Each missing key gets its own *fresh* list — they are not shared'],
      },
      {
        id: 'map-lazy',
        eli: 'eli15',
        name: 'map: a lazy transform',
        brief: 'With `xs = [\'1\', \'2\']`, build `ms = map(int, xs)`, then pull the first result off with `next(ms)`. `ms` is not a list — it is a *lazy iterator* that remembers both the source and the function it applies.',
        hint: 'ms = map(int, xs), then a = next(ms)',
        start: "xs = ['1', '2']",
        par: 2,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [
            preds.hasType('ms', 'mapiter'),
            preds.hasRepr('a', '1'),
          ],
        },
        solution: 'ms = map(int, xs)\na = next(ms)',
        lesson: `\`map(int, xs)\` does **not** build a list. It returns a **map iterator** — one heap object that carries two references (watch the two amber edges): the *source* it walks and the *function* \`int\` it applies to each element.

Call \`next(ms)\` and it pulls one raw element from the source, runs \`int\` on it, and hands back the result: \`'1' → 1\`. Nothing else is computed yet — \`map\` is **lazy**, transforming one element at a time on demand, exactly like the iterators from the last series but with a function bolted on.`,
        learning: ['`map(fn, it)` returns a lazy iterator, not a list', 'The map object holds both the source and the function it applies'],
        fieldNotes: ['`list(map(fn, it))` is the eager form you see most in real code', 'A map/filter chains cleanly: each one is just another iterator object'],
      },
      {
        id: 'filter-truthy',
        eli: 'eli15',
        name: 'filter: keep what is truthy',
        brief: 'With `xs = [0, 1, 2, 3]`, build `fs = filter(bool, xs)` and pull the first result. `0` is falsy, so the filter **skips it** and hands back `1`.',
        hint: 'fs = filter(bool, xs), then a = next(fs)',
        start: 'xs = [0, 1, 2, 3]',
        par: 2,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [
            preds.hasType('fs', 'filteriter'),
            preds.hasRepr('a', '1'),
          ],
        },
        solution: 'fs = filter(bool, xs)\na = next(fs)',
        lesson: `\`filter\` is \`map\`'s sibling. Instead of *transforming* each element, it **tests** each one and drops the ones that fail. \`filter(bool, xs)\` keeps only the elements whose truth value is true — so \`0\` (falsy) is quietly skipped and the first value that survives is \`1\`.

Like \`map\`, the result is a **lazy iterator** on the heap. It draws from the source one element at a time, and the "apply a function" edge here carries the *predicate* (\`bool\`) rather than a transformer. \`map\` reshapes values; \`filter\` discards them.`,
        learning: ['`filter(pred, it)` yields only the elements that pass the predicate', 'Falsy values (0, empty, None) are dropped by `filter(bool, ...)`'],
        fieldNotes: ['`filter(None, it)` drops falsy items without naming a function', '`map` and `filter` both return iterators, so they chain lazily'],
      },
    ],
  },
];
