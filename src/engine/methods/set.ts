/**
 * Built-in set method implementations.
 */

import { allocObject } from '../memory';
import { findIndexOfValue, formatObject } from '../common';
import type { HeapObject, MemoryState, RtValue } from '../types';

/**
 * Dispatch set method calls.
 */
export function callSetMethod(obj: HeapObject, method: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  const value = obj.value as RtValue[];

  if (method === 'add') {
    if (findIndexOfValue(value, args[0], state) < 0) {
      value.push(args[0]);
    }
    obj.repr = formatObject(obj, state);
    return null;
  }

  if (method === 'remove') {
    const idx = findIndexOfValue(value, args[0], state);
    if (idx < 0) throw new Error(`KeyError: ${args[0]} (line ${line})`);
    value.splice(idx, 1);
    obj.repr = formatObject(obj, state);
    return null;
  }

  if (method === 'discard') {
    const idx = findIndexOfValue(value, args[0], state);
    if (idx >= 0) {
      value.splice(idx, 1);
      obj.repr = formatObject(obj, state);
    }
    return null;
  }

  if (method === 'pop') {
    if (value.length === 0) throw new Error(`KeyError: 'pop from an empty set' (line ${line})`);
    const popped = value.pop()!;
    obj.repr = formatObject(obj, state);
    return popped;
  }

  if (method === 'clear') {
    value.length = 0;
    obj.repr = formatObject(obj, state);
    return null;
  }

  if (method === 'copy') {
    const clone = allocObject('set', [...value], '');
    state.heap[clone.id] = clone;
    clone.repr = formatObject(clone, state);
    return clone.id;
  }

  throw new Error(`AttributeError: 'set' object has no attribute '${method}' (line ${line})`);
}
