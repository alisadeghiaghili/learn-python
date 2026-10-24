/**
 * Built-in str method implementations.
 */

import { allocObject } from '../memory';
import { allocString, formatObject } from '../common';
import type { HeapObject, MemoryState, RtValue } from '../types';

/**
 * Dispatch str method calls.
 */
export function callStrMethod(obj: HeapObject, method: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  const s = obj.value as string;

  if (method === 'upper') {
    return allocString(s.toUpperCase(), state);
  }

  if (method === 'lower') {
    return allocString(s.toLowerCase(), state);
  }

  if (method === 'strip') {
    const chars = args.length > 0 && typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str'
      ? (state.heap[args[0]].value as string)
      : undefined;
    if (chars === undefined) {
      return allocString(s.trim(), state);
    }
    const regex = new RegExp(`^[${chars}]+|[${chars}]+$`, 'g');
    return allocString(s.replace(regex, ''), state);
  }

  if (method === 'split') {
    const sep = args.length > 0 && typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str'
      ? (state.heap[args[0]].value as string)
      : ' ';
    const parts = s.split(sep);
    const heapParts = parts.map((p) => allocString(p, state));
    const out = allocObject('list', heapParts, '');
    state.heap[out.id] = out;
    out.repr = formatObject(out, state);
    return out.id;
  }

  if (method === 'join') {
    const iterableObj = typeof args[0] === 'string' ? state.heap[args[0]] : undefined;
    if (!iterableObj || !['list', 'tuple'].includes(iterableObj.type)) {
      throw new Error(`TypeError: can only join an iterable (line ${line})`);
    }
    const rawItems = (iterableObj.value as RtValue[]).map((id) => {
      if (typeof id === 'string' && state.heap[id]?.type === 'str') {
        return state.heap[id].value as string;
      }
      throw new Error(`TypeError: sequence item is not a str (line ${line})`);
    });
    return allocString(rawItems.join(s), state);
  }

  if (method === 'replace') {
    const oldStr = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str' ? (state.heap[args[0]].value as string) : String(args[0]);
    const newStr = typeof args[1] === 'string' && state.heap[args[1]]?.type === 'str' ? (state.heap[args[1]].value as string) : String(args[1]);
    return allocString(s.replaceAll(oldStr, newStr), state);
  }

  if (method === 'startswith') {
    const prefix = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str' ? (state.heap[args[0]].value as string) : String(args[0]);
    return s.startsWith(prefix);
  }

  if (method === 'endswith') {
    const suffix = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str' ? (state.heap[args[0]].value as string) : String(args[0]);
    return s.endsWith(suffix);
  }

  if (method === 'find') {
    const sub = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str' ? (state.heap[args[0]].value as string) : String(args[0]);
    return s.indexOf(sub);
  }

  if (method === 'count') {
    const sub = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str' ? (state.heap[args[0]].value as string) : String(args[0]);
    if (!sub) return s.length + 1;
    return s.split(sub).length - 1;
  }

  throw new Error(`AttributeError: 'str' object has no attribute '${method}' (line ${line})`);
}
