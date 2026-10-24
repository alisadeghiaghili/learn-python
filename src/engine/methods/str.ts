/**
 * Python string method implementations.
 */

import { PyTypeError } from '../errors';
import { allocObject } from '../memory';
import type { HeapObject, MemoryState, RtValue } from '../types';

export function callStrMethod(
  objId: string,
  method: string,
  args: RtValue[],
  state: MemoryState,
  line: number,
  allocString: (s: string, state: MemoryState) => string,
  formatObject: (obj: HeapObject, state: MemoryState) => string
): RtValue {
  const obj = state.heap[objId];
  const s = obj && obj.type === 'str' ? (obj.value as string) : String(objId);

  const strArg = (v: RtValue): string => {
    if (typeof v === 'string') {
      const targetObj = state.heap[v];
      if (targetObj && targetObj.type === 'str') return targetObj.value as string;
      return v;
    }
    throw new PyTypeError(`must be str, not ${typeof v} (line ${line})`);
  };

  switch (method) {
    case 'lower':
      return allocString(s.toLowerCase(), state);
    case 'upper':
      return allocString(s.toUpperCase(), state);
    case 'strip': {
      const chars = args.length > 0 ? strArg(args[0]!) : null;
      if (!chars) return allocString(s.trim(), state);
      let start = 0;
      while (start < s.length && chars.includes(s[start]!)) start++;
      let end = s.length;
      while (end > start && chars.includes(s[end - 1]!)) end--;
      return allocString(s.slice(start, end), state);
    }
    case 'split': {
      const sep = args.length > 0 ? strArg(args[0]!) : ' ';
      const parts = sep === ' ' ? s.trim().split(/\s+/) : s.split(sep);
      const strIds = parts.map((p) => allocString(p, state));
      const listObj = allocObject('list', strIds, '', 'heap');
      state.heap[listObj.id] = listObj;
      listObj.repr = formatObject(listObj, state);
      return listObj.id;
    }
    case 'join': {
      if (args.length !== 1) throw new PyTypeError(`join() takes exactly one argument (${args.length} given) (line ${line})`);
      const iterId = args[0] as string;
      const iterObj = state.heap[iterId];
      if (!iterObj || !Array.isArray(iterObj.value)) {
        throw new PyTypeError(`can only join an iterable (line ${line})`);
      }
      const elts = (iterObj.value as RtValue[]).map((e) => {
        if (typeof e === 'string') {
          const itemObj = state.heap[e];
          if (itemObj && itemObj.type === 'str') return itemObj.value as string;
          return e;
        }
        throw new PyTypeError(`sequence item: expected str instance, ${typeof e} found (line ${line})`);
      });
      return allocString(elts.join(s), state);
    }
    case 'replace': {
      if (args.length < 2) throw new PyTypeError(`replace() takes at least 2 arguments (line ${line})`);
      const oldStr = strArg(args[0]!);
      const newStr = strArg(args[1]!);
      return allocString(s.split(oldStr).join(newStr), state);
    }
    case 'startswith': {
      if (args.length < 1) throw new PyTypeError(`startswith() takes at least 1 argument (line ${line})`);
      return s.startsWith(strArg(args[0]!));
    }
    case 'endswith': {
      if (args.length < 1) throw new PyTypeError(`endswith() takes at least 1 argument (line ${line})`);
      return s.endsWith(strArg(args[0]!));
    }
    case 'find': {
      if (args.length < 1) throw new PyTypeError(`find() takes at least 1 argument (line ${line})`);
      return s.indexOf(strArg(args[0]!));
    }
    case 'count': {
      if (args.length < 1) throw new PyTypeError(`count() takes at least 1 argument (line ${line})`);
      const sub = strArg(args[0]!);
      if (!sub) return s.length + 1;
      return s.split(sub).length - 1;
    }
    default:
      throw new PyTypeError(`'str' object has no attribute '${method}' (line ${line})`);
  }
}
