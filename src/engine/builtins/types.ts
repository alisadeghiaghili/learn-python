/**
 * Python object model, identity, interning, and type system.
 */

import { allocObject } from '../memory';
import type { MemoryState, RtValue } from '../types';

/** Base address for small-int cache to simulate CPython pointer values */
const SMALL_INT_BASE_ADDR = 140700000000000;
const NONE_ADDR = 140700000099999;
const TRUE_ADDR = 140700000088888;
const FALSE_ADDR = 140700000077777;

let scalarAddrCounter = 140705000000000;

export function resetTypeAddresses(): void {
  scalarAddrCounter = 140705000000000;
}

/**
 * Determine the CPython type name for a runtime value.
 */
export function typeName(v: RtValue, state: MemoryState): string {
  if (v === null) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'bigint') return 'int';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? 'int' : 'float';
  }
  if (typeof v === 'string') {
    const obj = state.heap[v];
    if (obj) {
      if (obj.type === 'float') return 'float';
      if (obj.type === 'int') return 'int';
      return obj.type;
    }
    return 'str';
  }
  return typeof v;
}

/**
 * Get or allocate a singleton TypeObject representing <class 'T'>.
 */
export function getTypeObject(name: string, state: MemoryState): string {
  const existing = Object.values(state.heap).find(
    (o) => o.type === 'type' && (o.value as { name: string }).name === name
  );
  if (existing) return existing.id;

  const obj = allocObject(
    'type',
    { name },
    `<class '${name}'>`,
    'heap'
  );
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * Allocate a simulated float heap object (used when distinct float type is required).
 */
export function allocFloat(num: number, state: MemoryState): string {
  const repr = formatFloat(num);
  const obj = allocObject('float', num, repr, 'heap');
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * Format a float number in CPython style (e.g. 2.0 instead of 2).
 */
export function formatFloat(num: number): string {
  if (Number.isInteger(num)) {
    return num.toFixed(1);
  }
  return String(num);
}

/**
 * Compute the Python id() integer for a value.
 */
export function getObjectId(v: RtValue, state: MemoryState): number {
  if (v === null) return NONE_ADDR;
  if (v === true) return TRUE_ADDR;
  if (v === false) return FALSE_ADDR;

  if (typeof v === 'bigint') {
    const n = Number(v);
    if (n >= -5 && n <= 256) {
      return SMALL_INT_BASE_ADDR + (n + 5) * 32;
    }
    return scalarAddrCounter += 32;
  }

  if (typeof v === 'number') {
    if (Number.isInteger(v) && v >= -5 && v <= 256) {
      return SMALL_INT_BASE_ADDR + (v + 5) * 32;
    }
    return scalarAddrCounter += 32;
  }

  if (typeof v === 'string') {
    const obj = state.heap[v];
    if (obj) {
      return obj.addr ? 140701000000000 + obj.addr : (scalarAddrCounter += 32);
    }
    // Raw string
    return scalarAddrCounter += 32;
  }

  return scalarAddrCounter += 32;
}

/**
 * Check whether an object is an instance of a given type.
 * Supports CPython's bool-is-subclass-of-int rule.
 */
export function pyIsInstance(v: RtValue, targetTypeName: string, state: MemoryState): boolean {
  const actual = typeName(v, state);
  if (actual === targetTypeName) return true;
  if (actual === 'bool' && targetTypeName === 'int') return true;
  return false;
}
