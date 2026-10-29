# ADR 014: Object-Oriented Programming (OOP) Curriculum Series

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Core Team

## Context

While ADR 008 introduced engine execution support for Python class definitions, constructor instantiation, method resolution, and `super()`, the interactive curriculum previously transitioned directly from functional tools to third-party data libraries without an explicit, progressive OOP learning sequence.

Object-oriented programming in Python is fundamentally a memory-model concept:
1. A `class` is an object allocated on the heap containing shared methods and class attributes.
2. Instantiating a class allocates a fresh `instance` dictionary on the heap.
3. Methods are functions that automatically receive the caller instance as `self`.
4. Class attributes provide fallback lookup values, while assigning to an instance attribute creates a local key that shadows the class attribute without mutating it.

## Decision

We introduce a dedicated 5-level series in `src/levels/oop.ts`, integrated into the curriculum spine (`sequences`) and fully translated into German (`src/i18n/de-g6.ts`) and Persian (`src/i18n/fa-g6.ts`):

1. **`oop-class-instance` (ELI5 / Difficulty 1):**
   - Introduces classes as blueprints and instances as concrete heap objects with distinct identity.
   - Par: 1 (`bot = Robot()`).

2. **`oop-init-attributes` (ELI10 / Difficulty 2):**
   - Teaches `__init__`, the `self` parameter, and assigning instance fields (`self.x = x`).
   - Par: 2 (`p = Point(3, 4); dist_sum = p.x + p.y`).

3. **`oop-methods-self` (ELI15 / Difficulty 3):**
   - Covers method definitions, encapsulated state mutation, and the `c.method()` syntactic sugar.
   - Par: 2 (`c = Counter(); val = c.increment(5)`).

4. **`oop-inheritance-super` (ELI20 / Difficulty 4):**
   - Explores subclassing, method reuse, and constructor delegation via `super().__init__()`.
   - Par: 2 (`car = ElectricCar("Tesla", 75); msg = car.start()`).

5. **`oop-class-vs-instance` (ELI-PhD / Difficulty 5):**
   - Clarifies the critical difference between class-level attributes and instance-level attributes, demonstrating how instance attribute assignment shadows class attributes without side effects across other instances.
   - Par: 4.

### Trilingual Deep Lesson
Includes the required four-tiered deep lesson across English, German, and Persian:
- `## Beginner:` The Class as a Blueprint and Objects on the Heap
- `## Intermediate:` The Lifecycle of an Instance and `__init__`
- `## Advanced:` Method Binding, Encapsulation, and Inheritance
- `## Expert:` Attribute Resolution Order, Namespace Shadowing, and MRO

## Consequences

- The curriculum expands from 25 series / 123 levels to 26 series / 128 levels.
- 100% of level solutions pass differential verification against real CPython $\ge 3.12$.
- Catalog invariants, par validation, and trilingual coverage continue to pass with 0 defects.
