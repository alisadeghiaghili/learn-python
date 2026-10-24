/**
 * Built-in list method implementations.
 */

import { allocObject } from '../memory';
import { findIndexOfValue, formatObject } from '../common';
import type { HeapObject, MemoryState, RtValue } from '../types';

/**
 * Dispatch list method calls.
 */
export function callListMethod(obj: HeapObject, method: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  const value = obj.value as RtValue[];

  if (method === 'append') {
    value.push(args[0]);
    obj.repr = formatObject(obj, state);
    return null;
  }

  if (method === 'pop') {
    if (value.length === 0) {
      throw new Error(`IndexError: pop from empty list (line ${line})`);
    }
    const idx = args.length > 0 ? Number(args[0]) : value.length - 1;
    const resolvedIdx = idx < 0 ? value.length + idx : idx;
    if (resolvedIdx < 0 || resolvedIdx >= value.length) {
      throw new Error(`IndexError: pop index out of range (line ${line})`);
    }
    const popped = value.splice(resolvedIdx, 1)[0] as RtValue;
    obj.repr = formatObject(obj, state);
    return popped;
  }

  if (method === 'extend') {
    const src = typeof args[0] === 'string' ? state.heap[args[0]] : undefined;
    if (!src || !['list', 'tuple', 'set'].includes(src.type)) {
      throw new Error(`TypeError: extend() requires an iterable (line ${line})`);
    }
    value.push(...(src.value as RtValue[]));
    obj.repr = formatObject(obj, state);
    return null;
  }

  if (method === 'insert') {
    value.splice(Number(args[0]), 0, args[1]);
    obj.repr = formatObject(obj, state);
    return null;
  }

  if (method === 'remove') {
    const idx = findIndexOfValue(value, args[0], state);
    if (idx < 0) throw new Error(`ValueError: list.remove(x): x not in list (line ${line})`);
    value.splice(idx, 1);
    obj.repr = formatObject(obj, state);
    return null;
  }

  if (method === 'clear') {
    obj.value = [];
    obj.repr = formatObject(obj, state);
    return null;
  }

  if (method === 'copy') {
    const clone = allocObject('list', [...value], '');
    state.heap[clone.id] = clone;
    clone.repr = formatObject(clone, state);
    return clone.id;
  }

  if (method === 'reverse') {
    value.reverse();
    obj.repr = formatObject(obj, state);
    return null;
  }

  if (method === 'count') {
    let count = 0;
    for (const item of value) {
      if (item === args[0]) count++;
    }
    return count;
  }

  if (method === 'index') {
    const idx = findIndexOfValue(value, args[0], state);
    if (idx < 0) throw new Error(`ValueError: ${args[0]} is not in list (line ${line})`);
    return idx;
  }

  throw new Error(`AttributeError: 'list' object has no attribute '${method}' (line ${line})`);
}
