/**
 * Python lazy range object simulation.
 * Does not allocate arrays; evaluates len(), membership (in), and indexing in O(1).
 */

import { PyIndexError, PyTypeError, PyValueError } from '../errors';
import { allocObject } from '../memory';
import type { MemoryState, RtValue } from '../types';

export interface RangeValue {
  start: number;
  stop: number;
  step: number;
}

export function rangeLength(r: RangeValue): number {
  if (r.step > 0) {
    if (r.start >= r.stop) return 0;
    return Math.ceil((r.stop - r.start) / r.step);
  } else {
    if (r.start <= r.stop) return 0;
    return Math.ceil((r.start - r.stop) / -r.step);
  }
}

export function rangeContains(r: RangeValue, val: number): boolean {
  if (!Number.isInteger(val)) return false;
  if (r.step > 0) {
    if (val < r.start || val >= r.stop) return false;
    return (val - r.start) % r.step === 0;
  } else {
    if (val > r.start || val <= r.stop) return false;
    return (r.start - val) % -r.step === 0;
  }
}

export function rangeGetItem(r: RangeValue, index: number): number {
  const len = rangeLength(r);
  let idx = index;
  if (idx < 0) idx += len;
  if (idx < 0 || idx >= len) {
    throw new PyIndexError('range object index out of range');
  }
  return r.start + idx * r.step;
}

export function rangeRepr(r: RangeValue): string {
  if (r.step === 1) {
    return `range(${r.start}, ${r.stop})`;
  }
  return `range(${r.start}, ${r.stop}, ${r.step})`;
}

export function makeLazyRange(args: RtValue[], state: MemoryState, line: number): string {
  const nums: number[] = [];
  for (const a of args) {
    if (typeof a === 'number') nums.push(Math.trunc(a));
    else if (typeof a === 'bigint') nums.push(Number(a));
    else throw new PyTypeError(`'${typeof a}' object cannot be interpreted as an integer (line ${line})`);
  }

  let start = 0;
  let stop = 0;
  let step = 1;

  if (nums.length === 1) {
    stop = nums[0]!;
  } else if (nums.length === 2) {
    start = nums[0]!;
    stop = nums[1]!;
  } else if (nums.length === 3) {
    start = nums[0]!;
    stop = nums[1]!;
    step = nums[2]!;
  } else {
    throw new PyTypeError(`range expected at most 3 arguments, got ${nums.length} (line ${line})`);
  }

  if (step === 0) {
    throw new PyValueError(`range() arg 3 must not be zero (line ${line})`);
  }

  const rangeVal: RangeValue = { start, stop, step };
  const obj = allocObject('range', rangeVal, rangeRepr(rangeVal), 'heap');
  state.heap[obj.id] = obj;
  return obj.id;
}
