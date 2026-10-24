/**
 * Matplotlib subset implementation for learn-python simulator.
 * Supports `import matplotlib.pyplot as plt` and standard plotting functions:
 * `plt.plot`, `plt.scatter`, `plt.bar`, `plt.title`, `plt.xlabel`, `plt.ylabel`, `plt.legend`, `plt.show()`.
 * Also maintains top-level backwards-compatibility for `scatter(x, y)` and `line(x, y)`.
 */

import { PyTypeError, PyValueError } from '../errors';
import type { MemoryState, PlotSpec, RtValue } from '../types';

interface CurrentFigure {
  kind: 'scatter' | 'line' | 'bar';
  points: Array<[number, number]>;
  title?: string;
  xlabel?: string;
  ylabel?: string;
}

let activeFigure: CurrentFigure | null = null;

function extractNumberArray(val: RtValue, state: MemoryState, argName: string, line: number): number[] {
  if (typeof val === 'string' && state.heap[val]) {
    const obj = state.heap[val];
    if (obj.type === 'list' || obj.type === 'tuple') {
      const arr = obj.value as RtValue[];
      return arr.map((item) => {
        if (typeof item === 'number') return item;
        if (typeof item === 'bigint') return Number(item);
        if (typeof item === 'string' && state.heap[item]?.type === 'float') {
          return state.heap[item].value as number;
        }
        const num = Number(item);
        if (Number.isNaN(num)) {
          throw new PyTypeError(`${argName} elements must be numbers (line ${line})`);
        }
        return num;
      });
    }
    if (obj.type === 'ndarray') {
      const nd = obj.value as { buffer: string; offset: number; shape: number };
      const buf = state.heap[nd.buffer];
      if (buf && buf.type === 'buffer') {
        const data = (buf.value as { data: number[] }).data;
        return data.slice(nd.offset, nd.offset + nd.shape);
      }
    }
    if (obj.type === 'series') {
      const s = obj.value as { buffer: string; offset: number; shape: number };
      const buf = state.heap[s.buffer];
      if (buf && buf.type === 'buffer') {
        const data = (buf.value as { data: number[] }).data;
        return data.slice(s.offset, s.offset + s.shape);
      }
    }
  }
  if (Array.isArray(val)) {
    return val.map((n) => Number(n));
  }
  throw new PyTypeError(`${argName} must be a list, tuple, or array (line ${line})`);
}

/**
 * Handle plt.scatter(x, y) or standalone scatter(x, y).
 */
export function pltScatter(
  args: RtValue[],
  state: MemoryState,
  line: number,
  standalone = false
): null {
  if (args.length < 2) {
    throw new PyTypeError(`scatter() missing required positional arguments: 'x' and 'y' (line ${line})`);
  }
  const xs = extractNumberArray(args[0], state, 'x', line);
  const ys = extractNumberArray(args[1], state, 'y', line);
  if (xs.length !== ys.length) {
    throw new PyValueError(`x and y must have same first dimension, got ${xs.length} and ${ys.length} (line ${line})`);
  }
  const points: Array<[number, number]> = xs.map((x, i) => [x, ys[i]!]);

  if (standalone) {
    const title =
      args.length >= 3 && typeof args[2] === 'string'
        ? ((state.heap[args[2]]?.value as string) ?? args[2])
        : 'scatter(x, y)';
    state.plots.push({ kind: 'scatter', title, points });
    return null;
  }

  activeFigure = {
    kind: 'scatter',
    points,
    title: activeFigure?.title,
    xlabel: activeFigure?.xlabel,
    ylabel: activeFigure?.ylabel,
  };
  return null;
}

/**
 * Handle plt.plot(x, y) or standalone line(x, y).
 */
export function pltPlot(
  args: RtValue[],
  state: MemoryState,
  line: number,
  standalone = false
): null {
  if (args.length < 1) {
    throw new PyTypeError(`plot() requires at least one argument (line ${line})`);
  }
  let xs: number[];
  let ys: number[];
  if (args.length === 1) {
    ys = extractNumberArray(args[0], state, 'y', line);
    xs = ys.map((_, i) => i);
  } else {
    xs = extractNumberArray(args[0], state, 'x', line);
    ys = extractNumberArray(args[1], state, 'y', line);
  }
  if (xs.length !== ys.length) {
    throw new PyValueError(`x and y must have same first dimension, got ${xs.length} and ${ys.length} (line ${line})`);
  }
  const points: Array<[number, number]> = xs.map((x, i) => [x, ys[i]!]);

  if (standalone) {
    const title =
      args.length >= 3 && typeof args[2] === 'string'
        ? ((state.heap[args[2]]?.value as string) ?? args[2])
        : 'line(x, y)';
    state.plots.push({ kind: 'line', title, points });
    return null;
  }

  activeFigure = {
    kind: 'line',
    points,
    title: activeFigure?.title,
    xlabel: activeFigure?.xlabel,
    ylabel: activeFigure?.ylabel,
  };
  return null;
}

/**
 * Handle plt.bar(x, y).
 */
export function pltBar(
  args: RtValue[],
  state: MemoryState,
  line: number
): null {
  if (args.length < 2) {
    throw new PyTypeError(`bar() missing required positional arguments: 'x' and 'height' (line ${line})`);
  }
  const xs = extractNumberArray(args[0], state, 'x', line);
  const ys = extractNumberArray(args[1], state, 'y', line);
  if (xs.length !== ys.length) {
    throw new PyValueError(`x and height must have same length, got ${xs.length} and ${ys.length} (line ${line})`);
  }
  const points: Array<[number, number]> = xs.map((x, i) => [x, ys[i]!]);
  activeFigure = {
    kind: 'bar',
    points,
    title: activeFigure?.title,
    xlabel: activeFigure?.xlabel,
    ylabel: activeFigure?.ylabel,
  };
  return null;
}

/**
 * Handle plt.title(s).
 */
export function pltTitle(args: RtValue[], state: MemoryState, line: number): null {
  if (args.length < 1) throw new PyTypeError(`title() missing 1 required argument: 'label' (line ${line})`);
  const t = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str'
    ? (state.heap[args[0]].value as string)
    : String(args[0]);
  if (!activeFigure) {
    activeFigure = { kind: 'line', points: [], title: t };
  } else {
    activeFigure.title = t;
  }
  return null;
}

/**
 * Handle plt.xlabel(s).
 */
export function pltXlabel(args: RtValue[], state: MemoryState, line: number): null {
  if (args.length < 1) throw new PyTypeError(`xlabel() missing 1 required argument: 'xlabel' (line ${line})`);
  const l = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str'
    ? (state.heap[args[0]].value as string)
    : String(args[0]);
  if (!activeFigure) {
    activeFigure = { kind: 'line', points: [], xlabel: l };
  } else {
    activeFigure.xlabel = l;
  }
  return null;
}

/**
 * Handle plt.ylabel(s).
 */
export function pltYlabel(args: RtValue[], state: MemoryState, line: number): null {
  if (args.length < 1) throw new PyTypeError(`ylabel() missing 1 required argument: 'ylabel' (line ${line})`);
  const l = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str'
    ? (state.heap[args[0]].value as string)
    : String(args[0]);
  if (!activeFigure) {
    activeFigure = { kind: 'line', points: [], ylabel: l };
  } else {
    activeFigure.ylabel = l;
  }
  return null;
}

/**
 * Handle plt.show() -> finalize the current plot and append to state.plots.
 */
export function pltShow(state: MemoryState): null {
  if (activeFigure && activeFigure.points.length > 0) {
    const spec: PlotSpec = {
      kind: activeFigure.kind,
      title: activeFigure.title ?? `${activeFigure.kind} plot`,
      xlabel: activeFigure.xlabel,
      ylabel: activeFigure.ylabel,
      points: activeFigure.points,
    };
    state.plots.push(spec);
    activeFigure = null;
  }
  return null;
}

/**
 * Reset module figure state before script execution.
 */
export function resetMatplotlib(): void {
  activeFigure = null;
}

/**
 * Dispatch call for matplotlib.pyplot module functions.
 */
export function callMatplotlibModule(
  method: string,
  args: RtValue[],
  state: MemoryState,
  line: number
): RtValue {
  switch (method) {
    case 'scatter':
      return pltScatter(args, state, line);
    case 'plot':
      return pltPlot(args, state, line);
    case 'bar':
      return pltBar(args, state, line);
    case 'title':
      return pltTitle(args, state, line);
    case 'xlabel':
      return pltXlabel(args, state, line);
    case 'ylabel':
      return pltYlabel(args, state, line);
    case 'legend':
      return null;
    case 'show':
      return pltShow(state);
    case 'clf':
    case 'close':
      activeFigure = null;
      return null;
    default:
      throw new PyTypeError(`module 'matplotlib.pyplot' has no attribute '${method}' (line ${line})`);
  }
}
