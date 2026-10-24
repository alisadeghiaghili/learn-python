/**
 * Python dict key normalization and method implementations.
 */

import { PyKeyError, PyTypeError } from '../errors';
import { allocObject } from '../memory';
import type { HeapObject, MemoryState, RtValue } from '../types';

/**
 * Compute the CPython dictionary/set key for a value.
 * In Python, `1 == True` and `hash(1) == hash(True)`, so `1` and `True` collide in dicts/sets.
 * Similarly `0 == False`.
 * Mutable containers (list, dict, set) are unhashable and raise TypeError.
 */
export function dictKeyRepr(k: RtValue, state: MemoryState, line?: number): string {
  if (k === null) return 'none:None';
  if (k === true || k === false) {
    return `num:${k ? 1 : 0}`;
  }
  if (typeof k === 'number' || typeof k === 'bigint') {
    return `num:${k}`;
  }
  if (typeof k === 'string') {
    const obj = state.heap[k];
    if (obj) {
      if (obj.type === 'list' || obj.type === 'dict' || obj.type === 'set' || obj.type === 'defaultdict') {
        throw new PyTypeError(`unhashable type: '${obj.type}'${line ? ` (line ${line})` : ''}`);
      }
      if (obj.type === 'tuple') {
        const elts = obj.value as RtValue[];
        return `tuple:(${elts.map((e) => dictKeyRepr(e, state, line)).join(',')})`;
      }
      if (obj.type === 'str') {
        return `str:${obj.value as string}`;
      }
      if (obj.type === 'float') {
        const n = obj.value as number;
        return `num:${n}`;
      }
    }
    return `str:${k}`;
  }
  return `val:${String(k)}`;
}

export function callDictMethod(
  objId: string,
  method: string,
  args: RtValue[],
  state: MemoryState,
  line: number,
  formatObject: (obj: HeapObject, state: MemoryState) => string
): RtValue {
  const obj = state.heap[objId];
  if (!obj || (obj.type !== 'dict' && obj.type !== 'defaultdict')) {
    throw new PyTypeError(`object is not a dict (line ${line})`);
  }
  const entries = obj.value as Array<[string, RtValue]>;

  switch (method) {
    case 'get': {
      if (args.length < 1 || args.length > 2) {
        throw new PyTypeError(`get() takes at most 2 arguments (${args.length} given) (line ${line})`);
      }
      const key = dictKeyRepr(args[0]!, state, line);
      const defaultVal = args.length === 2 ? args[1]! : null;
      const found = entries.find(([k]) => k === key);
      return found ? found[1] : defaultVal;
    }
    case 'keys': {
      const keys = entries.map(([k]) => {
        if (k.startsWith('str:')) return k.slice(4);
        if (k.startsWith('num:')) return Number(k.slice(4));
        return k;
      });
      const listObj = allocObject('list', keys, '', 'heap');
      state.heap[listObj.id] = listObj;
      listObj.repr = formatObject(listObj, state);
      return listObj.id;
    }
    case 'values': {
      const vals = entries.map(([, v]) => v);
      const listObj = allocObject('list', vals, '', 'heap');
      state.heap[listObj.id] = listObj;
      listObj.repr = formatObject(listObj, state);
      return listObj.id;
    }
    case 'items': {
      const pairs = entries.map(([k, v]) => {
        const keyVal = k.startsWith('str:') ? k.slice(4) : k.startsWith('num:') ? Number(k.slice(4)) : k;
        const tupleObj = allocObject('tuple', [keyVal, v], `(${keyVal}, ${v})`, 'heap');
        state.heap[tupleObj.id] = tupleObj;
        return tupleObj.id;
      });
      const listObj = allocObject('list', pairs, '', 'heap');
      state.heap[listObj.id] = listObj;
      listObj.repr = formatObject(listObj, state);
      return listObj.id;
    }
    case 'pop': {
      if (args.length < 1 || args.length > 2) {
        throw new PyTypeError(`pop() takes at most 2 arguments (${args.length} given) (line ${line})`);
      }
      const key = dictKeyRepr(args[0]!, state, line);
      const idx = entries.findIndex(([k]) => k === key);
      if (idx === -1) {
        if (args.length === 2) return args[1]!;
        throw new PyKeyError(String(args[0]));
      }
      const removed = entries.splice(idx, 1)[0]![1];
      obj.repr = formatObject(obj, state);
      return removed;
    }
    case 'clear': {
      entries.length = 0;
      obj.repr = formatObject(obj, state);
      return null;
    }
    case 'copy': {
      const copyEntries = entries.map(([k, v]) => [k, v] as [string, RtValue]);
      const copyObj = allocObject('dict', copyEntries, '', 'heap');
      state.heap[copyObj.id] = copyObj;
      copyObj.repr = formatObject(copyObj, state);
      return copyObj.id;
    }
    case 'update': {
      if (args.length !== 1) {
        throw new PyTypeError(`update() takes exactly one argument (${args.length} given) (line ${line})`);
      }
      const srcId = args[0] as string;
      const src = typeof srcId === 'string' ? state.heap[srcId] : null;
      if (!src || src.type !== 'dict') {
        throw new PyTypeError(`update() requires a dict (line ${line})`);
      }
      const srcEntries = src.value as Array<[string, RtValue]>;
      for (const [k, v] of srcEntries) {
        const existing = entries.find(([ek]) => ek === k);
        if (existing) existing[1] = v;
        else entries.push([k, v]);
      }
      obj.repr = formatObject(obj, state);
      return null;
    }
    default:
      throw new PyTypeError(`'dict' object has no attribute '${method}' (line ${line})`);
  }
}
