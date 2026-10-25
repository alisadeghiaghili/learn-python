/**
 * Series: Regular Expressions (re).
 *
 * Runs in the Pyodide lane with 100% CPython standard library fidelity.
 * Explores patterns, searches, match groups, substitutions, and regex compilation.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'regex',
    title: 'Regular Expressions',
    levels: [
      {
        id: 're-match-literal',
        eli: 'eli5',
        name: 'Compile and search',
        brief: 'Compile a regex pattern for digits and search the text: `import re; p = re.compile(r"\\d+"); m = p.search("item 42")`.',
        hint: 'import re\np = re.compile(r"\\d+")\nm = p.search("item 42")',
        start: '',
        par: 3,
        difficulty: 1,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { m: { type: 'Match' } } },
        solution: 'import re\np = re.compile(r"\\d+")\nm = p.search("item 42")',
        lesson: `The \`re\` module provides full regular expression support. \`re.compile()\` compiles a regex pattern into a reusable \`Pattern\` object on the heap.

**Look at the Memory Board:**
Notice that \`p\` references a \`Pattern\` object, and \`m\` references a \`Match\` object containing the matched span and text.`,
        learning: [
          're.compile() compiles regex strings into Pattern objects',
          'pattern.search() scans through a string for the first match',
        ],
        fieldNotes: [
          'Always use raw strings r"..." for regexes to avoid Python escape sequence confusion',
          'Compiling patterns once is an important optimization in high-throughput services',
        ],
      },
      {
        id: 're-search-digits',
        eli: 'eli10',
        name: 'Find all occurrences',
        brief: 'Extract all numbers from text using `re.findall`: `numbers = re.findall(r"\\d+", "10 cats and 20 dogs")`.',
        hint: 'import re\nnumbers = re.findall(r"\\d+", "10 cats and 20 dogs")',
        start: '',
        par: 2,
        difficulty: 2,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { numbers: { type: 'list', repr: "['10', '20']" } } },
        solution: 'import re\nnumbers = re.findall(r"\\d+", "10 cats and 20 dogs")',
        lesson: `\`re.findall(pattern, string)\` returns all non-overlapping matches of the pattern as a list of strings.

**Look at the Memory Board:**
A new list containing \`'10'\` and \`'20'\` is allocated on the heap. If the pattern has no matches, it returns an empty list.`,
        learning: [
          're.findall() returns a list of all matching string segments',
          'Character class \\d matches any Unicode decimal digit',
        ],
        fieldNotes: [
          're.finditer() returns an iterator yielding Match objects lazily for large documents',
          'Use + for one or more occurrences and * for zero or more',
        ],
      },
      {
        id: 're-capture-groups',
        eli: 'eli15',
        name: 'Capture groups',
        brief: 'Match an email address with capture groups `(\\w+)@(\\w+\\.\\w+)` and extract the username `user = m.group(1)`.',
        hint: 'import re\nm = re.search(r"(\\w+)@(\\w+\\.\\w+)", "contact alice@example.com today")\nuser = m.group(1)',
        start: '',
        par: 3,
        difficulty: 3,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { user: { type: 'str', repr: "'alice'" } } },
        solution: 'import re\nm = re.search(r"(\\w+)@(\\w+\\.\\w+)", "contact alice@example.com today")\nuser = m.group(1)',
        lesson: `Parentheses \`(...)\` in regular expressions define **capturing groups**.
- \`m.group(0)\`: The entire matched substring
- \`m.group(1)\`: The first parenthesized group
- \`m.group(2)\`: The second parenthesized group

**Look at the Memory Board:**
\`user\` is extracted and bound directly to the string \`'alice'\`.`,
        learning: [
          'Parentheses define capture groups indexed from 1',
          'Match.group(1) retrieves the text captured by the first group',
        ],
        fieldNotes: [
          'Named capture groups (?P<name>...) make regexes self-documenting',
          'Match.groups() returns a tuple of all captured groups',
        ],
      },
      {
        id: 're-sub-replace',
        eli: 'eli20',
        name: 'Regex substitution',
        brief: 'Replace multiple spaces with a single hyphen using `re.sub`: `clean = re.sub(r"\\s+", "-", "hello   world  test")`.',
        hint: 'import re\nclean = re.sub(r"\\s+", "-", "hello   world  test")',
        start: '',
        par: 2,
        difficulty: 4,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { clean: { type: 'str', repr: "'hello-world-test'" } } },
        solution: 'import re\nclean = re.sub(r"\\s+", "-", "hello   world  test")',
        lesson: `\`re.sub(pattern, replacement, string)\` replaces all occurrences of \`pattern\` in \`string\` with \`replacement\`.

**Look at the Memory Board:**
A new string \`'hello-world-test'\` is allocated. The original input string is immutable and remains completely unmodified.`,
        learning: [
          're.sub() performs string search-and-replace using regular expressions',
          'Character class \\s matches whitespace (spaces, tabs, newlines)',
        ],
        fieldNotes: [
          'The replacement argument can be a callback function (def repl(match): ...)',
          're.subn() returns a tuple of (new_string, number_of_subs_made)',
        ],
      },
      {
        id: 're-flags-multiline',
        eli: 'eliphd',
        name: 'Regex flags and multiline anchors',
        brief: 'Extract line-starting words using `re.MULTILINE`: `words = re.findall(r"^\\w+", "first line\\nsecond line", re.MULTILINE)`.',
        hint: 'import re\nwords = re.findall(r"^\\w+", "first line\\nsecond line", re.MULTILINE)',
        start: '',
        par: 3,
        difficulty: 5,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { words: { type: 'list', repr: "['first', 'second']" } } },
        solution: 'import re\nwords = re.findall(r"^\\w+", "first line\\nsecond line", re.MULTILINE)',
        lesson: `Regex flags modify pattern matching semantics:
- \`re.IGNORECASE\` (\`re.I\`): Case-insensitive matching
- \`re.MULTILINE\` (\`re.M\`): Changes \`^\` and \`$\` to match at the beginning/end of each line, not just the string boundaries
- \`re.DOTALL\` (\`re.S\`): Makes the \`.\` special character match newlines as well`,
        learning: [
          'Regex flags alter pattern matching behavior across lines and case',
          're.MULTILINE matches anchors ^ and $ at newline boundaries',
        ],
        fieldNotes: [
          'Combine flags using bitwise OR: re.I | re.M',
          'Inline flags (?im) can also be placed at the start of regex patterns',
        ],
      },
    ],
    deepLesson: `## Beginner: Introduction to Regular Expressions
Regular expressions provide a domain-specific language for matching text patterns:
\`\`\`python
import re
pattern = re.compile(r"\\d+")
match = pattern.search("Customer ID: 48291")
print(match.group())  # '48291'
\`\`\`
Always compile patterns with raw strings (\`r"..."\`) to ensure backslashes are passed directly to the regex engine rather than interpreted as Python string escapes.

## Intermediate: Extraction and Groups
Capture groups isolate specific fragments from complex text:
\`\`\`python
m = re.search(r"(\\w+)\\s*=\\s*(\\d+)", "port = 8080")
key, val = m.groups()  # ('port', '8080')
\`\`\`
Named groups improve readability in maintainable codebases:
\`\`\`python
m = re.search(r"(?P<key>\\w+)=(?P<val>\\d+)", "port=8080")
print(m.group("key"))  # 'port'
\`\`\`

## Advanced: Text Transformations with Callbacks
\`re.sub\` can accept a callable function as the replacement parameter:
\`\`\`python
def uppercase_tag(match):
    return match.group(1).upper()

res = re.sub(r"<(\\w+)>", uppercase_tag, "<div><span>")
# '<DIV><SPAN>'
\`\`\`

## Expert: Engine Architecture and Performance
CPython's \`re\` module uses a backtrack-based NFA engine.
- **Catastrophic Backtracking:** Nested quantifiers like \`(a+)+$\` matched against non-matching strings cause exponential execution slowdowns.
- **Precompilation:** In loops, always precompile patterns via \`re.compile()\` outside the loop; CPython caches up to 512 regex strings, but compiled objects avoid repeated cache lookups.`,
  },
];
