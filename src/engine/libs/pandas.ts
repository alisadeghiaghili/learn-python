/**
 * Pandas DataFrame and Series runtime emulation.
 */

import { allocObject } from '../memory';
import { displayValue, readNumberSeries } from '../common';
import type { MemoryState, RtValue } from '../types';

export interface PandasBufferValue {
  data: number[];
  dtype: string;
}

/**
 * A Series: a window over a buffer plus its row labels.
 */
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

/**
 * A DataFrame: a window over a row-major buffer, plus labels.
 */
export interface PandasDataFrameValue {
  buffer: string;
  columns: string[];
  index: string[];
  dtype: string;
  view: boolean;
  rowOffset?: number;
  source?: string;
}

/**
 * The number of rows an object currently shows.
 */
export function frameRowCount(v: { length?: number; index?: string[] }): number {
  if (typeof v.length === 'number') return v.length;
  return v.index?.length ?? 0;
}

/**
 * Normalize a display label to bare column name.
 */
export function colName(label: string): string {
  if (label.startsWith("'") && label.endsWith("'") && label.length >= 2) {
    return label.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
  }
  return label;
}

/**
 * Numbers currently shown by a Series window.
 */
export function seriesValues(sId: string, state: MemoryState): number[] {
  const s = state.heap[sId].value as PandasSeriesValue;
  const data = (state.heap[s.buffer].value as PandasBufferValue).data;
  return data.slice(s.offset, s.offset + s.length);
}

/**
 * First buffer row index for a DataFrame window.
 */
export function frameRowStart(v: PandasDataFrameValue): number {
  return v.rowOffset ?? 0;
}

/**
 * Read one column of a DataFrame window as a flat number array.
 */
export function frameColumn(dfId: string, col: string, state: MemoryState): number[] {
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

/**
 * Buffer layout for rows x columns in row-major order.
 */
export function frameBufferData(rows: Record<string, number[]>, columns: string[], nRows: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < nRows; r++) for (const c of columns) out.push(rows[c]?.[r] ?? 0);
  return out;
}

/**
 * Allocate a buffer object for pandas storage.
 */
export function makePandasBuffer(data: number[], dtype: string, state: MemoryState): string {
  const obj = allocObject('buffer', { data, dtype } as PandasBufferValue, `[${data.join(', ')}]`);
  state.heap[obj.id] = obj;
  return obj.id;
}

/**
 * String repr for a Series or DataFrame matching pandas visual output.
 */
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

/**
 * `pd.Series([v0, v1, ...])` implementation.
 */
export function makeSeries(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 1) throw new Error(`TypeError: Series() takes one argument (line ${line})`);
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

/**
 * `pd.DataFrame({...})` implementation.
 */
export function makeDataFrame(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 1) throw new Error(`TypeError: DataFrame() takes one argument (line ${line})`);
  const obj = state.heap[args[0] as string];
  if (!obj || obj.type !== 'dict') throw new Error(`TypeError: DataFrame() takes a dict of columns (line ${line})`);
  const entries = obj.value as Array<[string, RtValue]>;
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

/**
 * Select one or more columns from a DataFrame.
 */
export function frameGetColumn(dfId: string, key: RtValue, state: MemoryState, line: number): RtValue {
  const v = state.heap[dfId].value as PandasDataFrameValue;
  const isList = typeof key === 'string' && state.heap[key] && state.heap[key].type === 'list';
  const cols: string[] = [];
  if (isList) {
    for (const e of state.heap[key].value as RtValue[]) {
      const c = colName(displayValue(e, state));
      if (!v.columns.includes(c)) throw new Error(`KeyError: column '${c}' (line ${line})`);
      cols.push(c);
    }
  } else {
    const c = colName(displayValue(key, state));
    if (!v.columns.includes(c)) throw new Error(`KeyError: column '${c}' (line ${line})`);
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

/**
 * `df.loc[key]` / `s.loc[key]` row selection.
 */
export function frameLocRow(objId: string, key: RtValue, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad loc target (line ${line})`);
  const label = displayValue(key, state);

  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const i = s.index.indexOf(label);
    if (i < 0) throw new Error(`KeyError: ${label} (line ${line})`);
    return seriesValues(objId, state)[i]!;
  }

  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const i = f.index.indexOf(label);
    if (i < 0) throw new Error(`KeyError: ${label} (line ${line})`);
    const row: number[] = [];
    for (const c of f.columns) row.push(frameColumn(objId, c, state)[i]!);
    const s: PandasSeriesValue = {
      buffer: state.heap[f.buffer].id,
      offset: 0,
      length: f.columns.length,
      dtype: f.dtype,
      index: [...f.columns],
      view: true,
    };
    const rbuf = makePandasBuffer(row, f.dtype, state);
    s.buffer = rbuf;
    s.source = state.heap[f.buffer].id;
    const so = allocObject('series', s, '');
    state.heap[so.id] = so;
    so.repr = pandasRepr('series', s, state);
    return so.id;
  }
  throw new Error(`TypeError: '${obj.type}' has no .loc (line ${line})`);
}

/**
 * `df.iloc[i]` / `s.iloc[i]` integer position row selection.
 */
export function frameIlocRow(objId: string, i0: RtValue, state: MemoryState, line: number): RtValue {
  const i = Number(i0);
  if (Number.isNaN(i)) throw new Error(`TypeError: iloc takes an integer (line ${line})`);
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad iloc target (line ${line})`);

  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const n = frameRowCount(s);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new Error(`IndexError: iloc out of range (line ${line})`);
    return seriesValues(objId, state)[idx]!;
  }
  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const n = frameRowCount(f);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new Error(`IndexError: iloc out of range (line ${line})`);
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
  throw new Error(`TypeError: '${obj.type}' has no .iloc (line ${line})`);
}

/**
 * `df.iloc[start:stop]` slice view.
 */
export function frameIlocSlice(objId: string, start: RtValue, stop: RtValue, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad iloc target (line ${line})`);
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
  throw new Error(`TypeError: '${obj.type}' has no .iloc (line ${line})`);
}

/**
 * `df.iloc[i] = v` / `s.iloc[i] = v` write-through.
 */
export function frameIlocSet(objId: string, i0: RtValue, value: RtValue, state: MemoryState, line: number): void {
  const i = Number(i0);
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad iloc target (line ${line})`);
  if (obj.type === 'series') {
    const s = obj.value as PandasSeriesValue;
    const n = frameRowCount(s);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new Error(`IndexError: iloc out of range (line ${line})`);
    const data = (state.heap[s.buffer].value as PandasBufferValue).data;
    data[s.offset + idx] = Number(value);
    obj.repr = pandasRepr('series', s, state);
    return;
  }
  if (obj.type === 'dataframe') {
    const f = obj.value as PandasDataFrameValue;
    const n = frameRowCount(f);
    const idx = i < 0 ? n + i : i;
    if (idx < 0 || idx >= n) throw new Error(`IndexError: iloc out of range (line ${line})`);
    const listObj = state.heap[value as string];
    if (!listObj || listObj.type !== 'list') throw new Error(`TypeError: df.iloc row needs a list (line ${line})`);
    const cells = listObj.value as RtValue[];
    const rowStart = frameRowStart(f);
    const data = (state.heap[f.buffer].value as PandasBufferValue).data;
    for (let c = 0; c < f.columns.length; c++) data[(rowStart + idx) * f.columns.length + c] = Number(cells[c] ?? 0);
    obj.repr = pandasRepr('dataframe', f, state);
    return;
  }
  throw new Error(`TypeError: '${obj.type}' has no .iloc (line ${line})`);
}

/**
 * Explicit `.copy()` on Series or DataFrame.
 */
export function frameCopy(objId: string, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad copy target (line ${line})`);
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
  throw new Error(`TypeError: '${obj.type}' has no .copy() (line ${line})`);
}

/**
 * `.sum()` reduction on Series or DataFrame.
 */
export function frameSum(objId: string, state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad sum target (line ${line})`);
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
  throw new Error(`TypeError: '${obj.type}' has no .sum() (line ${line})`);
}

/**
 * Direct subscript access on DataFrame.
 */
export function frameSubscript(dfId: string, key: RtValue, state: MemoryState, line: number): RtValue {
  return frameGetColumn(dfId, key, state, line);
}

/**
 * Direct column assignment on DataFrame: `df['col'] = [...]`.
 */
export function frameSetColumn(dfId: string, colKey: RtValue, value: RtValue, state: MemoryState, line: number): void {
  const f = state.heap[dfId].value as PandasDataFrameValue;
  const col = colName(displayValue(colKey, state));
  if (!f.columns.includes(col)) throw new Error(`KeyError: column '${col}' (line ${line})`);
  const listObj = state.heap[value as string];
  if (!listObj || listObj.type !== 'list') throw new Error(`TypeError: assigning a column needs a list (line ${line})`);
  const cells = listObj.value as RtValue[];
  const nRows = frameRowCount(f);
  const ci = f.columns.indexOf(col);
  const rowStart = frameRowStart(f);
  const data = (state.heap[f.buffer].value as PandasBufferValue).data;
  for (let r = 0; r < nRows; r++) data[(rowStart + r) * f.columns.length + ci] = Number(cells[r] ?? 0);
  state.heap[dfId].repr = pandasRepr('dataframe', f, state);
}

/**
 * `pd.read_csv()` implementation.
 */
export function readCsv(args: RtValue[], state: MemoryState, line: number): RtValue {
  if (args.length !== 2) throw new Error(`TypeError: read_csv(name, data) takes two arguments (line ${line})`);
  const name = typeof args[0] === 'string' && state.heap[args[0]]?.type === 'str'
    ? (state.heap[args[0]].value as string)
    : displayValue(args[0], state);
  const dfId = makeDataFrame([args[1]], state, line) as string;
  const df = state.heap[dfId];
  df.repr = `DataFrame (from ${name})\n${df.repr.slice('DataFrame\n'.length)}`;
  return dfId;
}

/**
 * Dispatch table for methods on Series and DataFrame objects.
 */
export function dispatchPandasMethod(objId: string, method: string, _args: RtValue[], state: MemoryState, line: number): RtValue {
  const obj = state.heap[objId];
  if (!obj) throw new Error(`TypeError: bad method target (line ${line})`);
  if (method === 'copy') return frameCopy(objId, state, line);
  if (method === 'sum') return frameSum(objId, state, line);
  throw new Error(`AttributeError: '${obj.type}' object has no attribute '${method}' (line ${line})`);
}

/**
 * Dispatch table for pandas module calls: `pd.Series()`, `pd.DataFrame()`, `pd.read_csv()`.
 */
export function dispatchPandasModule(method: string, args: RtValue[], state: MemoryState, line: number): RtValue {
  if (method === 'Series') return makeSeries(args, state, line);
  if (method === 'DataFrame') return makeDataFrame(args, state, line);
  if (method === 'read_csv') return readCsv(args, state, line);
  throw new Error(`AttributeError: module 'pandas' has no attribute '${method}' (line ${line})`);
}
