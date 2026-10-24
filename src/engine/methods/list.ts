/**
 * Python list method implementations.
 */

import { PyIndexError, PyValueError, PyTypeError } from '../errors';
import { allocObject } from '../memory';
import type { HeapObject, MemoryState, RtValue } from '../types';

export function callListMethod(
  objId: string,
  method: string,
  args: RtValue[],
  state: MemoryState,
  line: number,
  valuesEqual: (a: RtValue, b: RtValue, state: MemoryState) => boolean,
  formatObject: (obj: HeapObject, state: MemoryState) => string
): RtValue {
  const obj = state.heap[objId];
  if (!obj || obj.type !== 'list') {
    throw new PyTypeError(`object is not a list (line ${line})`);
  }
  const list = obj.value as RtValue[];

  switch (method) {
    case 'append': {
      if (args.length !== 1) throw new PyTypeError(`append() takes exactly one argument (${args.length} given) (line ${line})`);
      list.push(args[0]!);
      obj.repr = formatObject(obj, state);
      return null;
    }
    case 'extend': {
      if (args.length !== 1) throw new PyTypeError(`extend() takes exactly one argument (${args.length} given) (line ${line})`);
      const srcId = args[0] as string;
      const srcObj = state.heap[srcId];
      if (srcObj && Array.isArray(srcObj.value)) {
        list.push(...(srcObj.value as RtValue[]));
      } else if (typeof args[0] === 'string') {
        for (const ch of args[0]) list.push(ch);
      } else {
        throw new PyTypeError(`'${typeof args[0]}' object is not iterable (line ${line})`);
      }
      obj.repr = formatObject(obj, state);
      return null;
    }
    case 'insert': {
      if (args.length !== 2) throw new PyTypeError(`insert() takes exactly 2 arguments (${args.length} given) (line ${line})`);
      const idx = Number(args[0]);
      list.splice(idx, 0, args[1]!);
      obj.repr = formatObject(obj, state);
      return null;
    }
    case 'remove': {
      if (args.length !== 1) throw new PyTypeError(`remove() takes exactly one argument (${args.length} given) (line ${line})`);
      const idx = list.findIndex((x) => valuesEqual(x, args[0]!, state));
      if (idx === -1) throw new PyValueError(`list.remove(x): x not in list (line ${line})`);
      list.splice(idx, 1);
      obj.repr = formatObject(obj, state);
      return null;
    }
    case 'pop': {
      let idx = list.length - 1;
      if (args.length > 0) idx = Number(args[0]);
      if (idx < 0) idx += list.length;
      if (list.length === 0 || idx < 0 || idx >= list.length) {
        throw new PyIndexError(`pop from empty list or index out of range (line ${line})`);
      }
      const val = list.splice(idx, 1)[0]!;
      obj.repr = formatObject(obj, state);
      return val;
    }
    case 'clear': {
      list.length = 0;
      obj.repr = formatObject(obj, state);
      return null;
    }
    case 'index': {
      if (args.length < 1) throw new PyTypeError(`index() takes at least 1 argument (0 given) (line ${line})`);
      const idx = list.findIndex((x) => valuesEqual(x, args[0]!, state));
      if (idx === -1) throw new PyValueError(`'${args[0]}' is not in list (line ${line})`);
      return idx;
    }
    case 'count': {
      if (args.length !== 1) throw new PyTypeError(`count() takes exactly one argument (${args.length} given) (line ${line})`);
      return list.filter((x) => valuesEqual(x, args[0]!, state)).length;
    }
    case 'reverse': {
      list.reverse();
      obj.repr = formatObject(obj, state);
      return null;
    }
    case 'sort': {
      list.sort((a, b) => {
        const valA = a === null ? '' : a;
        const valB = b === null ? '' : b;
        return valA < valB ? -1 : valA > valB ? 1 : 0;
      });
      obj.repr = formatObject(obj, state);
      return null;
    }
    case 'copy': {
      const copy = allocObject('list', [...list], '', 'heap');
      state.heap[copy.id] = copy;
      copy.repr = formatObject(copy, state);
      return copy.id;
    }
    default:
      throw new PyTypeError(`'list' object has no attribute '${method}' (line ${line})`);
  }
}
