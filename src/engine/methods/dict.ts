/**
 * Built-in dict method implementations.
 */

import { allocObject } from '../memory';
import { allocString, dictKeyMatch, dictKeyRepr, formatObject } from '../common';
import type { HeapObject, MemoryState, RtValue } from '../types';

/**
 * Dispatch dict method calls.
 */
export function callDictMethod(obj: HeapObject, method: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  const entries = obj.value as Array<[string, RtValue]>;

  if (method === 'keys') {
    const out = allocObject('list', entries.map(([k]) => allocString(k, state)), '');
    state.heap[out.id] = out;
    out.repr = formatObject(out, state);
    return out.id;
  }

  if (method === 'values') {
    const out = allocObject('list', entries.map(([, v]) => v), '');
    state.heap[out.id] = out;
    out.repr = formatObject(out, state);
    return out.id;
  }

  if (method === 'items') {
    const tuples = entries.map(([k, v]) => {
      const kStr = allocString(k, state);
      const tup = allocObject('tuple', [kStr, v], '');
      state.heap[tup.id] = tup;
      tup.repr = formatObject(tup, state);
      return tup.id;
    });
    const out = allocObject('list', tuples, '');
    state.heap[out.id] = out;
    out.repr = formatObject(out, state);
    return out.id;
  }

  if (method === 'get') {
    const key = args[0];
    const keyRepr = dictKeyRepr(key, state);
    const found = (entries as Array<[string, RtValue, RtValue?]>).find(([k, , ok]) => dictKeyMatch(k, ok, key, keyRepr, state));
    return found ? found[1] : (args.length > 1 ? args[1] : null);
  }

  if (method === 'update') {
    const src = typeof args[0] === 'string' ? state.heap[args[0]] : undefined;
    if (!src || src.type !== 'dict') throw new Error(`TypeError: update() requires a dict (line ${line})`);
    const srcEntries = src.value as Array<[string, RtValue]>;
    for (const [k, v] of srcEntries) {
      const existing = entries.find(([ek]) => ek === k);
      if (existing) existing[1] = v;
      else entries.push([k, v]);
    }
    obj.repr = formatObject(obj, state);
    return null;
  }

  if (method === 'pop') {
    const key = args[0];
    const keyRepr = dictKeyRepr(key, state);
    const idx = (entries as Array<[string, RtValue, RtValue?]>).findIndex(([k, , ok]) => dictKeyMatch(k, ok, key, keyRepr, state));
    if (idx < 0) {
      if (args.length > 1) return args[1];
      throw new Error(`KeyError: ${keyRepr} (line ${line})`);
    }
    const [, v] = entries.splice(idx, 1)[0]!;
    obj.repr = formatObject(obj, state);
    return v;
  }

  if (method === 'copy') {
    const clone = allocObject('dict', entries.map(([k, v]) => [k, v] as [string, RtValue]), '');
    state.heap[clone.id] = clone;
    clone.repr = formatObject(clone, state);
    return clone.id;
  }

  if (method === 'clear') {
    entries.length = 0;
    obj.repr = formatObject(obj, state);
    return null;
  }

  throw new Error(`AttributeError: 'dict' object has no attribute '${method}' (line ${line})`);
}
