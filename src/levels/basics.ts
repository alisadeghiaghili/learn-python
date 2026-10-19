/**
 * Series: First Steps (basics).
 *
 * The true start of the course. A learner who has never written Python enters
 * here: print, a value, a name, a little math, and a string. No memory-model
 * jargon yet — the canvas is there, but the story is about the code first.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'basics',
    title: 'First Steps',
    levels: [
      {
        id: 'hello-world',
        eli: 'eli5',
        name: 'Hello, world',
        brief: 'Print the line `Hello, world!` — the first thing every Python program does.',
        hint: "print('Hello, world!')",
        start: '',
        par: 1,
        difficulty: 1,
        goal: { type: 'stdout', lines: ['Hello, world!'] },
        solution: "print('Hello, world!')",
        lesson: `Python reads your code from top to bottom, one line at a time.

\`print( ... )\` shows whatever is inside the parentheses. Wrap words in quotes — those quotes tell Python “this is text.” Press run and you’ll see your first line of output.

Everything in this course works this way: you write a line, run it, and watch what happens on the canvas and in the terminal.`,
        learning: ['A program is a list of lines Python runs in order', 'Text (words) is written inside quotes'],
        fieldNotes: ['`print` is the fastest way to check what your code is doing', 'Quotes make a string; without them Python thinks you mean a name'],
      },
      {
        id: 'first-variable',
        eli: 'eli5',
        name: 'Save a value',
        brief: 'Save the number 5 under the name `score` with `score = 5`.',
        hint: 'score = 5',
        start: '',
        par: 1,
        difficulty: 1,
        goal: { type: 'vars', vars: { score: { type: 'int', repr: '5' } } },
        solution: 'score = 5',
        lesson: `The \`=\` sign does not mean “equals” the way it does in math. It means **give this name a value**.

\`score = 5\` attaches the number 5 to the name \`score\`. From now on, anywhere you type \`score\`, Python uses the number 5. The name is a little label stuck on a value.`,
        learning: ['`=` saves a value under a name', 'Afterwards the name stands for that value'],
        fieldNotes: ['Names are usually lowercase: `score`, `total`, `count`', 'The label points at the value — change the value and the label still applies'],
      },
      {
        id: 'change-a-value',
        eli: 'eli5',
        name: 'Change a value',
        brief: 'Start with `age = 10`, then make `age` become 11.',
        hint: 'Write the name twice: first 10, then 11.',
        start: 'age = 10',
        par: 2,
        difficulty: 1,
        goal: { type: 'vars', vars: { age: { type: 'int', repr: '11' } } },
        solution: 'age = 10\nage = 11',
        lesson: `You can change what a name points to any time — just write the name again.

The first line gives \`age\` the value 10. The second line gives it 11. Now \`age\` means 11; the old value 10 is gone unless something else still points at it.

(We started you with \`age = 10\` so you could focus on the change. Try adding the second line yourself.)`,
        learning: ['Writing the same name again updates its value', 'A name always means its most recent value'],
        fieldNotes: ['Counters work this way: `n = 0` then `n = n + 1` over and over', 'The value is replaced, not “edited in place”'],
      },
      {
        id: 'do-math',
        eli: 'eli10',
        name: 'Do some math',
        brief: 'Multiply 6 by 7 and save the result as `area`.',
        hint: 'area = 6 * 7',
        start: '',
        par: 1,
        difficulty: 2,
        goal: { type: 'vars', vars: { area: { type: 'int', repr: '42' } } },
        solution: 'area = 6 * 7',
        lesson: `Python can compute. The symbols \`+\`, \`-\`, \`*\`, \`/\` are the usual addition, subtraction, multiplication, and division.

\`area = 6 * 7\` first does the math — 42 — and saves that under \`area\`. You can mix numbers and names: \`area = width * height\` works the same way.`,
        learning: ['Python evaluates expressions before saving them', 'Standard math symbols: + - * /'],
        fieldNotes: ['`//` is whole-number division, `**` is powers: `2 ** 3` is 8', 'A common task: compute a value, save it, reuse it'],
      },
      {
        id: 'build-up',
        eli: 'eli10',
        name: 'Build a value up',
        brief: 'Start with `x = 4`, then use `x` itself to make `x` become 7.',
        hint: 'Use the current x on the right: x = x + 3',
        start: 'x = 4',
        par: 2,
        difficulty: 2,
        goal: { type: 'vars', vars: { x: { type: 'int', repr: '7' } } },
        solution: 'x = 4\nx = x + 3',
        lesson: `Here is the trick that unlocks almost all of programming: a value can refer to *itself*.

\`x = x + 3\` reads the current \`x\` (4), adds 3, and saves the answer (7) back under \`x\`. Python reads the right side first, using the value \`x\` had *before* this line.

This “add a little each time” pattern is how counters, totals, and progress get built.`,
        learning: ['`x = x + 3` reads the old value before writing the new one', 'This self-update pattern is the heart of counting'],
        fieldNotes: ['`x += 3` is a shorthand that means exactly `x = x + 3`', 'You’ll see this in every loop in the next series'],
      },
      {
        id: 'your-name',
        eli: 'eli5',
        name: 'A word in a box',
        brief: 'Save the word `hi` (with quotes, so Python knows it’s text) in `greeting`.',
        hint: "greeting = 'hi'",
        start: '',
        par: 1,
        difficulty: 1,
        goal: { type: 'vars', vars: { greeting: { type: 'str', repr: "'hi'" } } },
        solution: "greeting = 'hi'",
        lesson: `Words, unlike numbers, must be written in quotes. That makes them a **string** — a piece of text Python can carry around like a value.

\`greeting = 'hi'\` saves the text \`hi\`. You can then print it, combine it with other text, or pass it to functions. Watch the canvas: the string gets its own box, and \`greeting\` points at it.`,
        learning: ['Strings are text wrapped in quotes', 'A name can point at a string, just like a number'],
        fieldNotes: ['Quotes can be single or double — both make the same string', 'Strings are one of the most-used values in all of Python'],
      },
      {
        id: 'combine-words',
        eli: 'eli10',
        name: 'Join two words',
        brief: 'Build the string `hello world` from two pieces, `hello` and `world`.',
        hint: "Use + to glue: 'hello' + ' ' + 'world'",
        start: '',
        par: 1,
        difficulty: 2,
        goal: { type: 'vars', vars: { msg: { type: 'str', repr: "'hello world'" } } },
        solution: "msg = 'hello' + ' ' + 'world'",
        lesson: `Just like \`+\` adds numbers, it can **glue strings** together. This is called concatenation.

\`'hello' + ' ' + 'world'\` joins three pieces — remember the middle one is a single space — into \`hello world\`. That’s how programs build messages, file names, and text out of parts.`,
        learning: ['`+` joins strings together (concatenation)', 'A string is just one long sequence of characters'],
        fieldNotes: ["Forgetting a space is the classic bug: `'hello' + 'world'` is `helloworld`", 'You can also glue a name into a word with `+`'],
      },
      {
        id: 'how-long',
        eli: 'eli10',
        name: 'How long is it?',
        brief: 'Save the number of letters in the word `python` as `n`. Use the `len` function.',
        hint: "n = len('python')",
        start: '',
        par: 1,
        difficulty: 2,
        goal: { type: 'vars', vars: { n: { type: 'int', repr: '6' } } },
        solution: "n = len('python')",
        lesson: `Python ships with useful **functions** already built in. \`len(...)\` counts how many items something holds.

\`len('python')\` counts the letters and gives 6, which we save as \`n\`. Later you’ll use \`len\` on lists too — it answers “how many?” for a lot of things.`,
        learning: ['`len` counts the items in a string (or list)', 'Built-in functions let you do common things in one line'],
        fieldNotes: ['`len` works on strings, lists, and other collections', 'Counting items is one of the most frequent needs in code'],
      },
    ],
  },
];
