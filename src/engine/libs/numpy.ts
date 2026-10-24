/**
 * NumPy array and buffer runtime emulation.
 */

import { allocObject } from '../memory';
import { readNumberSeries, typeName } from '../common';
import type { MemoryState, RtValue } from '../types';

export interface NumpyBufferValue {
  data: number[];
  dtype: string;
}

export interface NdarrayValue {
  buffer: string;
  offset: number;
  shape: number;
  dtype: string;
  view: boolean;
}

/**
 * Format flat number array with NumPy repr style: `[1. 2. 3.]` or `[11 12  3]`.
 */
export function numpyRepr(data: number[], dtype = 'float64'): string {
  if (data.length === 0) return '[]';
  if (dtype === 'int64') {
    const strs = data.map((n) => String(Math.floor(n)));
    const maxLen = Math.max(...strs.map((s) => s.length));
    const padded = strs.map((s) => s.padStart(maxLen, ' '));
    return `[${padded.join(' ')}]`;
  }
  const body = data.map((n) => (Number.isInteger(n) ? `${n}.` : String(n)));
  return `[${body.join(' ')}]`;
}

/**
 * Return slice of buffer data corresponding to the array's window.
 */
export function ndarrayWindow(ndId: string, state: MemoryState): number[] {
  const v = state.heap[ndId].value as NdarrayValue;
  const data = (state.heap[v.buffer].value as NumpyBufferValue).data;
  return data.slice(v.offset, v.offset + v.shape);
}

/**
 * Allocate a buffer object on heap.
 */
export function makeBuffer(data: number[], dtype: string, state: MemoryState): string {
  const obj = allocObject('buffer', { data, dtype } as NumpyBufferValue, `[${data.join(', ')}]`);
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * `np.array([...])` implementation.
 */
export function makeNdarray(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 1) throw new Error(`TypeError: array() takes exactly one argument (line ${line})`);
  const data = readNumberSeries(args[0], state);
  const isAllInt = (args[0] && typeof args[0] === 'string' && state.heap[args[0]])
    ? (state.heap[args[0]].value as RtValue[]).every((e) => typeof e === 'number' && Number.isInteger(e))
    : data.every((n) => Number.isInteger(n));
  const dtype = isAllInt ? 'int64' : 'float64';
  const bufId = makeBuffer(data, dtype, state);
  const obj = allocObject('ndarray', { buffer: bufId, offset: 0, shape: data.length, dtype, view: false } as NdarrayValue, '');
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, dtype);
  return obj.id;
}

/**
 * `a.copy()` implementation for ndarray.
 */
export function copyNdarray(ndId: string, state: MemoryState, line: number): RtValue {
  const nd = state.heap[ndId];
  if (!nd || nd.type !== 'ndarray') throw new Error(`TypeError: ${typeName(ndId, state)} has no .copy() (line ${line})`);
  const data = ndarrayWindow(ndId, state);
  const bufId = makeBuffer([...data], (nd.value as NdarrayValue).dtype, state);
  const obj = allocObject('ndarray', { buffer: bufId, offset: 0, shape: data.length, dtype: 'float64', view: false } as NdarrayValue, '');
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data);
  return obj.id;
}

/**
 * Slicing an ndarray returns a view into the same buffer.
 */
export function ndarraySlice(ndId: string, start: RtValue, stop: RtValue, state: MemoryState, line: number): RtValue {
  const nd = state.heap[ndId];
  if (!nd || nd.type !== 'ndarray') throw new Error(`TypeError: ${typeName(ndId, state)} is not sliceable (line ${line})`);
  const v = nd.value as NdarrayValue;
  const full = (state.heap[v.buffer].value as NumpyBufferValue).data;
  const s = start === null ? 0 : Number(start);
  const e = stop === null ? v.shape : Number(stop);
  const offset = v.offset + s;
  const shape = Math.max(0, e - s);
  const obj = allocObject('ndarray', { buffer: v.buffer, offset, shape, dtype: v.dtype, view: true } as NdarrayValue, '');
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(full.slice(offset, offset + shape), v.dtype);
  void line;
  return obj.id;
}

/**
 * Vectorized array addition: `arr + scalar` or `scalar + arr`.
 */
export function vecAdd(left: RtValue, right: RtValue, state: MemoryState, line: number): RtValue {
  const a = state.heap[left as string];
  if (!a || a.type !== 'ndarray') throw new Error(`TypeError: unsupported operand (line ${line})`);
  const b = Number(right);
  if (Number.isNaN(b)) throw new Error(`TypeError: cannot add ${typeName(right, state)} to ndarray (line ${line})`);
  const data = ndarrayWindow(left as string, state).map((n) => n + b);
  const bufId = makeBuffer(data, 'float64', state);
  const obj = allocObject('ndarray', { buffer: bufId, offset: 0, shape: data.length, dtype: 'float64', view: false } as NdarrayValue, '');
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data);
  return obj.id;
}

/**
 * `a.sum()` method for ndarray.
 */
export function ndarraySum(ndId: string, state: MemoryState, line: number): RtValue {
  const nd = state.heap[ndId];
  if (!nd || nd.type !== 'ndarray') throw new Error(`TypeError: ${typeName(ndId, state)} has no .sum() (line ${line})`);
  return ndarrayWindow(ndId, state).reduce((acc, n) => acc + n, 0);
}

/**
 * Recompute cached repr of all ndarray windows and buffers in state.
 */
export function refreshNdarrayReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'ndarray') {
      const v = obj.value as NdarrayValue;
      obj.repr = numpyRepr(ndarrayWindow(obj.id, state), v.dtype);
    }
    if (obj.type === 'buffer') obj.repr = `[${(obj.value as NumpyBufferValue).data.join(', ')}]`;
  }
}

/**
 * Dispatch table for methods on ndarray objects.
 */
export function dispatchNdarrayMethod(ndId: string, method: string, _args: RtValue[], state: MemoryState, line: number): RtValue {
  if (method === 'copy') return copyNdarray(ndId, state, line);
  if (method === 'sum') return ndarraySum(ndId, state, line);
  throw new Error(`AttributeError: 'ndarray' object has no attribute '${method}' (line ${line})`);
}

/**
 * Dispatch table for numpy module calls: `numpy.array()`, etc.
 */
export function dispatchNumpyModule(method: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  if (method === 'array') return makeNdarray(args, state, line);
  throw new Error(`AttributeError: module 'numpy' has no attribute '${method}' (line ${line})`);
}
