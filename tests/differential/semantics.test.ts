/**
 * Differential semantics test suite.
 *
 * Runs Phase 2 probes through both real CPython >= 3.12 and the simulator.
 * In Phase 1, known failing probes are marked with it.fails temporarily;
 * by the end of Phase 2, all must pass natively.
 */

import { describe, it, expect } from 'vitest';
import { locateCPython, runCPython } from './cpython';
import { runSimulator } from './simulator';

const hasCPython = locateCPython() !== null;

/**
 * Compare simulator execution against CPython.
 *
 * Verifies exact exception type when an error is raised,
 * or exact stdout when execution succeeds.
 *
 * @param source - Python source code string.
 */
function assertDifferentialMatch(source: string): void {
  const py = runCPython(source);
  const sim = runSimulator(source);

  if (py.exceptionType !== null) {
    expect(sim.exceptionType, `Expected ${py.exceptionType} but got ${sim.exceptionType}\nCode:\n${source}`).toBe(py.exceptionType);
  } else {
    expect(sim.exceptionType, `Unexpected exception ${sim.exceptionType} (CPython succeeded)\nCode:\n${source}`).toBeNull();
    expect(sim.stdout, `Stdout mismatch for:\n${source}`).toBe(py.stdout);
  }
}

describe.skipIf(!hasCPython)('differential semantics (Phase 2 probes)', () => {
  describe('2.1 Object model and identity', () => {
    it('x = 3; y = x; x is y', () => {
      assertDifferentialMatch('x = 3\ny = x\nprint(x is y)');
    });

    it.fails('id(3) returns an int', () => {
      assertDifferentialMatch('print(isinstance(id(3), int))');
    });

    it('small-int caching: 100 is 100', () => {
      assertDifferentialMatch('x = 100\ny = 100\nprint(x is y)');
    });

    it('small-int caching: -5 is -5', () => {
      assertDifferentialMatch('x = -5\ny = -5\nprint(x is y)');
    });

    it('small-int caching: 256 is 256', () => {
      assertDifferentialMatch('x = 256\ny = 256\nprint(x is y)');
    });

    it('large int equality check', () => {
      assertDifferentialMatch('x = 1000\ny = 1000\nprint(x == y)');
    });
  });

  describe('2.2 Augmented assignment', () => {
    it.fails('list in-place augmented addition mutates', () => {
      assertDifferentialMatch('a = [1]\nb = a\na += [2]\nprint(b)');
    });

    it.fails('list in-place augmented multiplication mutates', () => {
      assertDifferentialMatch('a = [1]\nb = a\na *= 2\nprint(b)');
    });

    it('tuple augmented assignment rebinds', () => {
      assertDifferentialMatch('t = (1,)\nu = t\nt += (2,)\nprint(u, t is u)');
    });

    it.fails('numpy array slice view augmented assignment', () => {
      assertDifferentialMatch('import numpy as np\na = np.array([1, 2, 3])\nv = a[:2]\nv += 10\nprint(a)');
    });

    it.fails('list += accepts tuple iterable', () => {
      assertDifferentialMatch('x = [1]\nx += (2,)\nprint(x)');
    });

    it.fails('list + tuple raises TypeError', () => {
      assertDifferentialMatch('x = [1]\nx = x + (2,)');
    });
  });

  describe('2.3 Scope', () => {
    it.fails('unbound local detection raises UnboundLocalError', () => {
      assertDifferentialMatch('x = 1\ndef f():\n    x = x + 1\n    return x\nf()');
    });

    it.fails('global statement allows rebinding outer name', () => {
      assertDifferentialMatch('x = 1\ndef f():\n    global x\n    x = x + 1\n    return x\nprint(f(), x)');
    });

    it.fails('closures and nonlocal modification', () => {
      assertDifferentialMatch('def outer():\n    x = 10\n    def inner():\n        nonlocal x\n        x += 1\n        return x\n    return inner\nf = outer()\nprint(f(), f())');
    });

    it.fails('mutable default argument trap', () => {
      assertDifferentialMatch('def f(a=[]):\n    a.append(1)\n    return a\nprint(f())\nprint(f())');
    });
  });

  describe('2.4 Numbers', () => {
    it.fails('arbitrary precision: 2**64', () => {
      assertDifferentialMatch('print(2**64)');
    });

    it.fails('arbitrary precision: 2**100', () => {
      assertDifferentialMatch('print(2**100)');
    });

    it.fails('float division produces float 2.0', () => {
      assertDifferentialMatch('print(6/3)');
    });

    it.fails('type(6/3) is float', () => {
      assertDifferentialMatch("print(type(6/3))");
    });

    it.fails('type(3.0) is float', () => {
      assertDifferentialMatch("print(type(3.0))");
    });

    it('integer floor division 7//2', () => {
      assertDifferentialMatch('print(7//2)');
    });

    it('negative floor division -7//2', () => {
      assertDifferentialMatch('print(-7//2)');
    });

    it('negative modulo -7 % 3', () => {
      assertDifferentialMatch('print(-7 % 3)');
    });

    it.fails('scientific notation 1e5', () => {
      assertDifferentialMatch('print(1e5)');
    });

    it.fails('hex literal 0x10', () => {
      assertDifferentialMatch('print(0x10)');
    });

    it('underscore integer literal 1_000', () => {
      assertDifferentialMatch('print(1_000)');
    });

    it('bool is subclass of int: True + 1', () => {
      assertDifferentialMatch('print(True + 1)');
    });

    it('float round-trip representation 0.1 + 0.2', () => {
      assertDifferentialMatch('print(0.1 + 0.2)');
    });
  });

  describe('2.5 Errors instead of silent NaN / garbage', () => {
    it.fails('string + int raises TypeError', () => {
      assertDifferentialMatch("'a' + 1");
    });

    it.fails("int('x') raises ValueError", () => {
      assertDifferentialMatch("int('x')");
    });

    it.fails("-[1] raises TypeError", () => {
      assertDifferentialMatch("-[1]");
    });

    it.fails("1 < 'a' raises TypeError", () => {
      assertDifferentialMatch("1 < 'a'");
    });

    it.fails("None.foo raises AttributeError", () => {
      assertDifferentialMatch("None.foo");
    });

    it("[1][5] raises IndexError", () => {
      assertDifferentialMatch("[1][5]");
    });

    it("{}['k'] raises KeyError", () => {
      assertDifferentialMatch("{}['k']");
    });

    it("1 / 0 raises ZeroDivisionError", () => {
      assertDifferentialMatch("1 / 0");
    });

    it.fails("infinite recursion raises RecursionError", () => {
      assertDifferentialMatch("def rec():\n    return rec()\nrec()");
    });
  });

  describe('2.6 Comparisons and containers', () => {
    it.fails("'a' < 'b' lexicographic str comparison", () => {
      assertDifferentialMatch("print('a' < 'b')");
    });

    it.fails("[1] < [2] list comparison", () => {
      assertDifferentialMatch("print([1] < [2])");
    });

    it.fails("(1, 2) < (1, 3) tuple comparison", () => {
      assertDifferentialMatch("print((1, 2) < (1, 3))");
    });

    it("chained comparison 1 < x < 3", () => {
      assertDifferentialMatch("x = 2\nprint(1 < x < 3)");
    });

    it.fails("str(12) + 'a'", () => {
      assertDifferentialMatch("print(str(12) + 'a')");
    });

    it.fails("type(str(12)) is str", () => {
      assertDifferentialMatch("print(type(str(12)))");
    });

    it.fails("string formatting with %d", () => {
      assertDifferentialMatch("print('%d' % 1)");
    });

    it.fails("(1,) + (2,) tuple concatenation", () => {
      assertDifferentialMatch("print((1,) + (2,))");
    });

    it.fails("dict([('a', 1)]) constructor", () => {
      assertDifferentialMatch("print(dict([('a', 1)]))");
    });

    it.fails("list('abc') constructor", () => {
      assertDifferentialMatch("print(list('abc'))");
    });

    it.fails("negative index assignment a[-1] = 9", () => {
      assertDifferentialMatch("a = [1, 2]\na[-1] = 9\nprint(a)");
    });

    it.fails("out-of-bounds assignment raises IndexError", () => {
      assertDifferentialMatch("a = [1]\na[5] = 1");
    });

    it.fails("duplicate dict keys keep last value", () => {
      assertDifferentialMatch("print({'a': 1, 'a': 2})");
    });

    it.fails("dict key hashing treats 1 and True as equal", () => {
      assertDifferentialMatch("print({1: 'a'}[True])");
    });

    it.fails("set deduplication treats 1 and True as equal", () => {
      assertDifferentialMatch("print({1, True})");
    });

    it.fails("unhashable list in dict raises TypeError", () => {
      assertDifferentialMatch("{[1]: 2}");
    });

    it.fails("set ordering for small integers", () => {
      assertDifferentialMatch("print({3, 1, 2})");
    });

    it.fails("self-referencing container repr", () => {
      assertDifferentialMatch("l = []\nl.append(l)\nprint(l)");
    });

    it.fails("unicode emoji length len('😀')", () => {
      assertDifferentialMatch("print(len('😀'))");
    });
  });

  describe('2.7 Iteration', () => {
    it('for loop iterates live object after in-place mutation', () => {
      assertDifferentialMatch('a = [1, 2, 3]\nfor x in a:\n    if x == 1:\n        a.remove(x)\nprint(a)');
    });

    it.fails('type(range(3)) is range object', () => {
      assertDifferentialMatch('print(type(range(3)))');
    });

    it.fails('range(10**9) lazy evaluation without memory allocation', () => {
      assertDifferentialMatch('print(range(10**9).stop)');
    });

    it.fails('for ... else executed when no break occurs', () => {
      assertDifferentialMatch('for x in [1]:\n    pass\nelse:\n    print("done")');
    });

    it.fails('while ... else executed when condition is false', () => {
      assertDifferentialMatch('while False:\n    pass\nelse:\n    print("done")');
    });
  });

  describe('2.8 Modules', () => {
    it.fails('import math provides sqrt, floor and pi', () => {
      assertDifferentialMatch('import math\nprint(math.sqrt(4), math.floor(3.7), math.pi > 3)');
    });

    it.fails('import non-existent module raises ModuleNotFoundError', () => {
      assertDifferentialMatch('import non_existent_mod_xyz');
    });

    it('reduce without import raises NameError', () => {
      assertDifferentialMatch('reduce');
    });

    it.fails('from math import sqrt', () => {
      assertDifferentialMatch('from math import sqrt\nprint(sqrt(9))');
    });

    it.fails('import math as m', () => {
      assertDifferentialMatch('import math as m\nprint(m.sqrt(16))');
    });
  });
});
