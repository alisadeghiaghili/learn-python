/**
 * Shared runtime utilities, value coercions, and formatting helpers.
 */

import { allocObject } from './memory';
import type { HeapObject, MemoryState, RtValue } from './types';

/**
 * Extract [key, value] pairs from a dict or defaultdict heap object.
 */
export function dictEntries(obj: HeapObject): Array<[string, RtValue, RtValue?]> {
  if (obj.type === 'dict') return obj.value as Array<[string, RtValue, RtValue?]>;
  if (obj.type === 'defaultdict') {
    const v = obj.value as { entries?: Array<[string, RtValue, RtValue?]> };
    return v?.entries ?? [];
  }
  return [];
}

/**
 * Format string with Python single-quote representation and escape sequences.
 */
export function formatStr(s: string): string {
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `'${escaped}'`;
}

/**
 * Format a list-like collection with custom brackets.
 */
export function formatListLike(
  elts: RtValue[],
  state: MemoryState,
  open: string,
  close: string,
  seen: Set<string> = new Set(),
): string {
  return open + elts.map((e) => displayValue(e, state, seen)).join(', ') + close;
}

/**
 * Format a heap container or scalar into its display string, with cycle detection.
 */
export function formatObject(obj: HeapObject, state: MemoryState, seen: Set<string> = new Set()): string {
  if (seen.has(obj.id)) {
    if (obj.type === 'list') return '[...]';
    if (obj.type === 'dict' || obj.type === 'defaultdict' || obj.type === 'set') return '{...}';
    if (obj.type === 'tuple') return '(...)';
  }
  const nextSeen = new Set(seen);
  nextSeen.add(obj.id);

  if (obj.type === 'list') return formatListLike(obj.value as RtValue[], state, '[', ']', nextSeen);
  if (obj.type === 'tuple') {
    const value = obj.value as RtValue[];
    const body = formatListLike(value, state, '(', ')', nextSeen);
    return value.length === 1 ? `(${displayValue(value[0], state, nextSeen)},)` : body;
  }
  if (obj.type === 'set') {
    const elts = [...(obj.value as RtValue[])];
    const allInts = elts.every((e) => typeof e === 'number' && Number.isInteger(e));
    if (allInts) {
      elts.sort((a, b) => Number(a) - Number(b));
    }
    return '{' + elts.map((e) => displayValue(e, state, nextSeen)).join(', ') + '}';
  }
  if (obj.type === 'dict' || obj.type === 'defaultdict') {
    return '{' + dictEntries(obj).map(([k, v]) => `${k}: ${displayValue(v, state, nextSeen)}`).join(', ') + '}';
  }
  if (obj.type === 'str') return formatStr(obj.value as string);
  return String(obj.repr ?? obj.value);
}

/**
 * Live repr for a heap object, reflecting in-place mutations in containers.
 */
export function liveRepr(obj: HeapObject, state: MemoryState, seen: Set<string> = new Set()): string {
  if (obj.type === 'list' || obj.type === 'dict' || obj.type === 'tuple' || obj.type === 'set' || obj.type === 'defaultdict') {
    return formatObject(obj, state, seen);
  }
  return obj.repr;
}

/**
 * Human-facing display of a runtime value (repr-style).
 */
export function displayValue(v: RtValue, state: MemoryState, seen: Set<string> = new Set()): string {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'string' && state.heap[v]) {
    return liveRepr(state.heap[v], state, seen);
  }
  if (typeof v === 'string') return formatStr(v);
  return String(v);
}

/**
 * Format a runtime value for print() and str() output (unquoted strings).
 */
export function printArg(v: RtValue, state: MemoryState): string {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    return obj.type === 'str' ? (obj.value as string) : liveRepr(obj, state);
  }
  if (typeof v === 'string') return v;
  return String(v);
}

/**
 * Allocate a string heap object.
 */
export function allocString(s: string, state: MemoryState): string {
  const obj = allocObject('str', s, formatStr(s));
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * Canonical dict key representation string.
 */
export function dictKeyRepr(k: RtValue, state: MemoryState): string {
  if (typeof k === 'string' && state.heap[k]) {
    const obj = state.heap[k];
    if (obj.type === 'list' || obj.type === 'dict' || obj.type === 'set') {
      throw new Error(`TypeError: unhashable type: '${obj.type}'`);
    }
  }
  return displayValue(k, state);
}

/**
 * Check whether a dict entry key matches a lookup target under Python hashing and equality rules.
 */
export function dictKeyMatch(
  entryKeyRepr: string,
  origKey: RtValue | undefined,
  targetKey: RtValue,
  targetKeyRepr: string,
  state: MemoryState,
): boolean {
  if (entryKeyRepr === targetKeyRepr) return true;
  if (origKey !== undefined && valuesEqual(origKey, targetKey, state)) return true;
  if (entryKeyRepr === '1' && targetKey === true) return true;
  if (entryKeyRepr === 'True' && (targetKey === 1 || targetKey === 1n)) return true;
  if (entryKeyRepr === '0' && targetKey === false) return true;
  if (entryKeyRepr === 'False' && (targetKey === 0 || targetKey === 0n)) return true;
  return false;
}

/**
 * Convert dict key representation string back to a runtime string value.
 */
export function keyToValue(keyRepr: string, state: MemoryState): string {
  let s = keyRepr;
  if (s.startsWith("'") && s.endsWith("'")) {
    s = s.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
  }
  return allocString(s, state);
}

/**
 * Test value equality between two runtime values via Python semantics.
 */
export function valuesEqual(a: RtValue, b: RtValue, state: MemoryState): boolean {
  if (a === b) return true;
  if ((a === true && b === 1) || (a === 1 && b === true)) return true;
  if ((a === false && b === 0) || (a === 0 && b === false)) return true;
  if (typeof a === 'string' && state.heap[a]?.type === 'float') {
    return derefNumber(a, state) === derefNumber(b, state);
  }
  if (typeof b === 'string' && state.heap[b]?.type === 'float') {
    return derefNumber(a, state) === derefNumber(b, state);
  }
  return displayValue(a, state) === displayValue(b, state);
}

/**
 * Find index of first element equal to target in a list of runtime values.
 */
export function findIndexOfValue(arr: RtValue[], target: RtValue, state: MemoryState): number {
  for (let i = 0; i < arr.length; i++) {
    if (valuesEqual(arr[i], target, state)) return i;
  }
  return -1;
}

/**
 * Evaluate truthiness of a runtime value following Python rules.
 */
export function truthy(v: RtValue, state: MemoryState): boolean {
  if (v === null || v === false || v === 0 || v === 0n || v === '') return false;
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (obj.type === 'list' || obj.type === 'tuple' || obj.type === 'set') return (obj.value as RtValue[]).length > 0;
    if (obj.type === 'dict' || obj.type === 'defaultdict') return dictEntries(obj).length > 0;
    if (obj.type === 'str') return (obj.value as string).length > 0;
    if (obj.type === 'float') return (obj.value as number) !== 0;
  }
  return Boolean(v);
}

/**
 * Coerce a runtime value into a JS number, dereferencing string objects if necessary.
 */
export function derefNumber(v: RtValue, state: MemoryState): number {
  if (typeof v === 'string' && state.heap[v]?.type === 'str') {
    return Number(state.heap[v].value);
  }
  if (typeof v === 'string' && state.heap[v]?.type === 'float') {
    return state.heap[v].value as number;
  }
  return Number(v);
}

/**
 * Get container length or string code-point length, raising TypeError if unmeasurable.
 */
export function lengthOf(v: RtValue, state: MemoryState): number {
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (['list', 'tuple', 'set', 'dict'].includes(obj.type)) return (obj.value as unknown[]).length;
    if (obj.type === 'defaultdict') return dictEntries(obj).length;
    if (obj.type === 'ndarray') return (obj.value as { shape: number }).shape;
    if (obj.type === 'str') return Array.from(obj.value as string).length;
  }
  if (typeof v === 'string') return Array.from(v).length;
  throw new Error(`TypeError: object of type '${typeName(v, state)}' has no len()`);
}

/**
 * Read a flat array of numbers from a heap container or number list.
 */
export function readNumberSeries(v: RtValue, state: MemoryState): number[] {
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (['list', 'tuple', 'set'].includes(obj.type)) {
      return (obj.value as RtValue[]).map((e) => {
        const n = derefNumber(e, state);
        if (Number.isNaN(n)) throw new Error('TypeError: expected numeric points');
        return n;
      });
    }
    throw new Error(`TypeError: ${obj.type} is not an iterable of numbers`);
  }
  throw new Error('TypeError: expected a list of numbers');
}

/**
 * Pair two containers of numbers into (x, y) points for plotting.
 */
export function zipPoints(xs: RtValue, ys: RtValue, state: MemoryState): Array<[number, number]> {
  const xArr = readNumberSeries(xs, state);
  const yArr = readNumberSeries(ys, state);
  const n = Math.min(xArr.length, yArr.length);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) pts.push([xArr[i]!, yArr[i]!]);
  return pts;
}

/**
 * Get runtime type name of a value.
 */
export function typeName(v: RtValue, state: MemoryState): string {
  if (typeof v === 'string' && state.heap[v]) return state.heap[v].type;
  if (v === null) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'bigint') return 'int';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  return typeof v;
}
