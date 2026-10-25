/**
 * Series: Typing & Pydantic.
 *
 * Runs in the Pyodide lane with real Pydantic v2 execution.
 * Explores type annotations, generics, Pydantic schemas, validation, and serialization.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'typing-pydantic',
    title: 'Typing & Pydantic',
    levels: [
      {
        id: 'typing-type-hints',
        eli: 'eli5',
        name: 'Function type annotations',
        brief: 'Define a typed function `def greet(name: str) -> str: return "Hello " + name`, then call `msg = greet("World")`.',
        hint: 'def greet(name: str) -> str:\n    return "Hello " + name\nmsg = greet("World")',
        start: '',
        par: 3,
        difficulty: 1,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { msg: { type: 'str', repr: "'Hello World'" } } },
        solution: 'def greet(name: str) -> str:\n    return "Hello " + name\nmsg = greet("World")',
        lesson: `Python type hints (PEP 484) annotate the expected types of function parameters and return values.

**Crucial CPython Detail:**
Type hints in standard Python are purely advisory at runtime. Python does not enforce types unless a validation framework like Pydantic or a static analyzer like mypy/pyright is used.`,
        learning: [
          'Type annotations specify expected parameter and return types',
          'Standard CPython ignores type hints at runtime unless inspected via __annotations__',
        ],
        fieldNotes: [
          'Type hints improve IDE autocompletion, refactoring safety, and documentation',
          'Use static analysis (mypy / pyright) in CI to catch type bugs before production',
        ],
      },
      {
        id: 'typing-generic-types',
        eli: 'eli10',
        name: 'Generic container types',
        brief: 'Use Python 3.9+ built-in generics to type a list processor: `def first_num(nums: list[int]) -> int: return nums[0]`. Call `first = first_num([42, 99])`.',
        hint: 'def first_num(nums: list[int]) -> int:\n    return nums[0]\nfirst = first_num([42, 99])',
        start: '',
        par: 3,
        difficulty: 2,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { first: { type: 'int', repr: '42' } } },
        solution: 'def first_num(nums: list[int]) -> int:\n    return nums[0]\nfirst = first_num([42, 99])',
        lesson: `In Python 3.9+ (PEP 585), built-in container types like \`list\`, \`dict\`, and \`tuple\` directly support generic subscripting (e.g. \`list[int]\`, \`dict[str, float]\`) without needing to import from the \`typing\` module.`,
        learning: [
          'Built-in types support generic parameterization in Python 3.9+',
          'Generics describe container contents for static type checkers',
        ],
        fieldNotes: [
          'Use typing.Union or X | Y (Python 3.10+) for alternative types',
          'typing.Optional[T] is equivalent to T | None',
        ],
      },
      {
        id: 'pydantic-basic-model',
        eli: 'eli15',
        name: 'Pydantic BaseModel schema',
        brief: 'Define a Pydantic `User` model with `id: int` and `name: str`. Instantiate `user = User(id=1, name="Alice")`.',
        hint: 'from pydantic import BaseModel\nclass User(BaseModel):\n    id: int\n    name: str\nuser = User(id=1, name="Alice")',
        start: '',
        par: 5,
        difficulty: 3,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { user: { type: 'User' } } },
        solution: 'from pydantic import BaseModel\nclass User(BaseModel):\n    id: int\n    name: str\nuser = User(id=1, name="Alice")',
        lesson: `**Pydantic** is Python's leading data validation and schema library. Inheriting from \`pydantic.BaseModel\` gives your class:
- Runtime type validation and coercion
- JSON serialization (\`model_dump()\`, \`model_dump_json()\`)
- Clear error messages when input data is invalid

**Look at the Memory Board:**
Notice how \`user\` is rendered as a structured object card on the heap with its validated \`id\` and \`name\` fields.`,
        learning: [
          'Pydantic BaseModel enforces type hints at runtime during initialization',
          'Fields are defined using standard Python type annotations',
        ],
        fieldNotes: [
          'Pydantic v2 core is compiled in Rust for blazingly fast validation',
          'FastAPI relies on Pydantic models for request body parsing and OpenAPI schemas',
        ],
      },
      {
        id: 'pydantic-validation-error',
        eli: 'eli20',
        name: 'Type coercion and validation errors',
        brief: 'Instantiate `User(id="42", name="Bob")` and observe Pydantic automatically coerce the string `"42"` into an integer `42`. Store in `u`.',
        hint: 'from pydantic import BaseModel\nclass User(BaseModel):\n    id: int\n    name: str\nu = User(id="42", name="Bob")',
        start: '',
        par: 5,
        difficulty: 4,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { u: { type: 'User' } } },
        solution: 'from pydantic import BaseModel\nclass User(BaseModel):\n    id: int\n    name: str\nu = User(id="42", name="Bob")',
        lesson: `Pydantic automatically coerces compatible types. Passing \`id="42"\` succeeds because \`"42"\` cleanly converts to \`int\`.

If you provide an unconvertible value (such as \`id="invalid"\`), Pydantic immediately raises a \`ValidationError\` containing detailed field error diagnostics.`,
        learning: [
          'Pydantic coerces compatible data types (e.g. numeric strings to ints)',
          'Invalid data raises pydantic.ValidationError with precise JSON field error paths',
        ],
        fieldNotes: [
          'Use Field(strict=True) to disable automatic coercion when exact types are required',
          'ValidationError.errors() returns machine-readable error dictionaries',
        ],
      },
      {
        id: 'pydantic-nested-model',
        eli: 'eliphd',
        name: 'Nested models and serialization',
        brief: 'Create a nested model `Address(city="Berlin")` inside `Company(name="Tech", address=...)`. Export dictionary `data = comp.model_dump()`.',
        hint: 'from pydantic import BaseModel\nclass Address(BaseModel):\n    city: str\nclass Company(BaseModel):\n    name: str\n    address: Address\ncomp = Company(name="Tech", address=Address(city="Berlin"))\ndata = comp.model_dump()',
        start: '',
        par: 8,
        difficulty: 5,
        engine: 'pyodide',
        goal: { type: 'vars', vars: { data: { type: 'dict' } } },
        solution: 'from pydantic import BaseModel\nclass Address(BaseModel):\n    city: str\nclass Company(BaseModel):\n    name: str\n    address: Address\ncomp = Company(name="Tech", address=Address(city="Berlin"))\ndata = comp.model_dump()',
        lesson: `Models can be composed hierarchically. When validating nested structures, Pydantic parses and validates all children recursively.

\`comp.model_dump()\` serializes the complete model tree into native Python dictionaries and primitives, ready for JSON or database storage.`,
        learning: [
          'Models can be nested inside other models for complex domain hierarchies',
          'model_dump() serializes nested models into standard Python dictionaries',
        ],
        fieldNotes: [
          'model_dump_json() serializes directly to a UTF-8 JSON string',
          'Use model_validate(raw_dict) to parse incoming JSON payloads into model instances',
        ],
      },
    ],
    deepLesson: `## Beginner: Why Python Needs Type Hints
Python is dynamically typed: variable types are checked at runtime during execution.
Starting with PEP 484, Python introduced optional type annotations:
\`\`\`python
def calculate_tax(price: float, rate: float = 0.2) -> float:
    return price * rate
\`\`\`
Annotations are stored in \`__annotations__\` and used by IDEs and static linters, but standard CPython does not enforce them at runtime.

## Intermediate: Generics and Modern Type Syntax
Modern Python (3.10+) provides clean syntax for unions and generic collections:
\`\`\`python
def find_user(user_id: int) -> dict[str, str] | None:
    if user_id > 0:
        return {"name": "Alice"}
    return None
\`\`\`
For complex protocol typing, use \`typing.Protocol\` for structural subtyping (duck typing).

## Advanced: Pydantic v2 Architecture
Pydantic bridges static types and runtime reality:
\`\`\`python
from pydantic import BaseModel, Field

class Order(BaseModel):
    id: int
    items: list[str] = Field(default_factory=list)
\`\`\`
Under the hood, Pydantic v2 uses \`pydantic-core\` written in Rust. It compiles validation rules into a fast state machine, executing validations 10x to 50x faster than pure Python.

## Expert: Production Patterns in Microservices
In modern web architectures (FastAPI, SQLModel, Celery):
- **Request Validation:** Incoming HTTP JSON payloads are validated into Pydantic models.
- **Settings Management:** \`pydantic-settings\` reads environment variables from \`.env\` files and validates them at process startup.
- **Database Mappings:** Pydantic models parse database rows via \`from_attributes=True\`.`,
  },
];
