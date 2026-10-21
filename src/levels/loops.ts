/**
 * Series: Repeating (loops).
 *
 * `for` + `range`, `while`, and a loop that builds a value. The final level is
 * the "watch the loop" level: it relies on the engine's step-recording trace
 * so the learner can scrub each iteration on the canvas.
 */

import { preds } from '../engine/checks';
import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'loops',
    title: 'Repeating',
    levels: [
      {
        id: 'count-with-range',
        eli: 'eli10',
        name: 'Count with a loop',
        brief: 'Use a `for` loop over `range(3)` to add each number to `total`, starting from 0. (0 + 1 + 2.)',
        hint: 'total = 0\nfor i in range(3):\n    total = total + i',
        start: 'total = 0',
        par: 3,
        difficulty: 2,
        goal: { type: 'vars', vars: { total: { type: 'int', repr: '3' } } },
        solution: 'total = 0\nfor i in range(3):\n    total = total + i',
        lesson: `A \`for\` loop repeats its indented block one time per item. \`range(3)\` gives the numbers 0, 1, 2.

So the block runs three times, with \`i\` being 0, then 1, then 2, each time adding it to \`total\`. At the end \`total\` is 0 + 1 + 2 = 3.

\`range\` is the loop’s partner: \`range(3)\` counts up starting at 0 and stops before 3.`,
        learning: ['`for x in range(n):` repeats `n` times, with `x` = 0..n-1', 'The indented block runs once per item'],
        fieldNotes: ['`range` always starts at 0 unless told otherwise', 'This is the most common loop in Python'],
      },
      {
        id: 'range-start-stop',
        eli: 'eli10',
        name: 'A range with a start',
        brief: 'Add up 3 + 4 + 5 + 6 + 7 using a loop. Save the result in `sum5`.',
        hint: 'sum5 = 0\nfor i in range(3, 8):\n    sum5 = sum5 + i',
        start: 'sum5 = 0',
        par: 3,
        difficulty: 2,
        goal: { type: 'vars', vars: { sum5: { type: 'int', repr: '25' } } },
        solution: 'sum5 = 0\nfor i in range(3, 8):\n    sum5 = sum5 + i',
        lesson: `\`range\` can take two numbers: a **start** and a **stop** (one past the last).

\`range(3, 8)\` gives 3, 4, 5, 6, 7 — starting at 3, stopping before 8. Adding them: 3 + 4 + 5 + 6 + 7 = 25.

Remember: the stop value is *not* included. That “start here, stop before there” rule is the single most useful thing to internalize about \`range\`.`,
        learning: ['`range(start, stop)` counts from `start` up to but not including `stop`', 'The stop value is never produced'],
        fieldNotes: ['A third number is the step: `range(0, 10, 2)` is 0, 2, 4, 6, 8', 'Forgetting that stop is excluded is the #1 range mistake'],
      },
      {
        id: 'loop-a-string',
        eli: 'eli10',
        name: 'Loop over a word',
        brief: 'Count how many letters are in `python` using a loop. Save the count in `count`.',
        hint: 'count = 0\nfor ch in word:\n    count = count + 1',
        start: "word = 'python'",
        par: 4,
        difficulty: 2,
        goal: { type: 'vars', vars: { count: { type: 'int', repr: '6' } } },
        solution: "word = 'python'\ncount = 0\nfor ch in word:\n    count = count + 1",
        lesson: `A \`for\` loop works on **any** collection — not just ranges. A string is just a collection of letters.

\`for ch in word:\` runs once per letter, with \`ch\` being each single character in turn. Each time we bump \`count\` by 1. After the last letter, \`count\` is 6.

This “loop and count” pattern works exactly the same on lists.`,
        learning: ['`for` can walk through a string one letter at a time', 'Loop-and-count is a universal pattern'],
        fieldNotes: ['The loop variable (`ch`) takes a new value each time', 'The same loop counts items in a list too'],
      },
      {
        id: 'while-loop',
        eli: 'eli15',
        name: 'Loop until done',
        brief: 'Use a `while` loop to keep doubling `n` (start at 1) until it is at least 8. Save the final value in `n`.',
        hint: 'n = 1\nwhile n < 8:\n    n = n * 2',
        start: 'n = 1',
        par: 3,
        difficulty: 3,
        goal: { type: 'vars', vars: { n: { type: 'int', repr: '8' } } },
        solution: 'n = 1\nwhile n < 8:\n    n = n * 2',
        lesson: `A \`while\` loop is the other kind of loop. Instead of “repeat for each item,” it says “**repeat while this is true**.”

Here: while \`n\` is below 8, double it. 1 → 2 → 4 → 8. Now 8 is not below 8, so the loop stops, and \`n\` is 8.

Use \`for\` when you know how many times; use \`while\` when you’re repeating until a condition changes.`,
        learning: ['`while <test>:` repeats as long as the test stays True', 'Use `while` when the number of repeats is not known up front'],
        fieldNotes: ['Always make the test eventually become False — a `while True` with no exit runs forever', '`while` is ideal for “wait until…” logic'],
      },
      {
        id: 'loop-with-if',
        eli: 'eli15',
        name: 'Loop plus a decision',
        brief: 'Print every even number from 0 to 5. (Use a `for` loop and an `if` inside it.)',
        hint: 'for i in range(6):\n    if i % 2 == 0:\n        print(i)',
        start: '',
        par: 4,
        difficulty: 3,
        goal: { type: 'stdout', lines: ['0', '2', '4'] },
        solution: 'for i in range(6):\n    if i % 2 == 0:\n        print(i)',
        lesson: `Loops and \`if\` combine all the time. Here the loop visits 0, 1, 2, 3, 4, 5, and the \`if\` inside it prints a number only when it is even.

The \`%\` sign is the **remainder**: \`i % 2\` is the leftover when you divide by 2. A number is even exactly when \`i % 2 == 0\`.

So the loop *does* every number, but only *prints* the even ones: 0, 2, 4.`,
        learning: ['You can nest an `if` inside a `for` loop', '`%` gives the remainder; `x % 2 == 0` tests for even'],
        fieldNotes: ['Filter-while-looping is everywhere: skip the ones you don’t want', '`%` (modulo) is the workhorse for “every nth item”'],
      },
      {
        id: 'break-out',
        eli: 'eli15',
        name: 'Stop early with break',
        brief: 'Search the numbers 1 to 9 for the first one divisible by 7. Print it, then `break` out of the loop. (It is 7.)',
        hint: 'for i in range(1, 10):\n    if i % 7 == 0:\n        print(i)\n        break',
        start: '',
        par: 4,
        difficulty: 3,
        goal: { type: 'stdout', lines: ['7'] },
        solution: 'for i in range(1, 10):\n    if i % 7 == 0:\n        print(i)\n        break',
        lesson: `Sometimes you want to stop a loop *early*, before it runs out of items. That’s what \`break\` does: it jumps straight out of the loop.

This loop walks 1, 2, 3, … . At each number it asks “is this divisible by 7?” Most are not, so nothing happens. At 7 the test is true, it prints 7, and \`break\` ends the loop right there — 8 and 9 are never visited.

\`range(1, 10)\` starts at 1 so we don’t stop on 0 (which is also divisible by 7).`,
        learning: ['`break` exits the innermost loop immediately', 'Use it once you’ve found what you’re looking for'],
        fieldNotes: ['`break` stops the whole loop, not just one iteration', 'Paired with a search: find the match, then break'],
      },
      {
        id: 'watch-the-loop',
        eli: 'eli15',
        name: 'Watch the loop run',
        brief: 'Build the list `[1, 4, 9]` — the squares of 1, 2, 3 — using a `for` loop. Then press the step controls to watch each iteration on the canvas.',
        hint: 'sq = []\nfor i in range(1, 4):\n    sq = sq + [i * i]',
        start: 'sq = []',
        par: 3,
        difficulty: 3,
        goal: {
          type: 'predicates',
          predicates: [preds.hasRepr('sq', '[1, 4, 9]')],
        },
        solution: 'sq = []\nfor i in range(1, 4):\n    sq = sq + [i * i]',
        lesson: `Now you’ve met every loop tool. This level is a chance to *see* one run step by step.

The loop squares each number 1, 2, 3 and grows the list \`sq\`: it becomes \`[1]\`, then \`[1, 4]\`, then \`[1, 4, 9]\`.

When you submit, use the step controls under the canvas to scrub through the run. Each press advances one statement, and you can watch \`sq\` grow and the loop variable change on the canvas. That picture — “the loop is just the same line, run again and again” — is the whole idea of a loop.`,
        learning: ['A loop is one block of code repeated, not new code each time', 'You can watch any loop run step by step on the canvas'],
        fieldNotes: ['Building a list in a loop is how you transform data', 'Use the step controls to inspect any level’s execution'],
      },
    ],
  },
];
