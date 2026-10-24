/**
 * Pandas simulator module for learn-python.
 * Teaches tables as windows over a row-major buffer:
 * - A DataFrame is a window over one row-major buffer.
 * - Slicing rows with .iloc[a:b] creates a view sharing the same buffer.
 * - .copy() allocates a fresh buffer (independent).
 * - Writing through a view updates the underlying buffer.
 * - Single column access df['col'] returns a Series.
 */

import { allocObject } from '../memory';
import { PyAttributeError, PyIndexError, PyKeyError, PyTypeError } from '../errors';
import type { MemoryState, RtValue } from '../types';

export interface PandasBufferValue {
  data: number[];
  dtype: string;
}

export interface PandasSeriesValue {
  buffer: string;
  offset: number;
  length: number;
  dtype: string;
  index: string[];
  view: boolean;
  name?: string;
  source?: string;
}

export interface PandasDataFrameValue {
  buffer: string;
  columns: string[];
  index: string[];
  dtype: string;
  view: boolean;
  rowOffset?: number;
  source?: string;
}

export type SeriesValue = PandasSeriesValue;
export type DataFrameValue = PandasDataFrameValue;

function frameRowCount(v: { length?: number; index?: string[] }): number {
  if (typeof v.length === 'number') return v.length;
  return v.index?.length ?? 0;
}

function colName(label: string): string {
  if (label.startsWith('str:')) {
    return label.slice(4);
  }
  if (label.startsWith("'") && label.endsWith("'") && label.length >= 2) {
    return label.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
  }
  return label;
}

function seriesValues(sId: string, state: MemoryState): number[] {
  const s = state.heap[sId].value as PandasSeriesValue;
  const data = (state.heap[s.buffer].value as PandasBufferValue).data;
  return data.slice(s.offset, s.offset + s.length);
}

function frameRowStart(v: PandasDataFrameValue): number {
  return v.rowOffset ?? 0;
}

function frameColumn(dfId: string, col: string, state: MemoryState): number[] {
  const v = state.heap[dfId].value as PandasDataFrameValue;
  const data = (state.heap[v.buffer].value as PandasBufferValue).data;
  const ci = v.columns.indexOf(col);
  if (ci < 0) return [];
  const rowStart = frameRowStart(v);
  const nRows = frameRowCount(v);
  const out: number[] = [];
  for (let r = 0; r < nRows; r++) out.push(data[(rowStart + r) * v.columns.length + ci]!);
  return out;
}

function frameBufferData(rows: Record<string, number[]>, columns: string[], nRows: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < nRows; r++) for (const c of columns) out.push(rows[c]?.[r] ?? 0);
  return out;
}

function makePandasBuffer(data: number[], dtype: string, state: MemoryState): string {
  const obj = allocObject('buffer', { data, dtype } as PandasBufferValue, `[${data.join(', ')}]`);
  state.heap[obj.id] = obj;
  return obj.id;
}

function readNumberSeries(v: RtValue, state: MemoryState): number[] {
  if (typeof v === 'string' && state.heap[v]) {
    const obj = state.heap[v];
    if (['list', 'tuple', 'set'].includes(obj.type)) {
      return (obj.value as RtValue[]).map((e) => {
        if (typeof e === 'number') return e;
        if (typeof e === 'string' && state.heap[e]) {
          const inner = state.heap[e];
          if (inner.type === 'int' || inner.type === 'float') return Number(inner.value);
        }
        return Number(e);
      });
    }
  }
  if (Array.isArray(v)) {
    return (v as unknown[]).map(Number);
  }
  throw new PyTypeError('expected a list of numbers');
}

function displayValue(v: RtValue, state: MemoryState): string {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const obj = state.heap[v];
    if (obj) {
      if (obj.type === 'str') return obj.value as string;
      return obj.repr;
    }
    return v;
  }
  return String(v);
}

export function pandasRepr(type: string, v: PandasSeriesValue | PandasDataFrameValue, state: MemoryState): string {
  if (type === 'series') {
    const s = v as PandasSeriesValue;
    const data = (state.heap[s.buffer].value as PandasBufferValue).data;
    const shown = data.slice(s.offset, s.offset + s.length);
    const labels = s.index.slice(s.offset, s.offset + s.length);
    const lines = labels.map((label, i) => `${String(label).padEnd(8)} ${shown[i] ?? 0}`);
    const header = s.name ? `Series: ${s.name}` : 'Series';
    return `${header}\n${lines.join('\n')}`;
  }
  const f = v as PandasDataFrameValue;
  const data = (state.heap[f.buffer].value as PandasBufferValue).data;
  const nRows = frameRowCount(f);
  const rowStart = frameRowStart(f);
  const head = f.columns.join('  ');
  const lines: string[] = [head];
  for (let r = 0; r < nRows; r++) {
    const cells: string[] = [];
    for (const c of f.columns) cells.push(String(data[(rowStart + r) * f.columns.length + f.columns.indexOf(c)] ?? 0));
    lines.push(`${f.index[r] ?? ''}  ${cells.join('  ')}`);
  }
  return `DataFrame\n${lines.join('\n')}`;
}

export function refreshPandasReprs(state: MemoryState): void {
  for (const obj of Object.values(state.heap)) {
    if (obj.type === 'series') {
      obj.repr = pandasRepr('series', obj.value as PandasSeriesValue, state);
    } else if (obj.type === 'dataframe') {
      const origRepr = obj.repr;
      const newRepr = pandasRepr('dataframe', obj.value as PandasDataFrameValue, state);
      if (origRepr.startsWith('DataFrame (from ')) {
        const fileLabel = origRepr.split('\n')[0];
        obj.repr = `${fileLabel}\n${newRepr.slice('DataFrame\n'.length)}`;
      } else {
        obj.repr = newRepr;
      }
    }
  }
}

export function makeSeries(
  args: RtValue[],
  kwargs: Record<string, RtValue> | undefined,
  state: MemoryState,
  line: number
): RtValue {
  void kwargs;
  if (args.length !== 1) throw new PyTypeError(`Series() takes one argument (line ${line})`);
  const data = readNumberSeries(args[0], state);
  const bufId = makePandasBuffer(data, 'float64', state);
  const v: PandasSeriesValue = {
    buffer: bufId,
    offset: 0,
    length: data.length,
    dtype: 'float64',
    index: data.map((_, i) => String(i)),
    view: false,
  };
  const obj = allocObject('series', v, '');
  state.heap[obj.id] = obj;
  obj.repr = pandasRepr('series', v, state);
  return obj.id;
}

export function makeDataFrame(
  args: RtValue[],
  kwargs: Record<string, RtValue> | undefined,
  state: MemoryState,
  line: number
): RtValue {
  void kwargs;
  if (args.length !== 1) throw new PyTypeError(`DataFrame() takes one argument (line ${line})`);
  const obj = state.heap[args[0] as string];
  if (!obj || obj.type !== 'dict') throw new PyTypeError(`DataFrame() takes a dict of columns (line ${line})`);
  const entries = Array.isArray(obj.value)
    ? (obj.value as Array<[string, RtValue]>)
    : Object.entries(obj.value as Record<string, RtValue>);
  const columns = entries.map(([k]) => colName(k));
  const colData = entries.map(([, v]) => readNumberSeries(v, state));
  const nRows = Math.max(0, ...colData.map((c) => c.length));
  const rows: Record<string, number[]> = {};
  columns.forEach((c, ci) => (rows[c] = colData[ci]!));
  const bufId = makePandasBuffer(frameBufferData(rows, columns, nRows), 'float64', state);
  const v: PandasDataFrameValue = {
    buffer: bufId,
    columns,
    index: Array.from({ length: nRows }, (_, i) => String(i)),
    dtype: 'float64',
    view: false,
  };
  const df = allocObject('dataframe', v, '');
  state.heap[df.id] = df;
  df.repr = pandasRepr('dataframe', v, state);
  return df.id;
}

export function dataFrameGetColumn(
  dfId: string,
  key: RtValue,
  state: MemoryState,
  line: number
): RtValue {
  const v = state.heap[dfId].value as PandasDataFrameValue;
  const isList = typeof key === 'string' && state.heap[key] && state.heap[key].type === 'list';
  const cols: string[] = [];
  if (isList) {
    for (const e of state.heap[key].value as RtValue[]) {
      const c = colName(displayValue(e, state));
      if (!v.columns.includes(c)) throw new PyKeyError(`column '${c}' (line ${line})`);
      cols.push(c);
    }
  } else {
    const c = colName(displayValue(key, state));
    if (!v.columns.includes(c)) throw new PyKeyError(`column '${c}' (line ${line})`);
    cols.push(c);
  }

  const nRows = frameRowCount(v);

  if (cols.length === 1 && !isList) {
    const col = frameColumn(dfId, cols[0]!, state);
    const s: PandasSeriesValue = {
      buffer: makePandasBuffer(col, v.dtype, state),
      offset: 0,
      length: nRows,
      dtype: v.dtype,
      index: [...v.index],
      view: false,
      name: cols[0],
    };
    const so = allocObject('series', s, '');
    state.heap[so.id] = so;
    so.repr = pandasRepr('series', s, state);
    return so.id;
  }

  const rows: Record<string, number[]> = {};
  for (const c of cols) rows[c] = frameColumn(dfId, c, state);
  const nbuf = makePandasBuffer(frameBufferData(rows, cols, nRows), v.dtype, state);
  const nf: PandasDataFrameValue = {
    buffer: nbuf,
    columns: cols,
    index: [...v.index],
    dtype: v.dtype,
    view: false,
  };
  const nd = allocObject('dataframe', nf, '');
  state.heap[nd.id] = nd;
  nd.repr = pandasRepr('dataframe', nf, state);
  return nd.id;
}

export function dataFrameSetColumn(
  dfId: string,
  colKey: RtValue,
  value: RtValue,
  state: MemoryState,
  line: number
): void {
  const f = state.heap[dfId].value as PandasDataFrameValue;
  const col = colName(displayValue(colKey, state));
  if (!f.columns.includes(col)) throw new PyKeyError(`column '${col}' (line ${line})`);
  const listObj = state.heap[value as string];
  if (!listObj || listObj.type !== 'list') throw new PyTypeError(`assigning a column needs a list (line ${line})`);
  const cells = listObj.value as RtValue[];
  const nRows = frameRowCount(f);
  const ci = f.columns.indexOf(col);
  const rowStart = frameRowStart(f);
  const data = (state.heap[f.buffer].value as PandasBufferValue).data;
  for (let r = 0; r < nRows; r++) data[(rowStart + r) * f.columns.length + ci] = Number(cells[r] ?? 0);
  refreshPandasReprs(state);
}

export function dataFrameLocRow(
  objId: string,
  key: RtValue,
  state: MemoryState,
  line: number
): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new PyTypeError(`bad loc target (line ${line})`);
  const label = displayValue(key, state);

  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const i = s.index.indexOf(label);
    if (i < 0) throw new PyKeyError(`${label} (line ${line})`);
    return seriesValues(objId, state)[i]!;
  }

  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const i = f.index.indexOf(label);
    if (i < 0) throw new PyKeyError(`${label} (line ${line})`);
    const row: number[] = [];
    for (const c of f.columns) row.push(frameColumn(objId, c, state)[i]!);
    const s: PandasSeriesValue = {
      buffer: state.heap[f.buffer].id,
      offset: 0,
      length: f.columns.length,
      dtype: f.dtype,
      index: [...f.columns],
      view: true,
      source: state.heap[f.buffer].id,
    };
    const rbuf = makePandasBuffer(row, f.dtype, state);
    s.buffer = rbuf;
    const so = allocObject('series', s, '');
    state.heap[so.id] = so;
    so.repr = pandasRepr('series', s, state);
    return so.id;
  }
  throw new PyTypeError(`'${obj.type}' has no .loc (line ${line})`);
}

export function dataFrameSetLoc(
  dfId: string,
  row: RtValue,
  col: string,
  val: RtValue,
  state: MemoryState,
  line: number
): void {
  const f = state.heap[dfId].value as PandasDataFrameValue;
  const colClean = colName(col);
  const rowClean = displayValue(row, state);
  const ci = f.columns.indexOf(colClean);
  if (ci < 0) throw new PyKeyError(`column '${colClean}' (line ${line})`);
  const ri = f.index.indexOf(rowClean);
  if (ri < 0) throw new PyKeyError(`row '${rowClean}' (line ${line})`);
  const rowStart = frameRowStart(f);
  const data = (state.heap[f.buffer].value as PandasBufferValue).data;
  data[(rowStart + ri) * f.columns.length + ci] = Number(val);
  refreshPandasReprs(state);
}

export function dataFrameIlocRow(
  objId: string,
  i0: RtValue,
  state: MemoryState,
  line: number
): RtValue {
  const i = Number(i0);
  if (Number.isNaN(i)) throw new PyTypeError(`iloc takes an integer (line ${line})`);
  const obj = state.heap[objId];
  if (!obj) throw new PyTypeError(`bad iloc target (line ${line})`);

  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const n = frameRowCount(s);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new PyIndexError(`iloc out of range (line ${line})`);
    return seriesValues(objId, state)[idx]!;
  }
  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const n = frameRowCount(f);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new PyIndexError(`iloc out of range (line ${line})`);
    const row: number[] = [];
    for (const c of f.columns) row.push(frameColumn(objId, c, state)[idx]!);
    const s: PandasSeriesValue = {
      buffer: makePandasBuffer(row, f.dtype, state),
      offset: 0,
      length: f.columns.length,
      dtype: f.dtype,
      index: [...f.columns],
      view: true,
      source: state.heap[f.buffer].id,
    };
    const so = allocObject('series', s, '');
    state.heap[so.id] = so;
    so.repr = pandasRepr('series', s, state);
    return so.id;
  }
  throw new PyTypeError(`'${obj.type}' has no .iloc (line ${line})`);
}

export function dataFrameIloc(
  dfId: string,
  start: RtValue,
  stop: RtValue,
  state: MemoryState,
  line: number
): RtValue {
  const obj = state.heap[dfId];
  if (!obj) throw new PyTypeError(`bad iloc target (line ${line})`);
  const a = start === null ? 0 : Number(start);
  let e = stop === null ? 0 : Number(stop);

  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const n = frameRowCount(s);
    e = stop === null ? n : e;
    const v: PandasSeriesValue = {
      buffer: s.buffer,
      offset: s.offset + a,
      length: Math.max(0, e - a),
      dtype: s.dtype,
      index: s.index.slice(a, e),
      view: true,
      name: s.name,
    };
    const o = allocObject('series', v, '');
    state.heap[o.id] = o;
    o.repr = pandasRepr('series', v, state);
    return o.id;
  }

  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const n = frameRowCount(f);
    e = stop === null ? n : e;
    const rowStart = frameRowStart(f) + a;
    const v: PandasDataFrameValue = {
      buffer: state.heap[f.buffer].id,
      columns: [...f.columns],
      index: f.index.slice(a, e),
      dtype: f.dtype,
      view: true,
      rowOffset: rowStart,
      source: state.heap[f.buffer].id,
    };
    const o = allocObject('dataframe', v, '');
    state.heap[o.id] = o;
    o.repr = pandasRepr('dataframe', v, state);
    return o.id;
  }
  throw new PyTypeError(`'${obj.type}' has no .iloc (line ${line})`);
}

export function dataFrameIlocSet(
  objId: string,
  i0: RtValue,
  value: RtValue,
  state: MemoryState,
  line: number
): void {
  const i = Number(i0);
  const obj = state.heap[objId];
  if (!obj) throw new PyTypeError(`bad iloc target (line ${line})`);
  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const n = frameRowCount(s);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new PyIndexError(`iloc out of range (line ${line})`);
    const data = (state.heap[s.buffer].value as PandasBufferValue).data;
    data[s.offset + idx] = Number(value);
    refreshPandasReprs(state);
    return;
  }
  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const n = frameRowCount(f);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new PyIndexError(`iloc out of range (line ${line})`);
    const listObj = state.heap[value as string];
    if (!listObj || listObj.type !== 'list') throw new PyTypeError(`df.iloc row needs a list (line ${line})`);
    const cells = listObj.value as RtValue[];
    const rowStart = frameRowStart(f);
    const data = (state.heap[f.buffer].value as PandasBufferValue).data;
    for (let c = 0; c < f.columns.length; c++) data[(rowStart + idx) * f.columns.length + c] = Number(cells[c] ?? 0);
    refreshPandasReprs(state);
    return;
  }
  throw new PyTypeError(`'${obj.type}' has no .iloc (line ${line})`);
}

export function readCsv(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 2) throw new PyTypeError(`read_csv(name, data) takes two arguments (line ${line})`);
  const name = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str'
    ? (state.heap[args[0]].value as string)
    : displayValue(args[0], state);
  const dfId = makeDataFrame([args[1]], undefined, state, line) as string;
  const df = state.heap[dfId];
  df.repr = `DataFrame (from ${name})\n${df.repr.slice('DataFrame\n'.length)}`;
  return dfId;
}

export function pandasGetAttr(
  objId: string,
  attr: string,
  state: MemoryState,
  line: number
): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new PyAttributeError(`object not found (line ${line})`);
  if (obj.type === 'dataframe') {
    const v = obj.value as PandasDataFrameValue;
    if (attr === 'shape') {
      const elts: RtValue[] = [frameRowCount(v), v.columns.length];
      const tup = allocObject('tuple', elts, `(${elts.join(', ')})`);
      state.heap[tup.id] = tup;
      return tup.id;
    }
    if (attr === 'columns') {
      const elts = v.columns.map((c) => allocObject('str', c, `'${c}'`).id);
      const listObj = allocObject('list', elts, `[${v.columns.map((c) => `'${c}'`).join(', ')}]`);
      state.heap[listObj.id] = listObj;
      return listObj.id;
    }
  }
  throw new PyAttributeError(`'${obj.type}' object has no attribute '${attr}' (line ${line})`);
}

export function callPandasMethod(
  objId: string,
  method: string,
  args: RtValue[],
  kwargs: Record<string, RtValue> | undefined,
  state: MemoryState,
  line: number
): RtValue {
  void kwargs;
  void args;
  const obj = state.heap[objId];
  if (!obj) throw new PyAttributeError(`object not found (line ${line})`);

  if (method === 'copy') {
    if (obj.type === 'series') {
      const s = obj.value as PandasSeriesValue;
      const win = seriesValues(objId, state);
      const v: PandasSeriesValue = {
        buffer: makePandasBuffer([...win], s.dtype, state),
        offset: 0,
        length: win.length,
        dtype: s.dtype,
        index: s.index.slice(s.offset, s.offset + s.length),
        view: false,
        name: s.name,
      };
      const o = allocObject('series', v, '');
      state.heap[o.id] = o;
      o.repr = pandasRepr('series', v, state);
      return o.id;
    }
    if (obj.type === 'dataframe') {
      const f = obj.value as PandasDataFrameValue;
      const data = (state.heap[f.buffer].value as PandasBufferValue).data;
      const rowStart = frameRowStart(f);
      const nRows = frameRowCount(f);
      const win = data.slice(rowStart * f.columns.length, (rowStart + nRows) * f.columns.length);
      const v: PandasDataFrameValue = {
        buffer: makePandasBuffer([...win], f.dtype, state),
        columns: [...f.columns],
        index: [...f.index],
        dtype: f.dtype,
        view: false,
      };
      const o = allocObject('dataframe', v, '');
      state.heap[o.id] = o;
      o.repr = pandasRepr('dataframe', v, state);
      return o.id;
    }
    throw new PyTypeError(`'${obj.type}' has no .copy() (line ${line})`);
  }

  if (method === 'sum') {
    if (obj.type === 'series') {
      return seriesValues(objId, state).reduce((a, b) => a + b, 0);
    }
    if (obj.type === 'dataframe') {
      const f = obj.value as PandasDataFrameValue;
      const sums = f.columns.map((c) => frameColumn(objId, c, state).reduce((a, b) => a + b, 0));
      const s: PandasSeriesValue = {
        buffer: makePandasBuffer(sums, 'float64', state),
        offset: 0,
        length: sums.length,
        dtype: 'float64',
        index: [...f.columns],
        view: false,
        name: 'sum',
      };
      const o = allocObject('series', s, '');
      state.heap[o.id] = o;
      o.repr = pandasRepr('series', s, state);
      return o.id;
    }
    throw new PyTypeError(`'${obj.type}' has no .sum() (line ${line})`);
  }

  throw new PyAttributeError(`'${obj.type}' object has no attribute '${method}' (line ${line})`);
}

export function callPandasModule(
  method: string,
  args: RtValue[],
  kwargs: Record<string, RtValue> | undefined,
  state: MemoryState,
  line: number
): RtValue {
  switch (method) {
    case 'Series':
      return makeSeries(args, kwargs, state, line);
    case 'DataFrame':
      return makeDataFrame(args, kwargs, state, line);
    case 'read_csv':
      return readCsv(args, state, line);
    default:
      throw new PyAttributeError(`module 'pandas' has no attribute '${method}' (line ${line})`);
  }
}
