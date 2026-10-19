import { describe, test, expect } from 'vitest';
import { runFresh, displayValue } from '../src/engine/session';

describe('strings are heap objects (thesis-aligned)', () => {
  test('concatenation of two literals', () => {
    const s = runFresh("w = 'ab' + 'cd'");
    expect(s.heap[s.frames[0].locals.w as string].type).toBe('str');
    expect(s.heap[s.frames[0].locals.w as string].value).toBe('abcd');
  });

  test('.upper() / .lower() on a literal', () => {
    const s = runFresh("u = 'hi'.upper()");
    expect(s.heap[s.frames[0].locals.u as string].value).toBe('HI');
  });

  test('indexing a string literal', () => {
    const s = runFresh("c = 'abc'[1]");
    expect(s.heap[s.frames[0].locals.c as string].value).toBe('b');
  });

  test('substring membership  "a" in "abc"', () => {
    const s = runFresh("m = 'a' in 'abc'");
    expect(s.frames[0].locals.m).toBe(true);
  });

  test('repetition', () => {
    const s = runFresh("r = 'ab' * 3");
    expect(s.heap[s.frames[0].locals.r as string].value).toBe('ababab');
  });

  test('len of a literal', () => {
    const s = runFresh("n = len('ab')");
    expect(s.frames[0].locals.n).toBe(2);
  });

  test('two literals are separate objects (is is False)', () => {
    const s = runFresh("a = 'x'\nb = 'x'\nok = a is b");
    expect(s.frames[0].locals.ok).toBe(false);
    // but value-equal
    const s2 = runFresh("a = 'x'\nb = 'x'\neq = a == b");
    expect(s2.frames[0].locals.eq).toBe(true);
  });

  test('dict with string keys still works', () => {
    const s = runFresh("d = {'a': 1}\nk = d['a']");
    expect(s.frames[0].locals.k).toBe(1);
    expect(s.heap[s.frames[0].locals.d as string].repr).toBe("{'a': 1}");
  });

  test('pandas column read by string literal key still works', () => {
    const s = runFresh("import pandas as pd\ndf = pd.DataFrame({'x': [1, 2]})\nc = df['x']");
    expect(s.heap[s.frames[0].locals.c as string].type).toBe('series');
  });

  test('print of a string is unquoted', () => {
    const s = runFresh("print('hi')");
    expect(s.stdout).toEqual(['hi']);
  });

  test('displayValue of a bound string is repr-quoted', () => {
    const s = runFresh("w = 'hi'");
    expect(displayValue(s.frames[0].locals.w, s)).toBe("'hi'");
  });
});
