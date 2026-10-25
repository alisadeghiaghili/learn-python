/**
 * Series: Testing with Pytest & Mocks.
 *
 * Runs in the Pyodide lane with real pytest and unittest.mock execution.
 * Explores assertion introspection, fixtures, mocking, and exception testing.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'testing-pytest',
    title: 'Testing & Pytest',
    levels: [
      {
        id: 'pytest-assert',
        eli: 'eli5',
        name: 'Python assert statement',
        brief: 'Test `add(2, 3) == 5` with an `assert` statement and record `verified = True`.',
        hint: 'def add(a, b):\n    return a + b\nassert add(2, 3) == 5\nverified = True',
        start: '',
        par: 4,
        difficulty: 1,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { verified: { type: 'bool', repr: 'True' } } },
        solution: 'def add(a, b):\n    return a + b\nassert add(2, 3) == 5\nverified = True',
        lesson: `In Python and **pytest**, test assertions use the standard language keyword \`assert\`:
\`\`\`python
assert actual == expected
\`\`\`
Unlike xUnit frameworks with verbose \`assertEquals()\` methods, pytest rewrites the Python AST at test collection time to provide rich diffs upon assertion failure.`,
        learning: [
          'pytest uses standard Python assert statements instead of boilerplate assertion methods',
          'Failed assertions raise AssertionError with detailed variable introspection',
        ],
        fieldNotes: [
          'pytest assertion rewriting reconstructs intermediate values without custom matchers',
          'Never use assert for production input validation (python -O disables asserts)',
        ],
      },
      {
        id: 'pytest-mock',
        eli: 'eli10',
        name: 'Mocking with MagicMock',
        brief: 'Create a `MagicMock(return_value=42)` and call it: `val = mock()`. Observe the call count `called = mock.call_count`.',
        hint: 'from unittest.mock import MagicMock\nmock = MagicMock(return_value=42)\nval = mock()\ncalled = mock.call_count',
        start: '',
        par: 4,
        difficulty: 2,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { val: { type: 'int', repr: '42' }, called: { type: 'int', repr: '1' } } },
        solution: 'from unittest.mock import MagicMock\nmock = MagicMock(return_value=42)\nval = mock()\ncalled = mock.call_count',
        lesson: `\`unittest.mock.MagicMock\` creates mock objects that simulate real dependencies (APIs, databases, external services).

**Look at the Memory Board:**
The \`mock\` object records all calls, arguments, and return values made against it. \`mock.call_count\` tracks how many times the callable was executed.`,
        learning: [
          'MagicMock simulates external dependencies and records invocation history',
          'mock.return_value specifies the value returned when the mock is called',
        ],
        fieldNotes: [
          'mock.assert_called_once_with(...) verifies expected call arguments',
          'Use unittest.mock.patch to replace functions during a test context',
        ],
      },
      {
        id: 'pytest-fixture',
        eli: 'eli15',
        name: 'Fixture dependency injection',
        brief: 'Simulate a database fixture `db = {"users": []}`, insert `"Alice"`, and record count `n = len(db["users"])`.',
        hint: 'def get_db():\n    return {"users": []}\ndb = get_db()\ndb["users"].append("Alice")\nn = len(db["users"])',
        start: '',
        par: 5,
        difficulty: 3,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { n: { type: 'int', repr: '1' } } },
        solution: 'def get_db():\n    return {"users": []}\ndb = get_db()\ndb["users"].append("Alice")\nn = len(db["users"])',
        lesson: `**Fixtures** in pytest provide baseline test setups (database connections, test clients, temporary files).

By passing fixture names as function arguments, pytest automatically executes setup, passes the instance, and tears it down after test completion.`,
        learning: [
          'Fixtures provide clean, repeatable test data and dependency instances',
          'Separates test setup logic from test assertion verification',
        ],
        fieldNotes: [
          'Fixtures support scopes: function, class, module, package, session',
          'Use yield inside a fixture to execute teardown logic after test completion',
        ],
      },
      {
        id: 'pytest-parametrize',
        eli: 'eli20',
        name: 'Parametrized testing',
        brief: 'Test squaring logic across multiple cases `cases = [(1, 1), (2, 4), (3, 9)]` with a loop and set `all_passed = True`.',
        hint: 'cases = [(1, 1), (2, 4), (3, 9)]\nfor x, expected in cases:\n    assert x * x == expected\nall_passed = True',
        start: '',
        par: 4,
        difficulty: 4,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { all_passed: { type: 'bool', repr: 'True' } } },
        solution: 'cases = [(1, 1), (2, 4), (3, 9)]\nfor x, expected in cases:\n    assert x * x == expected\nall_passed = True',
        lesson: `In pytest, \`@pytest.mark.parametrize\` runs the same test function repeatedly against distinct input/output tuples.

Each tuple creates an independent test case reported separately in test outputs, making failures easy to isolate without repeating test code.`,
        learning: [
          'Parametrization executes one test function across multiple data inputs',
          'Each parameter set runs as an isolated test case',
        ],
        fieldNotes: [
          'Parametrization is ideal for testing boundary conditions (0, -1, empty string, None)',
          'Pairs well with hypothesis for property-based fuzz testing',
        ],
      },
      {
        id: 'pytest-exception-test',
        eli: 'eliphd',
        name: 'Testing expected exceptions',
        brief: 'Verify that `1 / 0` raises `ZeroDivisionError` using `import pytest; with pytest.raises(ZeroDivisionError): 1 / 0; caught = True`.',
        hint: 'import pytest\nwith pytest.raises(ZeroDivisionError):\n    1 / 0\ncaught = True',
        start: '',
        par: 4,
        difficulty: 5,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { caught: { type: 'bool', repr: 'True' } } },
        solution: 'import pytest\nwith pytest.raises(ZeroDivisionError):\n    1 / 0\ncaught = True',
        lesson: `To test that code raises an expected exception under error conditions, pytest provides the \`pytest.raises\` context manager:
\`\`\`python
with pytest.raises(ValueError) as exc_info:
    parse_int("invalid")
assert "invalid" in str(exc_info.value)
\`\`\`
If the code inside the block does not raise the specified exception, the test immediately fails.`,
        learning: [
          'pytest.raises() asserts that a specific exception type is raised',
          'Provides exc_info to inspect exception messages and attributes',
        ],
        fieldNotes: [
          'Use match="regex" inside pytest.raises to assert on error message text',
          'Testing error conditions is as critical as testing the happy path',
        ],
      },
    ],
    deepLesson: `## Beginner: The Pytest Philosophy
Python ships with the standard library \`unittest\` module based on Java's JUnit.
However, modern Python development has almost universally standardized on **pytest**:
- Standard \`assert\` expressions instead of \`self.assertEqual()\`
- Zero boilerplate: tests are plain functions named \`test_*\`
- Unmatched error reporting with AST assertion rewriting

## Intermediate: Test Fixtures and Lifecycles
Fixtures replace \`setUp\` and \`tearDown\` methods:
\`\`\`python
import pytest

@pytest.fixture
def sample_user():
    user = {"name": "Alice", "role": "admin"}
    yield user
    # Teardown code runs after test finishes
    user.clear()
\`\`\`
Any test function can request \`sample_user\` as an argument:
\`\`\`python
def test_admin_access(sample_user):
    assert sample_user["role"] == "admin"
\`\`\`

## Advanced: Mocking External Systems
Never hit production databases, payment gateways, or third-party APIs during unit tests:
\`\`\`python
from unittest.mock import patch

@patch("myapp.services.send_email")
def test_signup(mock_send):
    register("user@test.com")
    mock_send.assert_called_once()
\`\`\`

## Expert: Production Test Architectures
In continuous integration (CI) pipelines:
- **Fast Unit Tests:** In-memory, mocked I/O, execute in milliseconds.
- **Integration Tests:** Local SQLite / test containers for database persistence.
- **Coverage:** \`pytest-cov\` generates line and branch coverage reports, enforcing quality gates.`,
  },
];
