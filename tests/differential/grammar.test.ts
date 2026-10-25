/**
 * Differential grammar and built-ins test suite.
 *
 * Runs Phase 3 grammar extensions and built-in functions through both real
 * CPython >= 3.12 and the simulator to guarantee exact semantic equivalence.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { findPython, runPython } from './cpython';
import { runSimulator } from './simulator';

describe('differential grammar (Phase 3 probes)', () => {
  const py = findPython();

  beforeAll(() => {
    if (!py) {
      console.warn('Skipping CPython differential grammar probes: CPython >= 3.12 not found.');
    }
  });

  function probe(name: string, code: string): void {
    const testRunner = py ? it : it.skip;
    testRunner(
      name,
      async () => {
        const expected = await runPython(code);
        const actual = runSimulator(code);

        if (expected.errorType !== null) {
          expect(
            actual.errorType,
            `Expected ${expected.errorType} but got ${actual.errorType ?? 'no error'}\nCode:\n${code}\nStdout: ${actual.stdout}`
          ).toBe(expected.errorType);
        } else {
          expect(
            actual.errorType,
            `Unexpected error ${actual.errorType}: ${actual.rawError}\nCode:\n${code}`
          ).toBeNull();
          expect(actual.stdout).toBe(expected.stdout);
        }
      },
      15000
    );
  }

  describe('3.1 Sequence unpacking', () => {
    probe('tuple unpacking a, b = (1, 2)', 'a, b = (1, 2)\nprint(a, b)');
    probe('list unpacking a, b = [3, 4]', 'a, b = [3, 4]\nprint(a, b)');
    probe('variable swap a, b = b, a', 'a = 1\nb = 2\na, b = b, a\nprint(a, b)');
    probe('unpacking in for loop', 'pairs = [(1, "a"), (2, "b")]\nfor k, v in pairs:\n    print(k, v)');
    probe('unpacking mismatch raises ValueError', 'a, b = [1, 2, 3]');
  });

  describe('3.2 Function keyword arguments and default values', () => {
    probe('function default argument value', 'def greet(name, msg="hello"):\n    return name + ": " + msg\nprint(greet("alice"))');
    probe('function keyword argument override', 'def greet(name, msg="hello"):\n    return name + ": " + msg\nprint(greet("alice", msg="hi"))');
    probe('keyword argument out of order', 'def sub(a, b):\n    return a - b\nprint(sub(b=2, a=5))');
  });

  describe('3.3 Comprehensions', () => {
    probe('list comprehension basic', 'evens = [x * 2 for x in [1, 2, 3]]\nprint(evens)');
    probe('list comprehension with if filter', 'odds = [x for x in [1, 2, 3, 4, 5] if x % 2 != 0]\nprint(odds)');
    probe('dict comprehension', 'squares = {x: x * x for x in [1, 2, 3]}\nprint(squares)');
    probe('set comprehension', 'mods = {x % 3 for x in [1, 2, 3, 4, 5, 6]}\nprint(mods)');
    probe('nested list comprehension', 'pts = [x + y for x in [1, 2] for y in [10, 20]]\nprint(pts)');
  });

  describe('3.4 F-Strings', () => {
    probe('simple f-string with variable interpolation', 'name = "world"\nprint(f"hello {name}")');
    probe('f-string with arithmetic expression', 'a = 10\nb = 20\nprint(f"{a} + {b} = {a + b}")');
    probe('f-string with multiple variables and strings', 'x = 42\nprint(f"val: {x}, next: {x + 1}")');
  });

  describe('3.5 Class definitions and OOP', () => {
    probe('basic class with __init__ and method call', 'class Dog:\n    def __init__(self, name):\n        self.name = name\n    def bark(self):\n        return self.name + " woof"\nd = Dog("Rex")\nprint(d.bark())');
    probe('class inheritance and method resolution', 'class Animal:\n    def sound(self):\n        return "generic"\nclass Cat(Animal):\n    def sound(self):\n        return "meow"\nc = Cat()\nprint(c.sound())');
    probe('super() call to base class constructor', 'class Base:\n    def __init__(self, x):\n        self.x = x\nclass Derived(Base):\n    def __init__(self, x, y):\n        super().__init__(x)\n        self.y = y\nd = Derived(10, 20)\nprint(d.x, d.y)');
    probe('instance attribute lookup fallback to class attribute', 'class Item:\n    category = "general"\ni = Item()\nprint(i.category)');
  });

  describe('3.6 Exception handling', () => {
    probe('try / except catches specific exception', 'try:\n    x = 1 / 0\nexcept ZeroDivisionError:\n    print("caught zero division")');
    probe('try / except as e binds exception object', 'try:\n    int("abc")\nexcept ValueError as e:\n    print("caught ValueError")');
    probe('try / except / else / finally when no exception raised', 'try:\n    x = 1\nexcept Exception:\n    print("except")\nelse:\n    print("else")\nfinally:\n    print("finally")');
    probe('try / except / finally when exception caught', 'try:\n    x = 1 / 0\nexcept ZeroDivisionError:\n    print("except")\nfinally:\n    print("finally")');
    probe('raise ValueError raises exception', 'raise ValueError("test error")');
  });

  describe('3.7 Comparison and membership operators', () => {
    probe('not in operator on list', 'print(1 not in [2, 3, 4], 2 not in [2, 3, 4])');
    probe('not in operator on dict keys', 'd = {"a": 1}\nprint("b" not in d, "a" not in d)');
    probe('is not operator on identity', 'a = [1]\nb = [1]\nprint(a is not b, a is not a)');
  });

  describe('3.8 Built-in functions', () => {
    probe('enumerate() with index and value pairs', 'print(list(enumerate(["a", "b", "c"])))');
    probe('enumerate() with custom start offset', 'print(list(enumerate(["x", "y"], 1)))');
    probe('zip() pairing two lists', 'print(list(zip([1, 2, 3], ["a", "b", "c"])))');
    probe('reversed() returns reversed sequence', 'print(list(reversed([1, 2, 3])))');
    probe('all() and any() boolean reduction', 'print(all([True, 1, "yes"]), all([True, 0]), any([0, "", False]), any([0, "a", False]))');
    probe('round() float rounding', 'print(round(3.14159, 2), round(2.7), round(2.2))');
    probe('chr() and ord() code point conversions', 'print(chr(65), ord("A"), ord("z"))');
  });
});
