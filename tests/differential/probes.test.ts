/**
 * Differential probe corpus seeding every requirement of Phase 2 against CPython.
 * Probes marked with it.fails document current simulator defects to be resolved in Phase 2.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { findPython, runPython } from './cpython';
import { runSimulator } from './simulator';

describe('Differential probes: Phase 2 engine semantics against CPython', () => {
  const py = findPython();

  beforeAll(() => {
    if (!py) {
      console.warn('Skipping CPython differential probes: CPython >= 3.12 not found.');
    }
  });

  function probe(
    name: string,
    code: string,
    opts: { fails?: boolean } = {}
  ): void {
    const testFn = py ? (opts.fails ? it.fails : it) : it.skip;
    testFn(name, () => {
      const expected = runPython(code);
      const actual = runSimulator(code);

      if (expected.errorType !== null) {
        expect(
          actual.errorType,
          `Expected ${expected.errorType} but got ${actual.errorType ?? 'no error'} (stdout: ${actual.stdout})`
        ).toBe(expected.errorType);
      } else {
        expect(
          actual.errorType,
          `Unexpected error ${actual.errorType}: ${actual.rawError}`
        ).toBeNull();
        expect(actual.stdout).toBe(expected.stdout);
      }
    });
  }

  // 2.1 Object model and identity
  describe('2.1 Object model and identity', () => {
    probe('scalar binding alias identity (x = 3; y = x; x is y)', 'x = 3\ny = x\nprint(x is y)');
    probe('None identity (None is None)', 'x = None\ny = None\nprint(x is y)');
    probe('tuple identity via binding', 'x = (1, 2)\ny = x\nprint(x is y)');
    probe('string identity via binding', 'x = "hello"\ny = x\nprint(x is y)');
    probe('id(x) returns an int', 'x = 3\nprint(type(id(x)).__name__)', { fails: true });
    probe('small-int cache interning: 100 is 100', 'a = 100\nb = 100\nprint(a is b)');
    probe('small-int cache interning: -5 is -5', 'a = -5\nb = -5\nprint(a is b)');
    probe('small-int cache interning: 256 is 256', 'a = 256\nb = 256\nprint(a is b)');
  });

  // 2.2 Augmented assignment
  describe('2.2 Augmented assignment', () => {
    probe('list += mutates in place', 'a = [1]\nb = a\na += [2]\nprint(b)', { fails: true });
    probe('list *= mutates in place', 'a = [1]\nb = a\na *= 2\nprint(b)', { fails: true });
    probe('tuple += rebinds to new object', 't = (1,)\nu = t\nt += (2,)\nprint(u, t is u)');
    probe(
      'numpy slice += writes through to base',
      'import numpy as np\na = np.array([1, 2, 3])\nv = a[:2]\nv += 10\nprint(a)',
      { fails: true }
    );
    probe('list += accepts tuple iterable', 'x = [1]\nx += (2,)\nprint(x)', { fails: true });
    probe('list + tuple raises TypeError', 'x = [1]\nx = x + (2,)', { fails: true });
  });

  // 2.3 Scope
  describe('2.3 Scope', () => {
    probe(
      'compile-time local detection raises UnboundLocalError',
      'x = 1\ndef f():\n    x = x + 1\n    return x\nf()',
      { fails: true }
    );
    probe(
      'global statement modifies module-level name',
      'x = 1\ndef f():\n    global x\n    x = 2\nf()\nprint(x)',
      { fails: true }
    );
    probe(
      'nonlocal statement modifies enclosing cell',
      'def outer():\n    x = 1\n    def inner():\n        nonlocal x\n        x = 2\n    inner()\n    return x\nprint(outer())',
      { fails: true }
    );
    probe(
      'mutable default argument evaluates once at def time',
      'def f(a=[]):\n    a.append(1)\n    return a\nprint(f())\nprint(f())',
      { fails: true }
    );
  });

  // 2.4 Numbers
  describe('2.4 Numbers', () => {
    probe('arbitrary precision int: 2**64', 'print(2**64)', { fails: true });
    probe('arbitrary precision int: 2**100', 'print(2**100)', { fails: true });
    probe('float division 6/3 produces 2.0', 'print(6/3)', { fails: true });
    probe('type(6/3) is float', 'print(type(6/3).__name__)', { fails: true });
    probe('type(3.0) is float', 'print(type(3.0).__name__)', { fails: true });
    probe('floor division 7//2 is 3', 'print(7//2)');
    probe('floor division -7//2 is -4 (floor toward negative infinity)', 'print(-7//2)');
    probe('modulo -7 % 3 is 2', 'print(-7 % 3)');
    probe('scientific notation float 1e5 is 100000.0', 'print(1e5)', { fails: true });
    probe('hex literal 0x10 is 16', 'print(0x10)', { fails: true });
    probe('underscore in integer 1_000 is 1000', 'print(1_000)');
    probe('bool is int subclass: True + 1 is 2', 'print(True + 1)');
    probe('float repr 0.1 + 0.2', 'print(0.1 + 0.2)');
  });

  // 2.5 Errors instead of silent NaN / garbage
  describe('2.5 Errors instead of silent NaN / garbage', () => {
    probe("str + int raises TypeError ('a' + 1)", "'a' + 1", { fails: true });
    probe("int('x') raises ValueError", "int('x')", { fails: true });
    probe('unary minus on list raises TypeError (-[1])', '-[1]', { fails: true });
    probe("1 < 'a' raises TypeError", "1 < 'a'", { fails: true });
    probe('None.foo raises AttributeError', 'None.foo', { fails: true });
    probe('[1][5] raises IndexError', '[1][5]');
    probe("{}['k'] raises KeyError", "{}['k']");
    probe('1/0 raises ZeroDivisionError', '1/0');
    probe(
      'infinite recursion raises RecursionError',
      'def f():\n    return f()\nf()',
      { fails: true }
    );
  });

  // 2.6 Comparisons and containers
  describe('2.6 Comparisons and containers', () => {
    probe("string comparison 'a' < 'b'", "print('a' < 'b')", { fails: true });
    probe('list comparison [1] < [2]', 'print([1] < [2])', { fails: true });
    probe('tuple comparison (1, 2) < (1, 3)', 'print((1, 2) < (1, 3))', { fails: true });
    probe('chained comparison 1 < x < 3', 'x = 2\nprint(1 < x < 3)');
    probe("str(12) + 'a' is '12a'", "print(str(12) + 'a')", { fails: true });
    probe("str format '%d' % 1 is '1'", "print('%d' % 1)", { fails: true });
    probe('tuple concat (1,) + (2,) is (1, 2)', 'print((1,) + (2,))', { fails: true });
    probe("dict constructor dict([('a', 1)])", "print(dict([('a', 1)]))", { fails: true });
    probe("list('abc') is ['a', 'b', 'c']", "print(list('abc'))", { fails: true });
    probe('negative index assignment a[-1] = 9', 'a = [1, 2]\na[-1] = 9\nprint(a)', { fails: true });
    probe('out of bounds assignment a[5] = 1 raises IndexError', 'a = [1, 2]\na[5] = 1', { fails: true });
    probe("dict deduplication {'a': 1, 'a': 2}", "print({'a': 1, 'a': 2})", { fails: true });
    probe("dict lookup with True key matches 1", "print({1: 'a'}[True])", { fails: true });
    probe('set deduplication {1, True}', 'print({1, True})', { fails: true });
    probe('unhashable dict key {[1]: 2} raises TypeError', '{[1]: 2}', { fails: true });
    probe('set printing order for small ints', 'print({3, 1, 2})', { fails: true });
    probe('self-referencing list prints [[...]]', 'l = []\nl.append(l)\nprint(l)', { fails: true });
    probe("unicode len('😀') is 1 (code point count)", "print(len('😀'))", { fails: true });
  });

  // 2.7 Iteration
  describe('2.7 Iteration', () => {
    probe(
      'live iteration modification skips element',
      'a = [1, 2, 3]\nfor x in a:\n    if x == 1:\n        a.remove(x)\nprint(a)'
    );
    probe('type(range(3)) is range', 'print(type(range(3)).__name__)', { fails: true });
    probe(
      'large range does not allocate or hang',
      'r = range(10**9)\nprint(type(r).__name__)',
      { fails: true }
    );
    probe(
      'for ... else executes when no break',
      'for x in [1]:\n    pass\nelse:\n    print("else")',
      { fails: true }
    );
    probe(
      'while ... else does not execute on break',
      'while True:\n    break\nelse:\n    print("else")',
      { fails: true }
    );
  });

  // 2.8 Modules
  describe('2.8 Modules', () => {
    probe('import math (sqrt, pi)', 'import math\nprint(math.sqrt(16), math.pi)', { fails: true });
    probe('import nonexistent module raises ModuleNotFoundError', 'import nonexistent_mod_xyz', { fails: true });
    probe('reduce without import raises NameError', 'reduce(lambda x, y: x, [1, 2])', { fails: true });
    probe('from math import sqrt as s alias', 'from math import sqrt as s\nprint(s(9))', { fails: true });
  });
});
