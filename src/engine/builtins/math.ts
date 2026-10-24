/**
 * Python math module simulation.
 * Implements sqrt, sin, cos, pi, e, floor, ceil, log, log2, log10, factorial, gcd, comb, isclose.
 */

import { PyValueError, PyTypeError } from '../errors';

export const MATH_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
  inf: Infinity,
  nan: NaN,
};

function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw new PyTypeError(`must be real number, not ${typeof v}`);
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new PyValueError('factorial() only accepts non-negative integers');
  }
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function comb(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0) {
    throw new PyValueError('comb() only accepts non-negative integers');
  }
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let c = 1;
  for (let i = 1; i <= k; i++) {
    c = (c * (n - (k - i))) / i;
  }
  return Math.round(c);
}

function isclose(a: number, b: number, rel_tol = 1e-9, abs_tol = 0.0): boolean {
  return Math.abs(a - b) <= Math.max(rel_tol * Math.max(Math.abs(a), Math.abs(b)), abs_tol);
}

export const MATH_FUNCTIONS: Record<string, (...args: unknown[]) => number | boolean> = {
  sqrt: (x) => {
    const num = toNum(x);
    if (num < 0) throw new PyValueError('math domain error');
    return Math.sqrt(num);
  },
  sin: (x) => Math.sin(toNum(x)),
  cos: (x) => Math.cos(toNum(x)),
  floor: (x) => Math.floor(toNum(x)),
  ceil: (x) => Math.ceil(toNum(x)),
  log: (x, base) => {
    const num = toNum(x);
    if (num <= 0) throw new PyValueError('math domain error');
    if (base !== undefined) {
      const b = toNum(base);
      if (b <= 0 || b === 1) throw new PyValueError('math domain error');
      return Math.log(num) / Math.log(b);
    }
    return Math.log(num);
  },
  log2: (x) => {
    const num = toNum(x);
    if (num <= 0) throw new PyValueError('math domain error');
    return Math.log2(num);
  },
  log10: (x) => {
    const num = toNum(x);
    if (num <= 0) throw new PyValueError('math domain error');
    return Math.log10(num);
  },
  factorial: (x) => factorial(toNum(x)),
  gcd: (a, b) => gcd(toNum(a), toNum(b)),
  comb: (n, k) => comb(toNum(n), toNum(k)),
  isclose: (a, b, rel_tol, abs_tol) =>
    isclose(
      toNum(a),
      toNum(b),
      rel_tol !== undefined ? toNum(rel_tol) : 1e-9,
      abs_tol !== undefined ? toNum(abs_tol) : 0.0
    ),
};
