# ADR 015: Advanced OOP & Python Data Model Curriculum Series

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Core Team

## Context

Following the establishment of basic object-oriented foundations in ADR 014 (classes, instances, `__init__`, methods with `self`, and single inheritance with `super()`), critical aspects of idiomatic, production-grade Python OOP remained unaddressed:
1. **Dunder Representations (`__repr__` vs `__str__`):** Distinction between human-friendly display representations and unambiguous developer diagnostic strings.
2. **Encapsulation & Validation (`@property`):** Eliminating verbose Java-style getters/setters in favor of descriptor-driven managed attributes with setter validation.
3. **Alternative Constructors (`@classmethod` & `@staticmethod`):** Constructing instances from diverse data sources (dictionaries, JSON, tuples) while preserving subclass polymorphism.
4. **Python Data Model & Operator Overloading:** Dunder protocols (`__add__`, `__eq__`) enabling custom types to participate naturally in language syntax and duck-typed polymorphism.
5. **Architectural Enforcement & Memory Optimization:** Enforcing interface compliance via Abstract Base Classes (`abc.ABC`) and eliminating instance dictionary overhead with `__slots__`.

## Decision

We introduce a dedicated 5-level advanced series in `src/levels/oop-advanced.ts` (`oop-advanced`), positioned immediately after `oop` in `sequences`, leveraging the dual-lane Pyodide execution architecture (ADR 011), and fully localized in English, German (`src/i18n/de-g6.ts`), and Persian (`src/i18n/fa-g6.ts`):

1. **`oop-repr-str` (ELI5 / Difficulty 1):**
   - Contrasts `__str__` for end-user display (`str(u)`) and `__repr__` for developer diagnostics (`repr(u)`).
   - Solution: `u = User("ada", "admin"); display = str(u); debug = repr(u)` (Par: 3).

2. **`oop-property-encapsulation` (ELI10 / Difficulty 2):**
   - Teaches `@property` getters and `@<name>.setter` validation without breaking public attribute access syntax.
   - Solution: `t = Temperature(25); t.celsius = 30; reading = t.celsius` (Par: 3).

3. **`oop-classmethod-factory` (ELI15 / Difficulty 3):**
   - Explores `@classmethod` alternative constructors receiving `cls` alongside utility `@staticmethod` functions.
   - Solution: `cfg = Config.from_dict({"host": "localhost", "port": 8080}); valid = Config.is_valid_port(cfg.port)` (Par: 2).

4. **`oop-operator-overloading` (ELI20 / Difficulty 4):**
   - Teaches the Python Data Model via `__add__` and `__eq__`, overriding default object identity with value-based semantics.
   - Solution: `v1 = Vector(2, 3); v2 = Vector(4, 5); v3 = v1 + v2; is_equal = (v3 == Vector(6, 8))` (Par: 4).

5. **`oop-abstract-protocol` (ELI-PhD / Difficulty 5):**
   - Enforces runtime interface compliance using `abc.ABC` and `@abstractmethod`, guaranteeing that concrete implementations satisfy architectural contracts.
   - Solution: `repo = InMemoryRepo(); repo.set("session", "active"); item = repo.get("session")` (Par: 3).

### Trilingual Deep Lesson
Includes the mandatory four-tiered deep lesson across English, German, and Persian:
- `## Beginner:` String Representations and Developer Diagnostics (`__repr__` vs `__str__`)
- `## Intermediate:` Encapsulation, Descriptors, and `@property` Validation
- `## Advanced:` Alternative Constructors, Metaprogramming, and Operator Overloading
- `## Expert:` Contract Enforcement, Abstract Base Classes, and Memory Optimization with `__slots__`

## Consequences

- The catalog expands from 26 series / 128 levels to 27 series / 133 levels.
- Full trilingual parity maintained across English, German, and Persian with strict ZWNJ discipline.
- All 133 level reference solutions pass 100% against CPython $\ge 3.12$ and Pyodide runtime introspection.
