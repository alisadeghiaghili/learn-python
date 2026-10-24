/**
 * Built-in functions and constructor dispatch for the Python runtime.
 */

import { allocObject } from '../memory';
import {
  allocString,
  derefNumber,
  dictEntries,
  dictKeyMatch,
  dictKeyRepr,
  findIndexOfValue,
  formatObject,
  lengthOf,
  printArg,
  truthy,
  zipPoints,
} from '../common';
import type { MemoryState, RtValue } from '../types';

/**
 * Return type representation formatted like CPython: `<class 'int'>`.
 */
export function classRepr(type: string): string {
  return `<class '${type}'>`;
}

/**
 * Compute stable integer identity address for a runtime value.
 */
export function computeId(v: RtValue, state: MemoryState): number | bigint {
  if (v === null) return 0x240;
  if (typeof v === 'boolean') return v ? 0x200 : 0x220;
  if (typeof v === 'number') {
    if (Number.isInteger(v) && v >= -5 && v <= 256) {
      return 0x1000 + (v + 5) * 32;
    }
    return 0x20000 + Math.abs(Math.floor(v * 1000)) % 1000000;
  }
  if (typeof v === 'bigint') {
    return 0x50000n + (v > 0n ? v % 1000000n : (-v) % 1000000n);
  }
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    return 0x10000 + obj.addr;
  }
  return 0x90000;
}

/**
 * Return CPython-style type string for a runtime value: `<class 'int'>`.
 */
export function getPythonType(v: RtValue, state: MemoryState): string {
  if (typeof v === 'string' && state.heap[v]) {
    const t = state.heap[v].type;
    return classRepr(t);
  }
  if (v === null) return classRepr('NoneType');
  if (typeof v === 'boolean') return classRepr('bool');
  if (typeof v === 'number') return classRepr(Number.isInteger(v) ? 'int' : 'float');
  if (typeof v === 'bigint') return classRepr('int');
  if (typeof v === 'string') return classRepr('str');
  return classRepr(typeof v);
}

/**
 * Python isinstance() check.
 */
export function isInstance(v: RtValue, classinfo: RtValue, state: MemoryState, line: number): boolean {
  let targetType = '';
  if (typeof classinfo === 'string' && state.heap[classinfo]?.type === 'builtin') {
    targetType = state.heap[classinfo].value as string;
  } else if (typeof classinfo === 'string') {
    targetType = classinfo;
  }

  // Handle tuple of types
  if (typeof classinfo === 'string' && state.heap[classinfo]?.type === 'tuple') {
    const tup = state.heap[classinfo].value as RtValue[];
    return tup.some((t) => isInstance(v, t, state, line));
  }

  if (targetType === 'int') {
    // In Python, bool is a subclass of int
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number' && Number.isInteger(v)) return true;
    if (typeof v === 'bigint') return true;
    return false;
  }
  if (targetType === 'bool') return typeof v === 'boolean';
  if (targetType === 'float') {
    if (typeof v === 'number' && !Number.isInteger(v)) return true;
    if (typeof v === 'string' && state.heap[v]?.type === 'float') return true;
    return false;
  }
  if (targetType === 'str') {
    if (typeof v === 'string' && (!state.heap[v] || state.heap[v].type === 'str')) return true;
    return false;
  }
  if (targetType === 'list') return typeof v === 'string' && state.heap[v]?.type === 'list';
  if (targetType === 'tuple') return typeof v === 'string' && state.heap[v]?.type === 'tuple';
  if (targetType === 'dict') return typeof v === 'string' && state.heap[v]?.type === 'dict';
  if (targetType === 'set') return typeof v === 'string' && state.heap[v]?.type === 'set';
  if (targetType === 'range') return typeof v === 'string' && state.heap[v]?.type === 'range';

  return false;
}

export interface RangeValue {
  start: number;
  stop: number;
  step: number;
}

/**
 * Lazy range object constructor.
 */
export function makeRange(args: RtValue[], state: MemoryState, line: number): RtValue {
  let start = 0;
  let stop = 0;
  let step = 1;

  if (args.length === 1) {
    stop = Number(args[0]);
  } else if (args.length === 2) {
    start = Number(args[0]);
    stop = Number(args[1]);
  } else if (args.length === 3) {
    start = Number(args[0]);
    stop = Number(args[1]);
    step = Number(args[2]);
    if (step === 0) throw new Error(`ValueError: range() arg 3 must not be zero (line ${line})`);
  } else {
    throw new Error(`TypeError: range expected at most 3 arguments, got ${args.length} (line ${line})`);
  }

  const v: RangeValue = { start, stop, step };
  let repr = '';
  const count = step > 0 ? Math.max(0, Math.ceil((stop - start) / step)) : Math.max(0, Math.ceil((start - stop) / (-step)));
  if (count <= 100) {
    const arr: number[] = [];
    for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
      arr.push(i);
    }
    repr = `[${arr.join(', ')}]`;
  } else {
    repr = step === 1 ? (start === 0 ? `range(0, ${stop})` : `range(${start}, ${stop})`) : `range(${start}, ${stop}, ${step})`;
  }

  const obj = allocObject('range', v, repr);
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * Format float number with CPython standard: `2.0` instead of `2`.
 */
export function formatFloatRepr(n: number): string {
  const s = String(n);
  if (!s.includes('.') && !s.includes('e') && !s.includes('E')) {
    return `${s}.0`;
  }
  return s;
}

/**
 * Allocate a float heap object to preserve Python float identity and formatting.
 */
export function allocFloat(val: number, state: MemoryState): string {
  const repr = formatFloatRepr(val);
  const obj = allocObject('float', val, repr);
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * Dispatch table for Python built-in function calls.
 * Returns { handled: true, result } if the call matches a built-in, or { handled: false }.
 */
export function dispatchBuiltin(
  name: string,
  args: RtValue[],
  state: MemoryState,
  line: number,
  helpers: {
    makeIterator: (v: RtValue, state: MemoryState, line: number) => RtValue;
    nextIterator: (v: RtValue, state: MemoryState, line: number) => RtValue;
    makeMapFilter: (args: RtValue[], state: MemoryState, line: number, isFilter: boolean) => RtValue;
    reduce: (args: RtValue[], state: MemoryState, line: number) => RtValue;
  },
): { handled: boolean; result: RtValue } {
  if (name === 'print') {
    const parts = args.map((a) => printArg(a, state));
    state.stdout.push(parts.join(' '));
    return { handled: true, result: null };
  }

  if (name === 'len') {
    return { handled: true, result: lengthOf(args[0], state) };
  }

  if (name === 'type') {
    const pyType = getPythonType(args[0], state);
    return { handled: true, result: allocString(pyType, state) };
  }

  if (name === 'id') {
    const address = computeId(args[0], state);
    return { handled: true, result: address };
  }

  if (name === 'isinstance') {
    if (args.length !== 2) throw new Error(`TypeError: isinstance expected 2 arguments, got ${args.length} (line ${line})`);
    return { handled: true, result: isInstance(args[0], args[1], state, line) };
  }

  if (name === 'int') {
    if (args.length === 0) return { handled: true, result: 0 };
    const a = args[0];
    if (typeof a === 'string') {
      const raw = (state.heap[a]?.type === 'str' ? (state.heap[a].value as string) : a).trim();
      if (!/^[+-]?(0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|[0-9]+)$/.test(raw)) {
        throw new Error(`ValueError: invalid literal for int() with base 10: '${raw}' (line ${line})`);
      }
      return { handled: true, result: parseInt(raw, 10) };
    }
    return { handled: true, result: Math.trunc(derefNumber(a, state)) };
  }

  if (name === 'float') {
    if (args.length === 0) return { handled: true, result: allocFloat(0, state) };
    const val = derefNumber(args[0], state);
    return { handled: true, result: allocFloat(val, state) };
  }

  if (name === 'str') {
    if (args.length === 0) return { handled: true, result: allocString('', state) };
    const s = printArg(args[0], state);
    return { handled: true, result: allocString(s, state) };
  }

  if (name === 'bool') {
    if (args.length === 0) return { handled: true, result: false };
    return { handled: true, result: truthy(args[0], state) };
  }

  if (name === 'range') {
    return { handled: true, result: makeRange(args, state, line) };
  }

  if (name === 'iter') {
    return { handled: true, result: helpers.makeIterator(args[0], state, line) };
  }

  if (name === 'next') {
    return { handled: true, result: helpers.nextIterator(args[0], state, line) };
  }

  if (name === 'map') {
    return { handled: true, result: helpers.makeMapFilter(args, state, line, false) };
  }

  if (name === 'filter') {
    return { handled: true, result: helpers.makeMapFilter(args, state, line, true) };
  }

  if (name === 'reduce') {
    return { handled: true, result: helpers.reduce(args, state, line) };
  }

  if (name === 'list') {
    let items: RtValue[] = [];
    if (args.length > 0) {
      const src = args[0];
      if (typeof src === 'string' && state.heap[src]) {
        const o = state.heap[src];
        if (o.type === 'list' || o.type === 'tuple' || o.type === 'set') {
          items = [...(o.value as RtValue[])];
        } else if (o.type === 'dict' || o.type === 'defaultdict') {
          items = dictEntries(o).map(([k]) => allocString(k, state));
        } else if (o.type === 'str') {
          items = Array.from(o.value as string).map((c) => allocString(c, state));
        } else if (o.type === 'range') {
          const rv = o.value as RangeValue;
          for (let i = rv.start; rv.step > 0 ? i < rv.stop : i > rv.stop; i += rv.step) {
            items.push(i);
          }
        }
      } else if (typeof src === 'string') {
        items = Array.from(src).map((c) => allocString(c, state));
      } else if (Array.isArray(src)) {
        items = [...(src as unknown as RtValue[])];
      }
    }
    const obj = allocObject('list', items, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return { handled: true, result: obj.id };
  }

  if (name === 'tuple') {
    let items: RtValue[] = [];
    if (args.length > 0) {
      const src = args[0];
      if (typeof src === 'string' && state.heap[src]) {
        const o = state.heap[src];
        if (o.type === 'list' || o.type === 'tuple' || o.type === 'set') {
          items = [...(o.value as RtValue[])];
        } else if (o.type === 'dict' || o.type === 'defaultdict') {
          items = dictEntries(o).map(([k]) => allocString(k, state));
        } else if (o.type === 'str') {
          items = Array.from(o.value as string).map((c) => allocString(c, state));
        }
      } else if (Array.isArray(src)) {
        items = [...(src as unknown as RtValue[])];
      }
    }
    const obj = allocObject('tuple', items, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return { handled: true, result: obj.id };
  }

  if (name === 'dict') {
    const pairs: Array<[string, RtValue, RtValue?]> = [];
    if (args.length > 0) {
      const src = args[0];
      if (typeof src === 'string' && state.heap[src]) {
        const o = state.heap[src];
        if (o.type === 'dict') {
          pairs.push(...(o.value as Array<[string, RtValue, RtValue?]>));
        } else if (o.type === 'list' || o.type === 'tuple') {
          const elts = o.value as RtValue[];
          for (const item of elts) {
            if (typeof item === 'string' && state.heap[item]?.type === 'tuple') {
              const pair = state.heap[item].value as RtValue[];
              if (pair.length === 2) {
                const kRepr = dictKeyRepr(pair[0], state);
                const existing = pairs.find(([ek, , ok]) => dictKeyMatch(ek, ok, pair[0], kRepr, state));
                if (existing) existing[1] = pair[1];
                else pairs.push([kRepr, pair[1], pair[0]]);
              }
            }
          }
        }
      }
    }
    const obj = allocObject('dict', pairs, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return { handled: true, result: obj.id };
  }

  if (name === 'set') {
    const items: RtValue[] = [];
    if (args.length > 0) {
      const src = args[0];
      if (typeof src === 'string' && state.heap[src]) {
        const o = state.heap[src];
        if (['list', 'tuple', 'set'].includes(o.type)) {
          for (const v of o.value as RtValue[]) {
            dictKeyRepr(v, state);
            if (findIndexOfValue(items, v, state) < 0) {
              items.push(v);
            }
          }
        }
      }
    }
    const obj = allocObject('set', items, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return { handled: true, result: obj.id };
  }

  if (name === 'abs') {
    if (args.length !== 1) throw new Error(`TypeError: abs() takes exactly one argument (${args.length} given) (line ${line})`);
    const n = derefNumber(args[0], state);
    if (typeof args[0] === 'string' && state.heap[args[0]]?.type === 'float') {
      return { handled: true, result: allocFloat(Math.abs(n), state) };
    }
    return { handled: true, result: Math.abs(n) };
  }

  if (name === 'min') {
    if (args.length === 0) throw new Error(`TypeError: min() expected at least 1 argument, got 0 (line ${line})`);
    let items: RtValue[] = args;
    if (args.length === 1 && typeof args[0] === 'string' && state.heap[args[0]]) {
      const o = state.heap[args[0]];
      if (['list', 'tuple', 'set'].includes(o.type)) items = o.value as RtValue[];
    }
    if (items.length === 0) throw new Error(`ValueError: min() arg is an empty sequence (line ${line})`);
    let minVal = items[0];
    for (let i = 1; i < items.length; i++) {
      if (derefNumber(items[i], state) < derefNumber(minVal, state)) minVal = items[i];
    }
    return { handled: true, result: minVal };
  }

  if (name === 'max') {
    if (args.length === 0) throw new Error(`TypeError: max() expected at least 1 argument, got 0 (line ${line})`);
    let items: RtValue[] = args;
    if (args.length === 1 && typeof args[0] === 'string' && state.heap[args[0]]) {
      const o = state.heap[args[0]];
      if (['list', 'tuple', 'set'].includes(o.type)) items = o.value as RtValue[];
    }
    if (items.length === 0) throw new Error(`ValueError: max() arg is an empty sequence (line ${line})`);
    let maxVal = items[0];
    for (let i = 1; i < items.length; i++) {
      if (derefNumber(items[i], state) > derefNumber(maxVal, state)) maxVal = items[i];
    }
    return { handled: true, result: maxVal };
  }

  if (name === 'sum') {
    if (args.length === 0) throw new Error(`TypeError: sum() takes at least 1 argument (line ${line})`);
    const src = typeof args[0] === 'string' ? state.heap[args[0]] : undefined;
    if (!src || !['list', 'tuple', 'set'].includes(src.type)) {
      throw new Error(`TypeError: sum() requires an iterable of numbers (line ${line})`);
    }
    const start = args.length > 1 ? derefNumber(args[1], state) : 0;
    const total = (src.value as RtValue[]).reduce<number>((acc, v) => acc + derefNumber(v, state), start);
    return { handled: true, result: total };
  }

  if (name === 'sorted') {
    if (args.length === 0) throw new Error(`TypeError: sorted() takes at least 1 argument (line ${line})`);
    const src = typeof args[0] === 'string' ? state.heap[args[0]] : undefined;
    if (!src || !['list', 'tuple', 'set'].includes(src.type)) {
      throw new Error(`TypeError: sorted() requires an iterable (line ${line})`);
    }
    const cloned = [...(src.value as RtValue[])].sort((a, b) => derefNumber(a, state) - derefNumber(b, state));
    const obj = allocObject('list', cloned, '');
    state.heap[obj.id] = obj;
    obj.repr = formatObject(obj, state);
    return { handled: true, result: obj.id };
  }

  if (name === 'scatter' || name === 'line') {
    const title = args.length >= 3 ? printArg(args[2], state) : name;
    const points = zipPoints(args[0], args[1], state);
    state.plots.push({ kind: name, title, points });
    return { handled: true, result: null };
  }

  return { handled: false, result: null };
}
