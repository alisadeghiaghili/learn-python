/**
 * Series: Docstrings & Documentation Standards.
 *
 * Explores PEP 257 docstring conventions, runtime __doc__ introspection,
 * Google and NumPy formatting styles, and executable doctests.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'docstrings',
    title: 'Docstrings & Standards',
    levels: [
      {
        id: 'docstring-pep257',
        eli: 'eli5',
        name: 'PEP 257 one-line docstrings',
        brief: 'Define a function `add` with a triple-quoted one-line docstring: `def add(a, b): """Add two numbers.""" return a + b`. Call `res = add(2, 3)`.',
        hint: 'def add(a, b):\n    """Add two numbers."""\n    return a + b\nres = add(2, 3)',
        start: '',
        par: 4,
        difficulty: 1,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { res: { type: 'int', repr: '5' } } },
        solution: 'def add(a, b):\n    """Add two numbers."""\n    return a + b\nres = add(2, 3)',
        lesson: `A **docstring** is a string literal that occurs as the very first statement in a module, function, class, or method definition.

Per **PEP 257**, triple quotes (\`"""...\`\`) should always be used. A one-line docstring should fit on one line, with closing quotes on the same line.`,
        learning: [
          'A docstring is the first statement in a function, class, or module',
          'PEP 257 defines standard Python docstring conventions',
        ],
        fieldNotes: [
          'Unlike regular comments (#), docstrings are retained in compiled bytecode',
          'IDEs display docstrings automatically in tooltips during development',
        ],
      },
      {
        id: 'docstring-access',
        eli: 'eli10',
        name: 'Runtime introspection via __doc__',
        brief: 'Extract the docstring from `calculate` and bind to `doc = calculate.__doc__`.',
        hint: 'doc = calculate.__doc__',
        start: 'def calculate(x):\n    """Compute square of x."""\n    return x * x',
        par: 1,
        difficulty: 2,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { doc: { type: 'str', repr: "'Compute square of x.'" } } },
        solution: 'doc = calculate.__doc__',
        lesson: `Because docstrings are first-class language constructs, Python automatically assigns them to the object's \`__doc__\` attribute on the heap.

**Look at the Memory Board:**
\`calculate.__doc__\` is an actual string object on the heap that can be read, passed, or checked programmatically. This is how the built-in \`help()\` function works.`,
        learning: [
          'Python binds docstrings to the __doc__ attribute of functions and classes',
          'help(obj) formats and displays __doc__ directly in the terminal',
        ],
        fieldNotes: [
          'Automated documentation generators (Sphinx, MkDocs) read __doc__ via reflection',
          'Passing python -OO strips docstrings from bytecode to minimize memory in embedded systems',
        ],
      },
      {
        id: 'docstring-google-style',
        eli: 'eli15',
        name: 'Google style docstrings',
        brief: 'Define a function with a Google-style docstring containing `Args:` and `Returns:`. Calculate `ans = multiply(3, 4)`.',
        hint: 'def multiply(a, b):\n    """Multiply two integers.\n\n    Args:\n        a: First number.\n        b: Second number.\n\n    Returns:\n        Product of a and b.\n    """\n    return a * b\nans = multiply(3, 4)',
        start: '',
        par: 10,
        difficulty: 3,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { ans: { type: 'int', repr: '12' } } },
        solution: 'def multiply(a, b):\n    """Multiply two integers.\n\n    Args:\n        a: First number.\n        b: Second number.\n\n    Returns:\n        Product of a and b.\n    """\n    return a * b\nans = multiply(3, 4)',
        lesson: `The **Google Python Style Guide** docstring format is clean, compact, and human-readable. It organizes information into standard sections:
- \`Args:\`: Parameter names and descriptions
- \`Returns:\`: Return type and explanation
- \`Raises:\`: Documented exceptions`,
        learning: [
          'Google style docstrings use clear section headers (Args, Returns, Raises)',
          'Consistent docstring structure enables automatic API documentation extraction',
        ],
        fieldNotes: [
          'Sphinx Napoleon and mkdocstrings natively parse Google style docstrings',
          'Widely adopted in web services, FastAPI applications, and developer SDKs',
        ],
      },
      {
        id: 'docstring-numpy-style',
        eli: 'eli20',
        name: 'NumPy style docstrings',
        brief: 'Define a function using NumPy style docstring with `Parameters` underline. Calculate `hypot = calc_hypot(3, 4)`.',
        hint: 'def calc_hypot(a, b):\n    """Calculate hypotenuse length.\n\n    Parameters\n    ----------\n    a : float\n        First leg.\n    b : float\n        Second leg.\n\n    Returns\n    -------\n    float\n        Hypotenuse length.\n    """\n    return (a**2 + b**2)**0.5\nhypot = calc_hypot(3, 4)',
        start: '',
        par: 15,
        difficulty: 4,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { hypot: { value: 5.0 } } },
        solution: 'def calc_hypot(a, b):\n    """Calculate hypotenuse length.\n\n    Parameters\n    ----------\n    a : float\n        First leg.\n    b : float\n        Second leg.\n\n    Returns\n    -------\n    float\n        Hypotenuse length.\n    """\n    return (a**2 + b**2)**0.5\nhypot = calc_hypot(3, 4)',
        lesson: `**NumPy Style docstrings** (Numpydoc) are the standard format for the Python scientific computing and data science ecosystem (NumPy, SciPy, pandas, scikit-learn).

Sections are followed by hyphenated underlines (\`----------\`), providing clear visual separation for complex mathematical parameter specifications.`,
        learning: [
          'NumPy style docstrings use underlined section headers',
          'Standard format across data science and scientific Python packages',
        ],
        fieldNotes: [
          'Parameters list types explicitly alongside descriptions',
          'Includes specialized sections like See Also, Notes, References, and Examples',
        ],
      },
      {
        id: 'docstring-doctest',
        eli: 'eliphd',
        name: 'Executable doctests',
        brief: 'Run doctests on a module using `import doctest; test_res = doctest.testmod().failed`.',
        hint: 'def double(x):\n    """Double a number.\n\n    >>> double(5)\n    10\n    """\n    return x * 2\nimport doctest\ntest_res = doctest.testmod().failed',
        start: '',
        par: 8,
        difficulty: 5,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { test_res: { type: 'int', repr: '0' } } },
        solution: 'def double(x):\n    """Double a number.\n\n    >>> double(5)\n    10\n    """\n    return x * 2\nimport doctest\ntest_res = doctest.testmod().failed',
        lesson: `Python's built-in \`doctest\` module scans docstrings for interactive Python sessions (lines starting with \`>>>\`), executes them, and verifies that the output matches the text below.

When all tests pass, \`failed\` is \`0\`. Doctests ensure that documentation code samples never drift or become outdated.`,
        learning: [
          'doctest executes interactive session examples embedded in docstrings',
          'Guarantees documentation examples remain working and accurate over time',
        ],
        fieldNotes: [
          'Run doctests from terminal: python -m doctest myfile.py',
          'pytest natively discovers and runs doctests via pytest --doctest-modules',
        ],
      },
    ],
    deepLesson: `## Beginner: The Purpose of Docstrings
Unlike inline comments (\`#\`), docstrings describe *what* a function does and *how* to use it, rather than *how* it is implemented internally.
PEP 257 recommends:
- Always use \`"""triple double quotes"""\`
- Capitalize the first word and end with a period
- Use imperative mood: "Return the path" rather than "Returns the path"

## Intermediate: Docstrings at Runtime
Docstrings are attached directly to the object:
\`\`\`python
def greet():
    """Say hello."""
    pass

print(greet.__doc__)  # 'Say hello.'
\`\`\`
The built-in \`help()\` function renders formatted docstrings with signatures and module paths.

## Advanced: Modern Formatting Styles (Google vs NumPy)
Two major formats dominate production Python:
1. **Google Style:** Highly readable in source form, indented sections (\`Args:\`, \`Returns:\`, \`Raises:\`).
2. **NumPy Style:** Underlined headers (\`Parameters\\n----------\`), standard across scientific packages.

Linters like \`flake8-docstrings\` or \`ruff\` enforce consistency across teams.

## Expert: Executable Documentation with Doctest
Docstrings can contain live test suites:
\`\`\`python
def factorial(n):
    """Compute n!
    >>> factorial(4)
    24
    """
    return 1 if n <= 1 else n * factorial(n - 1)
\`\`\`
Running \`doctest.testmod()\` verifies every example in the module, preventing documentation rot.`,
  },
];
