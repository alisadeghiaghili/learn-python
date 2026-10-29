/**
 * Series: Advanced OOP & Python Data Model.
 *
 * Explores dunder representations (__repr__ vs __str__), encapsulation with @property
 * and validation setters, alternative constructors via @classmethod and @staticmethod,
 * operator overloading & polymorphism, and architectural contracts with abc.ABC and __slots__.
 */

import type { Sequence } from '../engine/types';

export const series: Sequence[] = [
  {
    id: 'oop-advanced',
    title: 'Advanced OOP & Data Model',
    levels: [
      {
        id: 'oop-repr-str',
        eli: 'eli5',
        name: 'Representation vs display: __repr__ and __str__',
        brief: 'Create a user `u = User("ada", "admin")`. Compute `display = str(u)` and `debug = repr(u)`. Notice how `__str__` targets human readers while `__repr__` provides an unambiguous debugging representation.',
        hint: 'u = User("ada", "admin")\ndisplay = str(u)\ndebug = repr(u)',
        start: 'class User:\n    def __init__(self, username, role):\n        self.username = username\n        self.role = role\n    def __str__(self):\n        return f"{self.username} ({self.role})"\n    def __repr__(self):\n        return f"User(\'{self.username}\', \'{self.role}\')"',
        par: 3,
        engine: 'pyodide',
        difficulty: 1,
        goal: {
          type: 'vars',
          vars: {
            display: { type: 'str', repr: "'ada (admin)'" },
            debug: { type: 'str', repr: "\"User('ada', 'admin')\"" },
          },
        },
        solution: 'u = User("ada", "admin")\ndisplay = str(u)\ndebug = repr(u)',
        lesson: `Python differentiates between human-friendly display text and unambiguous developer representations:
- \`__str__\` is invoked by \`str(x)\` and \`print(x)\`. It is designed for end-user readability.
- \`__repr__\` is invoked by \`repr(x)\`, interactive repls, and debug logs. Ideally, it looks like valid Python code to recreate the object.

**Rule of thumb:**
Always implement \`__repr__\` first. If \`__str__\` is not defined, Python automatically falls back to \`__repr__\`.`,
        learning: [
          '__str__ provides human-readable representation for print() and str()',
          '__repr__ provides unambiguous debugging representation for developers',
          'Python falls back to __repr__ when __str__ is not defined',
        ],
        fieldNotes: [
          'In logging and debugging tracebacks, format with %r or {!r} to invoke __repr__',
          'A good __repr__ often matches the syntax needed to instantiate the object: eval(repr(obj)) == obj',
        ],
      },
      {
        id: 'oop-property-encapsulation',
        eli: 'eli10',
        name: 'Encapsulation with @property and setter validation',
        brief: 'Instantiate `t = Temperature(25)`, update `t.celsius = 30`, and read `reading = t.celsius`. Notice how attribute access cleanly triggers getter and setter validation methods without method call syntax.',
        hint: 't = Temperature(25)\nt.celsius = 30\nreading = t.celsius',
        start: 'class Temperature:\n    def __init__(self, celsius):\n        self._celsius = celsius\n    @property\n    def celsius(self):\n        return self._celsius\n    @celsius.setter\n    def celsius(self, value):\n        if value < -273.15:\n            raise ValueError("Below absolute zero")\n        self._celsius = value',
        par: 3,
        engine: 'pyodide',
        difficulty: 2,
        goal: {
          type: 'vars',
          vars: {
            reading: { type: 'int', repr: '30' },
          },
        },
        solution: 't = Temperature(25)\nt.celsius = 30\nreading = t.celsius',
        lesson: `In Python, avoid writing manual Java-style getter and setter methods like \`get_celsius()\` and \`set_celsius()\`.

Instead, start with public attributes. When validation, transformation, or caching is needed later, wrap the attribute with the \`@property\` decorator.

**How it works:**
- \`@property\` turns a method into a read-only attribute getter.
- \`@<name>.setter\` defines a setter method that executes on assignment (\`t.celsius = 30\`).
- Callers use clean dot notation (\`t.celsius\`) while validation runs under the hood.`,
        learning: [
          '@property enables getter behavior with regular attribute access syntax',
          '@<name>.setter validates or transforms values on assignment',
          'Preserves public API compatibility without breaking existing client code',
        ],
        fieldNotes: [
          'Leading underscore (_celsius) is a Python convention indicating internal or protected state',
          'Use @property sparingly; expensive computations should be explicit methods rather than properties',
        ],
      },
      {
        id: 'oop-classmethod-factory',
        eli: 'eli15',
        name: 'Factory constructors with @classmethod and @staticmethod',
        brief: 'Construct `cfg = Config.from_dict({"host": "localhost", "port": 8080})` using the class method factory, and validate the port with `valid = Config.is_valid_port(cfg.port)`.',
        hint: 'cfg = Config.from_dict({"host": "localhost", "port": 8080})\nvalid = Config.is_valid_port(cfg.port)',
        start: 'class Config:\n    def __init__(self, host, port):\n        self.host = host\n        self.port = port\n    @classmethod\n    def from_dict(cls, data):\n        return cls(data["host"], data["port"])\n    @staticmethod\n    def is_valid_port(port):\n        return 1 <= port <= 65535',
        par: 2,
        engine: 'pyodide',
        difficulty: 3,
        goal: {
          type: 'vars',
          vars: {
            valid: { type: 'bool', repr: 'True' },
          },
        },
        solution: 'cfg = Config.from_dict({"host": "localhost", "port": 8080})\nvalid = Config.is_valid_port(cfg.port)',
        lesson: `Python does not support multiple overloaded \`__init__\` methods. Instead, the idiomatic pattern for alternative constructors is **\`@classmethod\`**.

- **\`@classmethod\`**: Receives the class (\`cls\`) as its first argument instead of an instance (\`self\`). It can instantiate and return new objects (\`cls(...)\`), which supports inheritance correctly when subclassed!
- **\`@staticmethod\`**: Does not receive \`self\` or \`cls\`. It behaves like a plain utility function logically scoped inside the class namespace.`,
        learning: [
          '@classmethod receives cls and serves as alternative constructors / factories',
          '@staticmethod belongs to the class namespace without taking self or cls',
          'Factories written with cls correctly instantiate derived subclasses',
        ],
        fieldNotes: [
          'Common @classmethod conventions include from_dict, from_json, and from_env',
          'If a static method does not touch the class or instance, consider whether a top-level module function is clearer',
        ],
      },
      {
        id: 'oop-operator-overloading',
        eli: 'eli20',
        name: 'Operator overloading and value equality',
        brief: 'Create vectors `v1 = Vector(2, 3)` and `v2 = Vector(4, 5)`, add them to get `v3 = v1 + v2`, and check equality `is_equal = (v3 == Vector(6, 8))`. Observe how dunder methods enable custom types to interoperate with language operators.',
        hint: 'v1 = Vector(2, 3)\nv2 = Vector(4, 5)\nv3 = v1 + v2\nis_equal = (v3 == Vector(6, 8))',
        start: 'class Vector:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n    def __add__(self, other):\n        return Vector(self.x + other.x, self.y + other.y)\n    def __eq__(self, other):\n        return isinstance(other, Vector) and self.x == other.x and self.y == other.y',
        par: 4,
        engine: 'pyodide',
        difficulty: 4,
        goal: {
          type: 'vars',
          vars: {
            is_equal: { type: 'bool', repr: 'True' },
          },
        },
        solution: 'v1 = Vector(2, 3)\nv2 = Vector(4, 5)\nv3 = v1 + v2\nis_equal = (v3 == Vector(6, 8))',
        lesson: `The **Python Data Model** defines protocols via double-underscore ("dunder") methods:
- \`__add__(self, other)\` overloads the binary \`+\` operator.
- \`__eq__(self, other)\` overloads equality comparison (\`==\`).

By default, Python classes compare by object identity (\`is\`). Defining \`__eq__\` allows value-based semantic equality (two distinct instances with the same coordinates compare as equal).

**Polymorphism through Duck Typing:**
In Python, polymorphism does not depend on rigid inheritance trees; if an object implements the expected dunder methods or protocols, it works seamlessly with built-in functions and operators.`,
        learning: [
          '__add__ implements custom addition logic for the + operator',
          '__eq__ overrides default identity comparison with value-based equality',
          'Duck typing allows any object implementing the protocol to participate in polymorphic operations',
        ],
        fieldNotes: [
          'When implementing __eq__, also consider implementing __hash__ if instances need to be dictionary keys or set members',
          'Return NotImplemented in dunder operators if the other operand type is unsupported, allowing Python to try the reflected method (__radd__)',
        ],
      },
      {
        id: 'oop-abstract-protocol',
        eli: 'eliphd',
        name: 'Abstract base classes and interface enforcement',
        brief: 'Instantiate `repo = InMemoryRepo()`, save data with `repo.set("session", "active")`, and query `item = repo.get("session")`. Notice how `Repository(ABC)` enforces that any concrete subclass must implement the abstract `get` method.',
        hint: 'repo = InMemoryRepo()\nrepo.set("session", "active")\nitem = repo.get("session")',
        start: 'from abc import ABC, abstractmethod\n\nclass Repository(ABC):\n    @abstractmethod\n    def get(self, key):\n        pass\n\nclass InMemoryRepo(Repository):\n    def __init__(self):\n        self.storage = {}\n    def get(self, key):\n        return self.storage.get(key, "not found")\n    def set(self, key, val):\n        self.storage[key] = val',
        par: 3,
        engine: 'pyodide',
        difficulty: 5,
        goal: {
          type: 'vars',
          vars: {
            item: { type: 'str', repr: "'active'" },
          },
        },
        solution: 'repo = InMemoryRepo()\nrepo.set("session", "active")\nitem = repo.get("session")',
        lesson: `In large-scale enterprise systems, contracts between components prevent architectural drift:

1. **\`abc.ABC\` (Abstract Base Classes)**: Subclasses of \`ABC\` that contain methods decorated with \`@abstractmethod\` cannot be instantiated directly. If a subclass forgets to implement any abstract method, Python raises a \`TypeError\` at instantiation time!
2. **Interface Segregation**: Clients depend on abstract interfaces (\`Repository\`) rather than concrete implementations (\`InMemoryRepo\`, \`PostgresRepo\`), enabling seamless testing and loose coupling.
3. **Structural Subtyping (\`typing.Protocol\`)**: Modern Python also supports static structural typing (compile-time duck typing via PEP 544), complementing runtime ABCs.`,
        learning: [
          'abc.ABC prevents instantiation of incomplete classes missing abstract methods',
          'Enforces explicit architectural contracts across enterprise software layers',
          'Decouples high-level business logic from concrete storage or external systems',
        ],
        fieldNotes: [
          'Attempting to instantiate an abstract class raises TypeError: Can\'t instantiate abstract class with abstract method',
          'Abstract methods can contain default implementation code callable via super().method()',
        ],
      },
    ],
    deepLesson: `## Beginner: String Representations and Developer Diagnostics (__repr__ vs __str__)
Every Python object can produce two distinct string representations:
\`\`\`python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y
    def __str__(self):
        return f"({self.x}, {self.y})"
    def __repr__(self):
        return f"Point({self.x}, {self.y})"
\`\`\`
- \`__str__\` targets human users (called by \`print()\`, \`str()\`, and f-strings \`{p}\`).
- \`__repr__\` targets developers and debugging tools (called by \`repr()\`, logging, and repls).
If \`__str__\` is omitted, Python falls back to \`__repr__\`. If neither is defined, Python displays the generic \`<Point object at 0x...>\`.

## Intermediate: Encapsulation, Descriptors, and @property Validation
Python philosophy favors direct attribute access over boilerplate getters and setters. When validation or computed properties are required, \`@property\` provides clean encapsulation:
\`\`\`python
class BankAccount:
    def __init__(self, balance):
        self._balance = balance

    @property
    def balance(self):
        return self._balance

    @balance.setter
    def balance(self, amount):
        if amount < 0:
            raise ValueError("Balance cannot be negative")
        self._balance = amount
\`\`\`
Under the hood, \`@property\` is a Python **descriptor** implementing \`__get__\` and \`__set__\`.

## Advanced: Alternative Constructors, Metaprogramming, and Operator Overloading
Python allows classes to customize language operators and instantiation pipelines:
\`\`\`python
class Money:
    def __init__(self, amount, currency="USD"):
        self.amount = amount
        self.currency = currency

    @classmethod
    def from_cents(cls, cents, currency="USD"):
        return cls(cents / 100, currency)

    def __add__(self, other):
        if not isinstance(other, Money) or self.currency != other.currency:
            return NotImplemented
        return Money(self.amount + other.amount, self.currency)

    def __eq__(self, other):
        return isinstance(other, Money) and self.amount == other.amount and self.currency == other.currency
\`\`\`
- \`@classmethod\` receives \`cls\` and safely constructs derived subclasses.
- Operator overloading (\`__add__\`, \`__sub__\`, \`__mul__\`) integrates custom types into the language syntax.
- Returning \`NotImplemented\` allows Python to fall back to the right-hand operand's reflected method (\`__radd__\`).

## Expert: Contract Enforcement, Abstract Base Classes, and Memory Optimization with __slots__
Production-grade architectures require strict interfaces and memory efficiency:

### 1. Abstract Base Classes (ABCs)
Using \`abc.ABC\` guarantees interface compliance at runtime:
\`\`\`python
from abc import ABC, abstractmethod

class EventPublisher(ABC):
    @abstractmethod
    def publish(self, topic: str, payload: dict) -> None:
        pass
\`\`\`
Subclasses must implement all abstract methods before instantiation is permitted.

### 2. Memory Optimization with __slots__
By default, each Python object stores its attributes in an internal dictionary (\`__dict__\`), which consumes significant memory overhead (~150-200 bytes per instance):
\`\`\`python
class CompactRecord:
    __slots__ = ("id", "timestamp", "value")
    def __init__(self, id, timestamp, value):
        self.id = id
        self.timestamp = timestamp
        self.value = value
\`\`\`
Defining \`__slots__\` eliminates the instance \`__dict__\`, replacing it with flat array references at fixed C-struct offsets. In datasets with millions of records, this reduces memory consumption by up to 60% and speeds up attribute access.`,
  },
];
