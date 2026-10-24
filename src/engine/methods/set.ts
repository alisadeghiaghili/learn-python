/**
 * Python set method implementations and set operations.
 */

import { PyKeyError, PyTypeError } from '../errors';
import { allocObject } from '../memory';
import type { HeapObject, MemoryState, RtValue } from '../types';
import { dictKeyRepr } from './dict';

export function callSetMethod(
  objId: string,
  method: string,
  args: RtValue[],
  state: MemoryState,
  line: number,
  formatObject: (obj: HeapObject, state: MemoryState) => string
): RtValue {
  const obj = state.heap[objId];
  if (!obj || obj.type !== 'set') {
    throw new PyTypeError(`object is not a set (line ${line})`);
  }
  const set = obj.value as RtValue[];

  const findIdx = (val: RtValue) => {
    const key = dictKeyRepr(val, state, line);
    return set.findIndex((x) => dictKeyRepr(x, state) === key);
  };

  switch (method) {
    case 'add': {
      if (args.length !== 1) throw new PyTypeError(`add() takes exactly one argument (${args.length} given) (line ${line})`);
      if (findIdx(args[0]!) === -1) {
        set.push(args[0]!);
        obj.repr = formatObject(obj, state);
      }
      return null;
    }
    case 'remove': {
      if (args.length !== 1) throw new PyTypeError(`remove() takes exactly one argument (${args.length} given) (line ${line})`);
      const idx = findIdx(args[0]!);
      if (idx === -1) throw new PyKeyError(String(args[0]));
      set.splice(idx, 1);
      obj.repr = formatObject(obj, state);
      return null;
    }
    case 'discard': {
      if (args.length !== 1) throw new PyTypeError(`discard() takes exactly one argument (${args.length} given) (line ${line})`);
      const idx = findIdx(args[0]!);
      if (idx !== -1) {
        set.splice(idx, 1);
        obj.repr = formatObject(obj, state);
      }
      return null;
    }
    case 'pop': {
      if (set.length === 0) throw new PyKeyError('pop from an empty set');
      const val = set.pop()!;
      obj.repr = formatObject(obj, state);
      return val;
    }
    case 'clear': {
      set.length = 0;
      obj.repr = formatObject(obj, state);
      return null;
    }
    case 'union': {
      const merged = [...set];
      for (const arg of args) {
        const otherObj = state.heap[arg as string];
        const otherElts = otherObj && Array.isArray(otherObj.value) ? (otherObj.value as RtValue[]) : [];
        for (const e of otherElts) {
          const k = dictKeyRepr(e, state, line);
          if (!merged.some((x) => dictKeyRepr(x, state) === k)) {
            merged.push(e);
          }
        }
      }
      const out = allocObject('set', merged, '', 'heap');
      state.heap[out.id] = out;
      out.repr = formatObject(out, state);
      return out.id;
    }
    case 'intersection': {
      let common = [...set];
      for (const arg of args) {
        const otherObj = state.heap[arg as string];
        const otherElts = otherObj && Array.isArray(otherObj.value) ? (otherObj.value as RtValue[]) : [];
        const otherKeys = new Set(otherElts.map((e) => dictKeyRepr(e, state, line)));
        common = common.filter((x) => otherKeys.has(dictKeyRepr(x, state)));
      }
      const out = allocObject('set', common, '', 'heap');
      state.heap[out.id] = out;
      out.repr = formatObject(out, state);
      return out.id;
    }
    case 'difference': {
      let diff = [...set];
      for (const arg of args) {
        const otherObj = state.heap[arg as string];
        const otherElts = otherObj && Array.isArray(otherObj.value) ? (otherObj.value as RtValue[]) : [];
        const otherKeys = new Set(otherElts.map((e) => dictKeyRepr(e, state, line)));
        diff = diff.filter((x) => !otherKeys.has(dictKeyRepr(x, state)));
      }
      const out = allocObject('set', diff, '', 'heap');
      state.heap[out.id] = out;
      out.repr = formatObject(out, state);
      return out.id;
    }
    case 'symmetric_difference': {
      if (args.length !== 1) throw new PyTypeError(`symmetric_difference() takes exactly one argument (${args.length} given) (line ${line})`);
      const otherObj = state.heap[args[0] as string];
      const otherElts = otherObj && Array.isArray(otherObj.value) ? (otherObj.value as RtValue[]) : [];
      const setKeys = new Set(set.map((e) => dictKeyRepr(e, state)));
      const otherKeys = new Set(otherElts.map((e) => dictKeyRepr(e, state, line)));

      const sym: RtValue[] = [];
      for (const e of set) if (!otherKeys.has(dictKeyRepr(e, state))) sym.push(e);
      for (const e of otherElts) if (!setKeys.has(dictKeyRepr(e, state))) sym.push(e);

      const out = allocObject('set', sym, '', 'heap');
      state.heap[out.id] = out;
      out.repr = formatObject(out, state);
      return out.id;
    }
    default:
      throw new PyTypeError(`'set' object has no attribute '${method}' (line ${line})`);
  }
}
