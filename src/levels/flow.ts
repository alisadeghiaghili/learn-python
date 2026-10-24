/**
 * Series: Decisions (flow).
 *
 * Booleans, comparisons, and `if/elif/else`. This is where the program starts
 * to *choose*: it looks at a condition and runs different lines depending on
 * the answer. Still no memory jargon — the focus is the branch itself.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'flow',
    title: 'Decisions',
    levels: [
      {
        id: 'true-or-false',
        eli: 'eli10',
        name: 'True or False',
        brief: 'There are two values that are just “yes” and “no”: `True` and `False`. Save the value `True` in `ready`.',
        hint: 'ready = True',
        start: '',
        par: 1,
        difficulty: 2,
        goal: { type: 'vars', vars: { ready: { type: 'bool', repr: 'True' } } },
        solution: 'ready = True',
        lesson: `Before a program can make a decision, it needs yes/no values. Python calls them **booleans**, and there are exactly two: \`True\` and \`False\` (capital first letter).

\`ready = True\` saves the “yes” value. These values are what conditions produce — a question that can only be answered yes or no.`,
        learning: ['Booleans are the two values True and False', 'They are the answers to yes/no questions'],
        fieldNotes: ['Capital `T`/`F` matter — `true`/`false` (lowercase) are not the same', 'Conditions (next) produce booleans'],
      },
      {
        id: 'is-equal',
        eli: 'eli10',
        name: 'Ask if equal',
        brief: 'Compare two numbers. Is 3 equal to 3? Save the answer in `same`.',
        hint: 'same = 3 == 3',
        start: '',
        par: 1,
        difficulty: 2,
        goal: { type: 'vars', vars: { same: { type: 'bool', repr: 'True' } } },
        solution: 'same = 3 == 3',
        lesson: `Here is where \`=\` and \`==\` are *not* the same:

- \`=\` **saves** a value (\`x = 5\`).
- \`==\` **asks** a question: “is the left equal to the right?”

\`3 == 3\` asks the question and answers \`True\`. We save that answer in \`same\`. Compare 5 and 3 and you’d get \`False\`.`,
        learning: ['`==` asks “are these equal?” and returns True/False', 'One `=` saves; two `==` compares'],
        fieldNotes: ['`!=` means “not equal”', 'Other comparisons: `<`, `>`, `<=`, `>=`'],
      },
      {
        id: 'is-bigger',
        eli: 'eli10',
        name: 'Bigger or smaller',
        brief: 'Ask whether 10 is greater than 7. Save the answer in `bigger`. (It should be True.)',
        hint: 'bigger = 10 > 7',
        start: '',
        par: 1,
        difficulty: 2,
        goal: { type: 'vars', vars: { bigger: { type: 'bool', repr: 'True' } } },
        solution: 'bigger = 10 > 7',
        lesson: `Besides \`==\`, there are comparisons for size:

- \`>\`  “greater than”
- \`<\`  “less than”
- \`>=\` “at least” (greater or equal)
- \`<=\` “at most” (less or equal)

Each one asks a yes/no question and answers \`True\` or \`False\`. \`10 > 7\` is \`True\`.`,
        learning: ['Comparisons return a boolean, not a number', '>, <, >=, <= compare size'],
        fieldNotes: ['Comparisons chain the way you’d say it: `0 < x < 10` is not supported here, but `x > 0 and x < 10` works'],
      },
      {
        id: 'first-if',
        eli: 'eli10',
        name: 'Your first if',
        brief: 'With `score = 85` already saved, print `good job` only if the score is 60 or higher. (Here it is, so print it.)',
        hint: 'if score >= 60:\n    print("good job")',
        start: 'score = 85',
        par: 2,
        difficulty: 2,
        goal: { type: 'stdout', lines: ['good job'] },
        solution: 'if score >= 60:\n    print("good job")',
        lesson: `Now the program can *choose*. The \`if\` line ends with a colon, and the **indented** lines below it only run if the test is true.

\`if score >= 60:\` asks “is the score 60 or more?” Here the score is 85, so the indented \`print\` runs. If the score were 40, the same code would print nothing.

The indentation (the leading spaces) is what tells Python which lines belong to the \`if\`.`,
        learning: ['`if <test>:` runs the indented block only when the test is True', 'Indentation defines the block'],
        fieldNotes: ['The test after `if` is a boolean', 'Change the score to below 60 and the print silently does not run'],
      },
      {
        id: 'if-else',
        eli: 'eli10',
        name: 'If … else',
        brief: 'With `score = 40` saved, print `good job` if the score is 60 or higher, otherwise print `keep going`.',
        hint: 'Add an else: block for the other case.',
        start: 'score = 40',
        par: 4,
        difficulty: 2,
        goal: { type: 'stdout', lines: ['keep going'] },
        solution: 'if score >= 60:\n    print("good job")\nelse:\n    print("keep going")',
        lesson: `Sometimes you want to handle *both* outcomes. Add \`else:\` after the \`if\` block.

The rule is clean: exactly one of the two blocks runs. If the test is true, run the \`if\` block; if it’s false, run the \`else\` block. Never both, never neither.

Here the score is 40, so the test fails and the \`else\` block prints \`keep going\`.`,
        learning: ['`else:` runs when the `if` test is False', 'Exactly one of `if`/`else` runs'],
        fieldNotes: ['This if/else shape is the backbone of most program logic', 'Both branches keep their indentation rules'],
      },
      {
        id: 'elif-ladder',
        eli: 'eli15',
        name: 'Picking with elif',
        brief: 'Grade a `score` of 72: print `A` if it is 90 or higher, `B` if it is 70 or higher, otherwise `C`.',
        hint: 'Use if / elif / else, each with its own block.',
        start: 'score = 72',
        par: 6,
        difficulty: 3,
        goal: { type: 'stdout', lines: ['B'] },
        solution:
          'if score >= 90:\n    print("A")\n' +
          'elif score >= 70:\n    print("B")\n' +
          'else:\n    print("C")',
        lesson: `When there are more than two outcomes, line up \`elif\` (short for “else if”) steps.

Python checks each test **top to bottom** and runs the first one that’s true, then stops. Here 72 is not 90+, but it is 70+, so the \`elif\` block runs and prints \`B\`. The \`else\` is the catch-all if nothing above matched.

The order matters: checks run in the order written.`,
        learning: ['`elif` adds more branches to an if/else', 'The first true branch runs; the rest are skipped'],
        fieldNotes: ['A common bug: ordering branches so a broader test hides a narrower one', '`else` is optional — omit it when “no match” means “do nothing”'],
      },
      {
        id: 'and-or',
        eli: 'eli15',
        name: 'And, or, not',
        brief: 'You can combine questions. Save `in_range` as True only if `age` is 18 or more AND `age` is under 65.',
        hint: 'age = 40; in_range = age >= 18 and age < 65',
        start: 'age = 40',
        par: 2,
        difficulty: 3,
        goal: { type: 'vars', vars: { in_range: { type: 'bool', repr: 'True' } } },
        solution: 'age = 40\nin_range = age >= 18 and age < 65',
        lesson: `Three words let you combine booleans into one bigger question:

- \`and\`  — both must be true
- \`or\`   — at least one must be true
- \`not\`  — flips true into false and back

\`age >= 18 and age < 65\` is true only if *both* halves are true. For age 40, both are true, so the whole thing is \`True\`.`,
        learning: ['`and` needs both sides true', '`or` needs at least one side true', '`not` flips a boolean'],
        fieldNotes: ['Combine as many conditions as you like: `a and b and c`', 'Read them as you would in English — that is the point'],
      },
      {
        id: 'membership',
        eli: 'eli15',
        name: 'Is it in there?',
        brief: 'Ask whether the letter `a` is inside the word `apple`. Save the answer in `found`.',
        hint: "found = 'a' in 'apple'",
        start: '',
        par: 1,
        difficulty: 3,
        goal: { type: 'vars', vars: { found: { type: 'bool', repr: 'True' } } },
        solution: "found = 'a' in 'apple'",
        lesson: `The word \`in\` asks a membership question: is the thing on the left inside the thing on the right?

\`'a' in 'apple'\` asks whether the letter \`a\` appears in the word \`apple\` — yes, so the answer is \`True\`. Change the letter to \`z\` and it becomes \`False\`.

You’ll also use \`in\` on lists in a later series, the same way.`,
        learning: ['`x in s` asks whether `x` appears inside `s`', '`in` returns True/False'],
        fieldNotes: ['`not in` asks the opposite: `if z not in apple`', 'Membership is how you check a value against a collection'],
      },
    ],
  },
];
