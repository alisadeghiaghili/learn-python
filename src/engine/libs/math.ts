/**
 * Math module emulation.
 */

import { derefNumber } from '../common';
import { allocFloat } from '../builtins';
import type { MemoryState, RtValue } from '../types';

export const MATH_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
  inf: Infinity,
  nan: NaN,
};

/**
 * Dispatch calls to math module functions.
 */
export function dispatchMathFunction(
  fn: string,
  args: RtValue[],
  state: MemoryState,
  line: number,
): RtValue {
  if (fn === 'sqrt') {
    if (args.length !== 1) throw new Error(`TypeError: sqrt() takes exactly one argument (line ${line})`);
    const val = derefNumber(args[0], state);
    if (val < 0) throw new Error(`ValueError: math domain error (line ${line})`);
    return allocFloat(Math.sqrt(val), state);
  }

  if (fn === 'floor') {
    if (args.length !== 1) throw new Error(`TypeError: floor() takes exactly one argument (line ${line})`);
    return Math.floor(derefNumber(args[0], state));
  }

  if (fn === 'ceil') {
    if (args.length !== 1) throw new Error(`TypeError: ceil() takes exactly one argument (line ${line})`);
    return Math.ceil(derefNumber(args[0], state));
  }

  if (fn === 'isclose') {
    if (args.length < 2) throw new Error(`TypeError: isclose() takes at least two arguments (line ${line})`);
    const a = derefNumber(args[0], state);
    const b = derefNumber(args[1], state);
    const relTol = args.length > 2 ? derefNumber(args[2], state) : 1e-9;
    const absTol = args.length > 3 ? derefNumber(args[3], state) : 0.0;
    return Math.abs(a - b) <= Math.max(relTol * Math.max(Math.abs(a), Math.abs(b)), absTol);
  }

  if (fn === 'sin') {
    return allocFloat(Math.sin(derefNumber(args[0], state)), state);
  }

  if (fn === 'cos') {
    return allocFloat(Math.cos(derefNumber(args[0], state)), state);
  }

  if (fn === 'tan') {
    return allocFloat(Math.tan(derefNumber(args[0], state)), state);
  }

  if (fn === 'log') {
    return allocFloat(Math.log(derefNumber(args[0], state)), state);
  }

  if (fn === 'exp') {
    return allocFloat(Math.exp(derefNumber(args[0], state)), state);
  }

  if (fn === 'pow') {
    return allocFloat(Math.pow(derefNumber(args[0], state), derefNumber(args[1], state)), state);
  }

  throw new Error(`AttributeError: module 'math' has no attribute '${fn}' (line ${line})`);
}
