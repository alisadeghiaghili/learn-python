/**
 * NumPy simulator module for learn-python.
 * Models N-dimensional arrays (1D & 2D), strided buffer windows (views vs copies),
 * base references (`v.base is a`), broadcasting, and vector operations.
 */

import { allocObject } from '../memory';
import { PyAttributeError, PyTypeError, PyValueError } from '../errors';
import type { MemoryState, RtValue } from '../types';

export interface NumpyBufferValue {
  data: number[];
  dtype: string;
}

export interface NdarrayValue {
  buffer: string;
  offset: number;
  shape: number | number[]; // e.g. 3 or [2, 3]
  strides?: number[];
  dtype: string;
  view: boolean;
  base?: string | null;
}

/**
 * Format a 1D or 2D array in canonical NumPy style.
 * Right-pads integers; adds trailing dot to integer-valued floats.
 */
export function numpyRepr(data: number[], shape: number | number[], dtype = 'float64'): string {
  const isInt = dtype === 'int64' || dtype === 'int32';

  const fmtNum = (n: number) => {
    if (isInt) return String(Math.trunc(n));
    return Number.isInteger(n) ? `${n}.` : String(n);
  };

  if (typeof shape === 'number') {
    const strs = data.map(fmtNum);
    const maxLen = Math.max(...strs.map((s) => s.length), 1);
    const padded = strs.map((s) => s.padStart(maxLen, ' '));
    return `[${padded.join(' ')}]`;
  }

  // 2D formatting: shape [rows, cols]
  const [rows, cols] = shape;
  if (!rows || !cols) return '[]';
  const strs = data.map(fmtNum);
  const maxLen = Math.max(...strs.map((s) => s.length), 1);
  const padded = strs.map((s) => s.padStart(maxLen, ' '));

  const rowStrings: string[] = [];
  for (let r = 0; r < rows; r++) {
    const slice = padded.slice(r * cols, (r + 1) * cols);
    rowStrings.push(` [${slice.join(' ')}]`);
  }
  return `[${rowStrings.join('\n')}]`;
}

/**
 * Extract flat slice of data from an ndarray's window over its buffer.
 */
export function ndarrayWindow(ndId: string, state: MemoryState): number[] {
  const obj = state.heap[ndId];
  if (!obj || obj.type !== 'ndarray') return [];
  const v = obj.value as NdarrayValue;
  const bufObj = state.heap[v.buffer];
  if (!bufObj || bufObj.type !== 'buffer') return [];
  const full = (bufObj.value as NumpyBufferValue).data;

  const size = typeof v.shape === 'number' ? v.shape : v.shape.reduce((a, b) => a * b, 1);
  return full.slice(v.offset, v.offset + size);
}

/**
 * Allocate a flat buffer heap object.
 */
export function makeBuffer(data: number[], dtype: string, state: MemoryState): string {
  const obj = allocObject('buffer', { data, dtype } as NumpyBufferValue, `[${data.join(', ')}]`);
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * Refresh reprs for all ndarrays and buffers in heap.
 */
export function refreshNdarrayReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'ndarray') {
      const v = obj.value as NdarrayValue;
      obj.repr = numpyRepr(ndarrayWindow(obj.id, state), v.shape, v.dtype);
    } else if (obj.type === 'buffer') {
      const b = obj.value as NumpyBufferValue;
      obj.repr = `[${b.data.join(', ')}]`;
    }
  }
}

/**
 * Convert an iterable or nested list argument into a flat number array and shape.
 */
function readArrayData(
  arg: RtValue,
  state: MemoryState
): { data: number[]; shape: number | number[]; hasFloat: boolean } {
  if (typeof arg === 'string' && state.heap[arg]) {
    const obj = state.heap[arg];
    if (obj.type === 'list' || obj.type === 'tuple') {
      const elts = obj.value as RtValue[];
      // Check for 2D list: [[1, 2], [3, 4]]
      if (elts.length > 0 && typeof elts[0] === 'string' && state.heap[elts[0]]?.type === 'list') {
        const rows = elts.length;
        const firstRow = state.heap[elts[0]]!.value as RtValue[];
        const cols = firstRow.length;
        const flat: number[] = [];
        let hasFloat = false;
        for (const rowId of elts) {
          const rowObj = state.heap[rowId as string];
          if (!rowObj || rowObj.type !== 'list') continue;
          for (const item of rowObj.value as RtValue[]) {
            if (typeof item === 'number') flat.push(item);
            else if (typeof item === 'bigint') flat.push(Number(item));
            else if (typeof item === 'string' && state.heap[item]?.type === 'float') {
              hasFloat = true;
              flat.push(state.heap[item]!.value as number);
            } else flat.push(Number(item));
          }
        }
        return { data: flat, shape: [rows, cols], hasFloat };
      }

      // 1D list
      let hasFloat = false;
      const data = elts.map((e) => {
        if (typeof e === 'number') return e;
        if (typeof e === 'bigint') return Number(e);
        if (typeof e === 'string' && state.heap[e]?.type === 'float') {
          hasFloat = true;
          return state.heap[e]!.value as number;
        }
        return Number(e);
      });
      return { data, shape: data.length, hasFloat };
    }
  }
  if (Array.isArray(arg)) {
    return { data: arg.map(Number), shape: arg.length, hasFloat: false };
  }
  return { data: [Number(arg)], shape: 1, hasFloat: false };
}

/**
 * `np.array(...)` — create an ndarray owning a new buffer.
 */
export function makeNdarray(
  args: RtValue[],
  kwargs: Record<string, RtValue> | undefined,
  state: MemoryState,
  line: number
): RtValue {
  if (args.length < 1) throw new PyTypeError(`array() missing 1 required positional argument: 'object' (line ${line})`);
  const { data, shape, hasFloat } = readArrayData(args[0], state);
  const dtype = kwargs?.dtype ? String(kwargs.dtype) : hasFloat ? 'float64' : 'int64';
  const bufId = makeBuffer(data, dtype, state);
  const strides = typeof shape === 'number' ? [1] : [shape[1]!, 1];
  const obj = allocObject(
    'ndarray',
    {
      buffer: bufId,
      offset: 0,
      shape,
      strides,
      dtype,
      view: false,
      base: null,
    } as NdarrayValue,
    ''
  );
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, shape, dtype);
  return obj.id;
}

/** `np.arange([start,] stop[, step])` */
export function npArange(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length < 1) throw new PyTypeError(`arange() missing required positional argument: 'stop' (line ${line})`);
  let start = 0;
  let stop = 0;
  let step = 1;
  if (args.length === 1) {
    stop = Number(args[0]);
  } else if (args.length === 2) {
    start = Number(args[0]);
    stop = Number(args[1]);
  } else {
    start = Number(args[0]);
    stop = Number(args[1]);
    step = Number(args[2]);
  }

  const data: number[] = [];
  if (step > 0) {
    for (let i = start; i < stop; i += step) data.push(i);
  } else if (step < 0) {
    for (let i = start; i > stop; i += step) data.push(i);
  }

  const dtype = Number.isInteger(step) && Number.isInteger(start) ? 'int64' : 'float64';
  const bufId = makeBuffer(data, dtype, state);
  const obj = allocObject(
    'ndarray',
    { buffer: bufId, offset: 0, shape: data.length, strides: [1], dtype, view: false, base: null } as NdarrayValue,
    ''
  );
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, data.length, dtype);
  return obj.id;
}

/** `np.zeros(shape)` */
export function npZeros(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length < 1) throw new PyTypeError(`zeros() missing required positional argument: 'shape' (line ${line})`);
  const shape = typeof args[0] === 'number' ? args[0] : 0;
  const data = new Array(shape).fill(0);
  const bufId = makeBuffer(data, 'float64', state);
  const obj = allocObject(
    'ndarray',
    { buffer: bufId, offset: 0, shape, strides: [1], dtype: 'float64', view: false, base: null } as NdarrayValue,
    ''
  );
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, shape, 'float64');
  return obj.id;
}

/** `np.ones(shape)` */
export function npOnes(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length < 1) throw new PyTypeError(`ones() missing required positional argument: 'shape' (line ${line})`);
  const shape = typeof args[0] === 'number' ? args[0] : 0;
  const data = new Array(shape).fill(1);
  const bufId = makeBuffer(data, 'float64', state);
  const obj = allocObject(
    'ndarray',
    { buffer: bufId, offset: 0, shape, strides: [1], dtype: 'float64', view: false, base: null } as NdarrayValue,
    ''
  );
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, shape, 'float64');
  return obj.id;
}

/** `np.linspace(start, stop, num=50)` */
export function npLinspace(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length < 2) throw new PyTypeError(`linspace() missing required positional arguments: 'start', 'stop' (line ${line})`);
  const start = Number(args[0]);
  const stop = Number(args[1]);
  const num = args.length >= 3 ? Number(args[2]) : 50;
  const data: number[] = [];
  if (num <= 1) {
    data.push(start);
  } else {
    const step = (stop - start) / (num - 1);
    for (let i = 0; i < num; i++) data.push(start + i * step);
  }
  const bufId = makeBuffer(data, 'float64', state);
  const obj = allocObject(
    'ndarray',
    { buffer: bufId, offset: 0, shape: data.length, strides: [1], dtype: 'float64', view: false, base: null } as NdarrayValue,
    ''
  );
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, data.length, 'float64');
  return obj.id;
}

/** `np.shares_memory(a, b)` -> boolean */
export function npSharesMemory(args: RtValue[], state: MemoryState, line: number): boolean {
  if (args.length < 2) throw new PyTypeError(`shares_memory() requires two array arguments (line ${line})`);
  const a = state.heap[args[0] as string];
  const b = state.heap[args[1] as string];
  if (!a || a.type !== 'ndarray' || !b || b.type !== 'ndarray') return false;
  const va = a.value as NdarrayValue;
  const vb = b.value as NdarrayValue;
  return va.buffer === vb.buffer;
}

/** `a.copy()` — an independent copy owning a newly allocated buffer. */
export function copyNdarray(ndId: string, state: MemoryState, line: number): RtValue {
  const nd = state.heap[ndId];
  if (!nd || nd.type !== 'ndarray') throw new PyTypeError(`has no .copy() (line ${line})`);
  const v = nd.value as NdarrayValue;
  const data = ndarrayWindow(ndId, state);
  const bufId = makeBuffer([...data], v.dtype, state);
  const obj = allocObject(
    'ndarray',
    { buffer: bufId, offset: 0, shape: v.shape, strides: v.strides, dtype: v.dtype, view: false, base: null } as NdarrayValue,
    ''
  );
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, v.shape, v.dtype);
  return obj.id;
}

/**
 * `a[start:stop[:step]]` — creates a VIEW on the same buffer with `v.base is a`.
 */
export function ndarraySlice(
  ndId: string,
  start: RtValue,
  stop: RtValue,
  step: RtValue,
  state: MemoryState,
  line: number
): RtValue {
  void line;
  void step;
  const nd = state.heap[ndId];
  if (!nd || nd.type !== 'ndarray') throw new PyTypeError(`object is not sliceable (line ${line})`);
  const v = nd.value as NdarrayValue;
  const full = (state.heap[v.buffer].value as NumpyBufferValue).data;

  const len = typeof v.shape === 'number' ? v.shape : v.shape[0]!;
  const s = start === null ? 0 : Number(start);
  const e = stop === null ? len : Number(stop);
  const offset = v.offset + s;
  const newLen = Math.max(0, e - s);

  // The base of a view is the original parent array (or parent's base if parent is already a view)
  const base = v.base ?? ndId;

  const obj = allocObject(
    'ndarray',
    {
      buffer: v.buffer,
      offset,
      shape: newLen,
      strides: [1],
      dtype: v.dtype,
      view: true,
      base,
    } as NdarrayValue,
    ''
  );
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(full.slice(offset, offset + newLen), newLen, v.dtype);
  return obj.id;
}

/**
 * Vector elementwise binary arithmetic (+, -, *, /) with scalar or matching-shape broadcasting.
 */
export function vecBinaryOp(
  left: RtValue,
  op: '+' | '-' | '*' | '/',
  right: RtValue,
  state: MemoryState,
  line: number
): RtValue {
  const leftIsNd = typeof left === 'string' && state.heap[left]?.type === 'ndarray';
  const rightIsNd = typeof right === 'string' && state.heap[right]?.type === 'ndarray';

  if (!leftIsNd && !rightIsNd) {
    throw new PyTypeError(`neither operand is ndarray (line ${line})`);
  }

  if (leftIsNd && !rightIsNd) {
    const nd = state.heap[left as string].value as NdarrayValue;
    const b = Number(right);
    const data = ndarrayWindow(left as string, state).map((n) => {
      if (op === '+') return n + b;
      if (op === '-') return n - b;
      if (op === '*') return n * b;
      return n / b;
    });
    const dtype = op === '/' || nd.dtype === 'float64' ? 'float64' : 'int64';
    const bufId = makeBuffer(data, dtype, state);
    const obj = allocObject('ndarray', { buffer: bufId, offset: 0, shape: nd.shape, dtype, view: false, base: null } as NdarrayValue, '');
    state.heap[obj.id] = obj;
    obj.repr = numpyRepr(data, nd.shape, dtype);
    return obj.id;
  }

  if (!leftIsNd && rightIsNd) {
    const nd = state.heap[right as string].value as NdarrayValue;
    const a = Number(left);
    const data = ndarrayWindow(right as string, state).map((n) => {
      if (op === '+') return a + n;
      if (op === '-') return a - n;
      if (op === '*') return a * n;
      return a / n;
    });
    const dtype = op === '/' || nd.dtype === 'float64' ? 'float64' : 'int64';
    const bufId = makeBuffer(data, dtype, state);
    const obj = allocObject('ndarray', { buffer: bufId, offset: 0, shape: nd.shape, dtype, view: false, base: null } as NdarrayValue, '');
    state.heap[obj.id] = obj;
    obj.repr = numpyRepr(data, nd.shape, dtype);
    return obj.id;
  }

  // Both are ndarrays
  const nd1 = state.heap[left as string].value as NdarrayValue;
  const nd2 = state.heap[right as string].value as NdarrayValue;
  const d1 = ndarrayWindow(left as string, state);
  const d2 = ndarrayWindow(right as string, state);

  if (d1.length !== d2.length) {
    throw new PyValueError(`operands could not be broadcast together with shapes (${d1.length},) (${d2.length},) (line ${line})`);
  }

  const data = d1.map((n, i) => {
    const m = d2[i]!;
    if (op === '+') return n + m;
    if (op === '-') return n - m;
    if (op === '*') return n * m;
    return n / m;
  });

  const dtype = op === '/' || nd1.dtype === 'float64' || nd2.dtype === 'float64' ? 'float64' : 'int64';
  const bufId = makeBuffer(data, dtype, state);
  const obj = allocObject('ndarray', { buffer: bufId, offset: 0, shape: nd1.shape, dtype, view: false, base: null } as NdarrayValue, '');
  state.heap[obj.id] = obj;
  obj.repr = numpyRepr(data, nd1.shape, dtype);
  return obj.id;
}

/**
 * In-place augmented assignment (+=, *=, -=) writes directly to shared buffer.
 */
export function vecInPlaceOp(
  ndId: string,
  op: string,
  right: RtValue,
  state: MemoryState,
  line: number
): void {
  const a = state.heap[ndId];
  if (!a || a.type !== 'ndarray') throw new PyTypeError(`unsupported operand for ${op} (line ${line})`);
  const b = Number(right);
  if (Number.isNaN(b)) throw new PyTypeError(`cannot operate ${op} on ndarray with non-number (line ${line})`);
  const v = a.value as NdarrayValue;
  const buffer = state.heap[v.buffer];
  const bufData = (buffer.value as NumpyBufferValue).data;
  const len = typeof v.shape === 'number' ? v.shape : v.shape.reduce((x, y) => x * y, 1);
  for (let i = 0; i < len; i++) {
    if (op === '+=' || op === '+') bufData[v.offset + i] += b;
    else if (op === '-=' || op === '-') bufData[v.offset + i] -= b;
    else if (op === '*=' || op === '*') bufData[v.offset + i] *= b;
    else if (op === '/=' || op === '/') bufData[v.offset + i] /= b;
  }
  refreshNdarrayReprs(state);
}

/**
 * Access ndarray attributes (.shape, .ndim, .size, .dtype, .T, .base).
 */
export function ndarrayGetAttr(ndId: string, attr: string, state: MemoryState, line: number): RtValue {
  const obj = state.heap[ndId];
  if (!obj || obj.type !== 'ndarray') throw new PyAttributeError(`not an ndarray (line ${line})`);
  const v = obj.value as NdarrayValue;

  switch (attr) {
    case 'shape': {
      if (typeof v.shape === 'number') {
        const tup = allocObject('tuple', [v.shape], `(${v.shape},)`);
        state.heap[tup.id] = tup;
        return tup.id;
      }
      const tup = allocObject('tuple', [...v.shape], `(${v.shape.join(', ')})`);
      state.heap[tup.id] = tup;
      return tup.id;
    }
    case 'ndim':
      return typeof v.shape === 'number' ? 1 : v.shape.length;
    case 'size':
      return typeof v.shape === 'number' ? v.shape : v.shape.reduce((a, b) => a * b, 1);
    case 'dtype':
      return v.dtype;
    case 'base':
      return v.base ?? null;
    case 'T':
      // Transpose: for 2D, transpose shape [cols, rows] as a view
      if (Array.isArray(v.shape) && v.shape.length === 2) {
        const [r, c] = v.shape;
        const newShape = [c!, r!];
        const tObj = allocObject('ndarray', { ...v, shape: newShape, view: true, base: v.base ?? ndId } as NdarrayValue, '');
        state.heap[tObj.id] = tObj;
        tObj.repr = numpyRepr(ndarrayWindow(ndId, state), newShape, v.dtype);
        return tObj.id;
      }
      return ndId;
    default:
      throw new PyAttributeError(`'ndarray' object has no attribute '${attr}' (line ${line})`);
  }
}

/**
 * Call ndarray methods (.copy(), .sum(), .mean(), .min(), .max(), .reshape(), .astype(), .ravel(), .flatten()).
 */
export function callNdarrayMethod(
  ndId: string,
  method: string,
  args: RtValue[],
  state: MemoryState,
  line: number
): RtValue {
  const obj = state.heap[ndId];
  if (!obj || obj.type !== 'ndarray') throw new PyTypeError(`not an ndarray (line ${line})`);
  const v = obj.value as NdarrayValue;
  const data = ndarrayWindow(ndId, state);

  switch (method) {
    case 'copy':
      return copyNdarray(ndId, state, line);
    case 'sum':
      return data.reduce((a, b) => a + b, 0);
    case 'mean':
      return data.length === 0 ? 0 : data.reduce((a, b) => a + b, 0) / data.length;
    case 'min':
      return Math.min(...data);
    case 'max':
      return Math.max(...data);
    case 'astype': {
      const newDtype = String(args[0] ?? 'float64');
      const bufId = makeBuffer([...data], newDtype, state);
      const newObj = allocObject('ndarray', { ...v, buffer: bufId, dtype: newDtype, view: false, base: null } as NdarrayValue, '');
      state.heap[newObj.id] = newObj;
      newObj.repr = numpyRepr(data, v.shape, newDtype);
      return newObj.id;
    }
    case 'reshape': {
      let newShape: number | number[];
      if (args.length === 1 && typeof args[0] === 'number') newShape = args[0];
      else if (args.length === 2) newShape = [Number(args[0]), Number(args[1])];
      else if (args.length === 1 && typeof args[0] === 'string' && state.heap[args[0]]?.type === 'tuple') {
        newShape = (state.heap[args[0]]!.value as number[]).map(Number);
      } else {
        newShape = data.length;
      }
      const reshaped = allocObject('ndarray', { ...v, shape: newShape, view: true, base: v.base ?? ndId } as NdarrayValue, '');
      state.heap[reshaped.id] = reshaped;
      reshaped.repr = numpyRepr(data, newShape, v.dtype);
      return reshaped.id;
    }
    case 'ravel':
    case 'flatten': {
      const flat = allocObject('ndarray', { ...v, shape: data.length, view: method === 'ravel', base: method === 'ravel' ? (v.base ?? ndId) : null } as NdarrayValue, '');
      state.heap[flat.id] = flat;
      flat.repr = numpyRepr(data, data.length, v.dtype);
      return flat.id;
    }
    default:
      throw new PyAttributeError(`'ndarray' object has no attribute '${method}' (line ${line})`);
  }
}

/**
 * Dispatch call for module `numpy` (or `np`).
 */
export function callNumpyModule(
  method: string,
  args: RtValue[],
  kwargs: Record<string, RtValue> | undefined,
  state: MemoryState,
  line: number
): RtValue {
  switch (method) {
    case 'array':
      return makeNdarray(args, kwargs, state, line);
    case 'arange':
      return npArange(args, state, line);
    case 'zeros':
      return npZeros(args, state, line);
    case 'ones':
      return npOnes(args, state, line);
    case 'linspace':
      return npLinspace(args, state, line);
    case 'shares_memory':
      return npSharesMemory(args, state, line);
    default:
      throw new PyAttributeError(`module 'numpy' has no attribute '${method}' (line ${line})`);
  }
}
