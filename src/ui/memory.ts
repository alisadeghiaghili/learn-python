/**
 * SVG memory visualizer: stack frames (left) and heap objects (right).
 */

import type { MemoryState, RtValue } from '../engine/types';
import { isCoroutineValue, isDefaultDictValue, isEventLoopValue, isIteratorValue, isLockValue, isMapFilterValue, isNdarrayValue, isPandasValue, isTaskValue, isThreadValue, type RefEdge } from '../engine/memory';

const COLORS = {
  bg: 'transparent',
  panel: '#141A1E',
  raised: '#1C252A',
  ink: '#E7EEF2',
  muted: '#8FA0A8',
  amber: '#F0A050',
  teal: '#5BC4B0',
  coral: '#F07070',
  line: '#2A353B',
};

const FRAME_W = 180;
const NAME_H = 28;
const OBJ_MIN_W = 120;
const OBJ_ROW_H = 26;
const GAP = 48;

interface Pos {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

/**
 * @param state - live runtime state (frames + heap)
 * @param edges - from referenceEdges()
 * @param liveIds - live object ids in allocation order
 */
export function renderMemory(svg: SVGSVGElement, state: MemoryState, edges: RefEdge[], liveIds: string[]): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0,0 L8,4 L0,8" fill="none" stroke="${COLORS.amber}" stroke-width="1.2"/>
    </marker>
  `;
  svg.appendChild(defs);

  const layout = computeLayout(state, liveIds);
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(Math.max(layout.height, 280)));

  // Labels
  addText(svg, 12, 18, 'STACK', COLORS.muted, 11, 'start', 'middle');
  addText(svg, layout.heapX, 18, 'HEAP', COLORS.muted, 11, 'start', 'middle');

  const namePositions = new Map<string, Pos & { name: string; targetId: RtValue; frame: string }>();
  const objectPositions = new Map<string, Pos>();

  // Stack frames (drawn bottom-up as call stack: module at bottom)
  let y = 40;
  for (const frame of state.frames) {
    const names = Object.keys(frame.locals);
    const h = 36 + Math.max(1, names.length) * NAME_H;
    drawFrame(svg, 12, y, FRAME_W, h, frame, frame === state.frames[state.frames.length - 1]);
    let ny = y + 36;
    for (const name of names) {
      const targetId = frame.locals[name];
      namePositions.set(`${frame.name}:${name}`, { x: 12 + FRAME_W, y: ny + NAME_H / 2, name, targetId, frame: frame.name });
      addText(svg, 24, ny + NAME_H / 2, name, COLORS.ink, 13, 'start', 'middle', 'IBM Plex Mono, monospace');
      const kind = valueKind(targetId, state);
      addText(svg, 12 + FRAME_W - 12, ny + NAME_H / 2, kind, COLORS.muted, 10, 'end', 'middle');
      ny += NAME_H;
    }
    y += h + 12;
  }

  // Heap objects
  let hy = 40;
  for (const id of liveIds) {
    const obj = state.heap[id];
    if (!obj) continue;
    const h = objectHeight(obj);
    drawObject(svg, layout.heapX, hy, layout.objW, h, obj, liveIds);
    objectPositions.set(id, {
      x: layout.heapX,
      y: hy + h / 2,
      w: layout.objW,
      h,
    });
    hy += h + 16;
  }

  // Reference edges from names to objects
  for (const edge of edges) {
    const from = namePositions.get(`${edge.fromFrame}:${edge.name}`);
    const to = objectPositions.get(edge.toId);
    if (!from || !to) continue;
    drawEdge(svg, from, to);
  }

  // Nested container edges (list/dict slots → child objects)
  for (const id of liveIds) {
    const obj = state.heap[id];
    const from = objectPositions.get(id);
    if (!obj || !from) continue;
    const refs = containerRefs(obj);
    refs.forEach((refId, i) => {
      const to = objectPositions.get(refId);
      if (!to) return;
      drawEdge(svg, { x: from.x + (from.w ?? 0) / 2, y: from.y + (i - refs.length / 2) * 8 }, to, 0.35);
    });
  }
}

function valueKind(targetId: RtValue, state: MemoryState): string {
  if (typeof targetId === 'string' && state.heap[targetId]) return state.heap[targetId].type;
  if (targetId === null) return 'None';
  if (typeof targetId === 'boolean') return 'bool';
  if (typeof targetId === 'number') return Number.isInteger(targetId) ? 'int' : 'float';
  return 'value';
}

/**
 * Color a coroutine/task lifecycle status so the state machine reads at a
 * glance: ready is hot (amber), suspended is a pause (coral), done is settled
 * (teal), and a not-yet-started coroutine is muted.
 */
function asyncStatusColor(status: string): string {
  if (status === 'ready') return COLORS.amber;
  if (status === 'suspended') return COLORS.coral;
  if (status === 'done') return COLORS.teal;
  return COLORS.muted; // pending
}

/**
 * Color a thread's lifecycle status: running is hot (amber), blocked on a lock
 * is a pause (coral), done is settled (teal), and a not-yet-started thread is
 * muted. Mirrors the asyncio palette so the two concurrency lenses read alike.
 */
function threadStatusColor(status: string): string {
  if (status === 'running') return COLORS.amber;
  if (status === 'blocked') return COLORS.coral;
  if (status === 'done') return COLORS.teal;
  return COLORS.muted; // not-started
}

function containerRefs(obj: { type: string; value: unknown }): string[] {
  const { type, value } = obj;
  // ndarray → the buffer it views
  if (isNdarrayValue(value)) return [value.buffer];
  // a pandas Series/DataFrame → its buffer box (window over a buffer)
  if (isPandasValue(value)) return [value.buffer];
  if (type === 'list' || type === 'tuple' || type === 'set') {
    return (value as RtValue[]).filter((v): v is string => typeof v === 'string' && v.startsWith('obj_'));
  }
  if (type === 'dict' || type === 'defaultdict') {
    const entries = type === 'defaultdict' ? (value as { entries: Array<[string, RtValue]> }).entries : (value as Array<[string, RtValue]>);
    return entries.flatMap(([, v]) => (typeof v === 'string' && v.startsWith('obj_') ? [v] : []));
  }
  // map/filter → the source iterator it draws from AND the function it applies
  if (isMapFilterValue(value)) return [value.source, value.fn];
  // iterator → the iterable it walks
  if (isIteratorValue(value)) return [value.source];
  // coroutine → its coroutine-function code object (and any heap locals)
  if (isCoroutineValue(value)) {
    const refs = [value.fn];
    for (const v of Object.values(value.locals)) {
      if (typeof v === 'string' && v.startsWith('obj_')) refs.push(v);
    }
    return refs;
  }
  // task → the coroutine it wraps
  if (isTaskValue(value)) return [value.coro];
  // event loop → every task in its ready queue and done list
  if (isEventLoopValue(value)) return [...value.ready, ...value.done];
  // thread → the target function it runs (and any heap objects in its locals)
  if (isThreadValue(value)) {
    const refs = [value.target];
    for (const v of Object.values(value.locals)) {
      if (typeof v === 'string' && v.startsWith('obj_')) refs.push(v);
    }
    return refs;
  }
  // a held lock → the thread that holds it
  if (isLockValue(value)) return value.holder ? [value.holder] : [];
  return [];
}

function objectHeight(obj: { type: string; value: unknown; repr?: string }): number {
  const { type, value } = obj;
  // ndarray carries a tag line (dtype/shape/view) under the value — taller box.
  if (type === 'ndarray') return 62;
  // a pandas box renders a small table (header + one line per row/column)
  if (type === 'series' || type === 'dataframe') return pandasBoxHeight(obj.repr ?? '');
  if (type === 'list' || type === 'tuple' || type === 'set') {
    return 36 + Math.max((value as unknown[]).length, 1) * OBJ_ROW_H;
  }
  if (type === 'dict') {
    return 36 + Math.max((value as unknown[]).length, 1) * OBJ_ROW_H;
  }
  if (type === 'defaultdict') {
    const entries = isDefaultDictValue(value) ? value.entries : [];
    return 36 + Math.max(entries.length, 1) * OBJ_ROW_H;
  }
  // an event loop shows a header line + a ready/done queue line — two lines tall
  if (type === 'eventloop') return 58;
  return 44;
}

/** A pandas box shows a table: 1 header line + 1 line per row. */
function pandasBoxHeight(repr: string): number {
  const lines = repr.split('\n').length;
  return 34 + lines * OBJ_ROW_H;
}

interface Layout {
  width: number;
  height: number;
  heapX: number;
  objW: number;
}

function computeLayout(state: MemoryState, liveIds: string[]): Layout {
  const stackH = state.frames.reduce((acc, f) => acc + 36 + Math.max(1, Object.keys(f.locals).length) * NAME_H + 12, 40);
  const heapH = liveIds.reduce((acc, id) => {
    const obj = state.heap[id];
    return acc + (obj ? objectHeight(obj) : 0) + 16;
  }, 40);
  const width = FRAME_W + GAP + OBJ_MIN_W + 80;
  return {
    width,
    height: Math.max(stackH, heapH, 280),
    heapX: 12 + FRAME_W + GAP,
    objW: OBJ_MIN_W + 60,
  };
}

function drawFrame(svg: SVGSVGElement, x: number, y: number, w: number, h: number, frame: { name: string; locals: Record<string, RtValue> }, active: boolean): void {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(w));
  rect.setAttribute('height', String(h));
  rect.setAttribute('rx', '8');
  rect.setAttribute('fill', active ? '#1A2228' : COLORS.panel);
  rect.setAttribute('stroke', active ? COLORS.amber : COLORS.line);
  rect.setAttribute('stroke-width', active ? '1.5' : '1');
  g.appendChild(rect);
  addText(g, x + 12, y + 18, frame.name, active ? COLORS.amber : COLORS.muted, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
  svg.appendChild(g);
}

function drawObject(svg: SVGSVGElement, x: number, y: number, w: number, h: number, obj: { id: string; type: string; repr: string; value: unknown }, _liveIds: string[]): void {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(w));
  rect.setAttribute('height', String(h));
  rect.setAttribute('rx', '8');
  rect.setAttribute('fill', COLORS.raised);
  rect.setAttribute('stroke', COLORS.teal);
  rect.setAttribute('stroke-width', '1');
  g.appendChild(rect);

  addText(g, x + 10, y + 18, `${obj.type}`, COLORS.teal, 11, 'start', 'middle', 'IBM Plex Mono, monospace');
  addText(g, x + w - 10, y + 18, obj.id, COLORS.muted, 10, 'end', 'middle', 'IBM Plex Mono, monospace');

  if (obj.type === 'list' || obj.type === 'tuple' || obj.type === 'set') {
    (obj.value as RtValue[]).forEach((v, i) => {
      const label = cellLabel(v, obj, i);
      addText(g, x + 14, y + 42 + i * OBJ_ROW_H, label, COLORS.ink, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
    });
  } else if (obj.type === 'dict' || obj.type === 'defaultdict') {
    const entries = obj.type === 'defaultdict'
      ? (isDefaultDictValue(obj.value) ? obj.value.entries : [])
      : (obj.value as Array<[string, RtValue]>);
    if (obj.type === 'defaultdict' && isDefaultDictValue(obj.value)) {
      addText(g, x + 14, y + 32, `⚙ default: ${obj.value.factory}()`, COLORS.amber, 11, 'start', 'middle', 'IBM Plex Mono, monospace');
    }
    entries.forEach(([k, v], i) => {
      const label = `${k}: ${cellLabel(v, obj, i)}`;
      addText(g, x + 14, y + 42 + i * OBJ_ROW_H, label, COLORS.ink, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
    });
  } else if (obj.type === 'ndarray' && isNdarrayValue(obj.value)) {
    // ndarray: the value it shows, plus a tag line pointing at its buffer
    const ndv = obj.value as { dtype: string; shape: number; view: boolean; buffer: string };
    addText(g, x + 14, y + 30, obj.repr, COLORS.ink, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
    addText(g, x + 14, y + 48, `${ndv.dtype}[${ndv.shape}] · ${ndv.view ? 'view' : 'own'} → ${ndv.buffer}`, COLORS.amber, 10, 'start', 'middle', 'IBM Plex Mono, monospace');
  } else if ((obj.type === 'series' || obj.type === 'dataframe') && isPandasValue(obj.value)) {
    // a pandas box: a small table (one line per row) + a tag to its buffer
    const pv = obj.value as { view: boolean; buffer: string };
    const lines = obj.repr.split('\n');
    const head = lines[0] ?? '';
    addText(g, x + 14, y + 30, head, COLORS.amber, 11, 'start', 'middle', 'IBM Plex Mono, monospace');
    for (let i = 1; i < lines.length; i++) {
      addText(g, x + 14, y + 30 + i * OBJ_ROW_H, lines[i] ?? '', COLORS.ink, 11, 'start', 'middle', 'IBM Plex Mono, monospace');
    }
    const tagY = y + 30 + lines.length * OBJ_ROW_H;
    addText(g, x + 14, tagY, `${obj.type} · ${pv.view ? 'view' : 'own'} → ${pv.buffer}`, COLORS.amber, 10, 'start', 'middle', 'IBM Plex Mono, monospace');
  } else if (obj.type === 'buffer') {
    // buffer: the flat run of numbers an ndarray window views
    addText(g, x + 14, y + 32, obj.repr, COLORS.ink, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
  } else if (isMapFilterValue(obj.value)) {
    // map/filter: show the function it applies and the source iterator it draws from
    addText(g, x + 14, y + 32, `${obj.type === 'filteriter' ? '⚲' : 'ƒ'} ${obj.value.fn} · src ${obj.value.source}`, COLORS.ink, 11, 'start', 'middle', 'IBM Plex Mono, monospace');
  } else if (isIteratorValue(obj.value)) {
    // iterator: show its target and current cursor
    addText(g, x + 14, y + 32, `→ ${obj.value.source} · i=${obj.value.index}`, COLORS.ink, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
  } else if (obj.type === 'coroutine' && isCoroutineValue(obj.value)) {
    // a coroutine: the suspended function, its status, and its saved place (pc)
    const c = obj.value as { name: string; status: string; pc: number };
    addText(g, x + 14, y + 32, `coro ${c.name}()`, COLORS.ink, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
    addText(g, x + w - 10, y + 32, `${c.status} · pc ${c.pc}`, asyncStatusColor(c.status), 10, 'end', 'middle', 'IBM Plex Mono, monospace');
  } else if (obj.type === 'task' && isTaskValue(obj.value)) {
    // a task: a named handle to a coroutine, with its lifecycle status
    const t = obj.value as { name: string; status: string };
    addText(g, x + 14, y + 32, `Task ${t.name}`, COLORS.ink, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
    addText(g, x + w - 10, y + 32, t.status, asyncStatusColor(t.status), 10, 'end', 'middle', 'IBM Plex Mono, monospace');
  } else if (obj.type === 'eventloop' && isEventLoopValue(obj.value)) {
    // the event loop: its tick count and the ready/done queues it round-robins
    const l = obj.value as { tick: number; running: boolean; ready: string[]; done: string[] };
    addText(g, x + 14, y + 24, `EventLoop · tick ${l.tick}`, COLORS.ink, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
    addText(g, x + 14, y + 42, `running ${l.running ? '●' : '○'} · ${l.ready.length} ready / ${l.done.length} done`, l.running ? COLORS.amber : COLORS.muted, 10, 'start', 'middle', 'IBM Plex Mono, monospace');
  } else if (obj.type === 'thread' && isThreadValue(obj.value)) {
    // a thread: the target it runs and its lifecycle status, plus the saved pc
    const t = obj.value as { name: string; status: string; pc: number };
    addText(g, x + 14, y + 32, `Thread ${t.name}`, COLORS.ink, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
    addText(g, x + w - 10, y + 32, `${t.status} · pc ${t.pc}`, threadStatusColor(t.status), 10, 'end', 'middle', 'IBM Plex Mono, monospace');
  } else if (obj.type === 'lock' && isLockValue(obj.value)) {
    // a lock: HELD (with who) or free — the mutual-exclusion switch
    const l = obj.value as { held: boolean; holder: string | null };
    addText(g, x + 14, y + 32, l.held ? `🔒 HELD · ${l.holder}` : `🔓 free`, l.held ? COLORS.coral : COLORS.teal, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
  } else if (obj.type === 'str') {
    addText(g, x + 14, y + 32, obj.repr, COLORS.ink, 13, 'start', 'middle', 'IBM Plex Mono, monospace');
  } else {
    addText(g, x + 14, y + 32, obj.repr, COLORS.ink, 13, 'start', 'middle', 'IBM Plex Mono, monospace');
  }

  svg.appendChild(g);
}

function cellLabel(v: RtValue, container: { type: string; value: unknown }, _i: number): string {
  if (typeof v === 'string' && v.startsWith('obj_')) return `→ ${v}`;
  if (Array.isArray(container.value) && container.type !== 'dict') {
    // show primitive via stored repr slice when available
    return formatPrimitive(v);
  }
  return formatPrimitive(v);
}

function formatPrimitive(v: RtValue): string {
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'string' && v.startsWith('obj_')) return `→ ${v}`;
  if (typeof v === 'string') return `'${v}'`;
  return String(v);
}

function drawEdge(parent: SVGElement, from: Pos, to: Pos, opacity = 1): void {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const x1 = from.x;
  const y1 = from.y;
  const x2 = to.x;
  const y2 = to.y;
  const midX = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', COLORS.amber);
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-opacity', String(opacity));
  path.setAttribute('marker-end', 'url(#arrow)');
  path.setAttribute('class', 'ref-edge');
  parent.appendChild(path);

  // draw animation
  try {
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    path.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: 320, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' },
    );
  } catch {
    // getTotalLength may fail in some environments; edge still visible
  }
}

/**
 * The RAM view: a dense memory map showing where each object *lives* — its
 * address, size, and reference count — rather than the abstract graph. Columns:
 * ADDR (hex, monotonic like malloc) · OBJ (id) · TYPE · BYTES · REFC · VALUE.
 *
 * For a numpy buffer the VALUE cell draws the raw byte cells; every ndarray
 * window over that buffer then paints its own offset/shape window as a tinted
 * strip beneath the cells — the flagship "how it works in RAM" picture, where
 * a slice is just a narrower window over the same contiguous run.
 */
export function renderRam(svg: SVGSVGElement, state: MemoryState, liveIds: string[]): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const ids = liveIds.filter((id) => state.heap[id]);
  const HEADER_X = 14;
  const COL_OBJ = HEADER_X + 56;
  const COL_TYPE = COL_OBJ + 92;
  const COL_BYTES = COL_TYPE + 96;
  const COL_REF = COL_BYTES + 64;
  const COL_VALUE = COL_REF + 52;
  const VALUE_W = 360;
  const width = COL_VALUE + VALUE_W + 20;
  const ROW_H = 24;
  const ROW_GAP = 8;
  const mono = 'IBM Plex Mono, monospace';
  const CELL_W = 30;
  const CELL_GAP = 2;
  const CELL_H = 16;
  const VIEW_H = 14;

  // One color per ndarray view over a given buffer, so multiple overlapping
  // windows stay distinguishable in the column strip.
  const VIEW_PALETTE = [COLORS.amber, COLORS.coral, COLORS.teal];

  const bufferInfo = new Map<string, { data: number[]; y: number }>();
  const viewLists = new Map<string, string[]>(); // bufferId -> ndarray ids in order
  for (const id of ids) {
    const obj = state.heap[id]!;
    if (obj.type === 'ndarray' && isNdarrayValue(obj.value)) {
      const v = obj.value as { buffer: string };
      const list = viewLists.get(v.buffer) ?? [];
      list.push(id);
      viewLists.set(v.buffer, list);
    }
  }
  const rowH = (obj: { id: string; type: string }): number => {
    if (obj.type !== 'buffer') return ROW_H;
    const n = viewLists.get(obj.id)?.length ?? 0;
    return 48 + n * VIEW_H;
  };
  const totalH = Math.max(ids.reduce((acc, id) => acc + rowH(state.heap[id]!) + ROW_GAP, 26), 220);

  svg.setAttribute('viewBox', `0 0 ${width} ${totalH}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(Math.max(totalH, 200)));

  // Column header band
  addText(svg, HEADER_X, 18, 'ADDR', COLORS.muted, 10, 'start', 'middle', mono);
  addText(svg, COL_OBJ, 18, 'OBJ', COLORS.muted, 10, 'start', 'middle', mono);
  addText(svg, COL_TYPE, 18, 'TYPE', COLORS.muted, 10, 'start', 'middle', mono);
  addText(svg, COL_BYTES, 18, 'BYTES', COLORS.muted, 10, 'start', 'middle', mono);
  addText(svg, COL_REF, 18, 'REFC', COLORS.muted, 10, 'start', 'middle', mono);
  addText(svg, COL_VALUE, 18, 'VALUE', COLORS.muted, 10, 'start', 'middle', mono);

  let y = 34;
  for (const id of ids) {
    const obj = state.heap[id]!;
    const h = rowH(obj);
    const midY = y + h / 2;
    const isBuffer = obj.type === 'buffer';

    // row divider
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(HEADER_X));
    line.setAttribute('x2', String(width - 14));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', COLORS.line);
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    addText(svg, HEADER_X, midY, hexAddr(obj.addr), COLORS.amber, 11, 'start', 'middle', mono);
    addText(svg, COL_OBJ, midY, obj.id, COLORS.ink, 11, 'start', 'middle', mono);
    addText(svg, COL_TYPE, midY, obj.type, COLORS.teal, 11, 'start', 'middle', mono);
    addText(svg, COL_BYTES, midY, String(obj.byteSize), COLORS.ink, 11, 'start', 'middle', mono);
    addText(svg, COL_REF, midY, String(obj.refCount), obj.refCount === 0 ? COLORS.coral : COLORS.ink, 11, 'start', 'middle', mono);

    if (isBuffer) {
      const data = (obj.value as { data?: number[] }).data ?? [];
      const barY = y + ROW_H + 4;
      for (let i = 0; i < data.length; i++) {
        const cx = COL_VALUE + i * (CELL_W + CELL_GAP);
        const cell = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        cell.setAttribute('x', String(cx));
        cell.setAttribute('y', String(barY));
        cell.setAttribute('width', String(CELL_W));
        cell.setAttribute('height', String(CELL_H));
        cell.setAttribute('rx', '3');
        cell.setAttribute('fill', '#223038');
        cell.setAttribute('stroke', COLORS.line);
        svg.appendChild(cell);
        addText(svg, cx + CELL_W / 2, barY + CELL_H / 2, String(data[i]), COLORS.ink, 10, 'middle', 'middle', mono);
      }
      addText(svg, COL_VALUE, midY, `${hexAddr(obj.addr)} · ${data.length}×8B`, COLORS.muted, 10, 'start', 'middle', mono);
      bufferInfo.set(id, { data, y: barY });
    } else {
      const label = obj.type === 'ndarray'
        ? `${obj.repr}`
        : obj.repr.length > 40 ? obj.repr.slice(0, 40) + '…' : obj.repr;
      addText(svg, COL_VALUE, midY, label, COLORS.ink, 11, 'start', 'middle', mono);
    }

    // An ndarray view: paint its window in its buffer's column strip, aligned
    // to the same byte columns. Multiple views over one buffer stack as separate
    // rows, each showing the exact [offset..offset+shape) range it reads.
    if (obj.type === 'ndarray' && isNdarrayValue(obj.value)) {
      const v = obj.value as { buffer: string; offset: number; shape: number };
      const buf = bufferInfo.get(v.buffer);
      const list = viewLists.get(v.buffer) ?? [];
      const idx = list.indexOf(id);
      const bufLen = buf ? buf.data.length : 0;
      if (buf) {
        const color = VIEW_PALETTE[idx % VIEW_PALETTE.length];
        const barY = buf.y + CELL_H + 4 + idx * VIEW_H;
        const x = COL_VALUE + v.offset * (CELL_W + CELL_GAP);
        const w = Math.max(v.shape, 1) * (CELL_W + CELL_GAP) - CELL_GAP;
        const win = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        win.setAttribute('x', String(x));
        win.setAttribute('y', String(barY));
        win.setAttribute('width', String(w));
        win.setAttribute('height', String(VIEW_H - 4));
        win.setAttribute('rx', '2');
        win.setAttribute('fill', color);
        win.setAttribute('fill-opacity', '0.28');
        win.setAttribute('stroke', color);
        win.setAttribute('stroke-width', '1');
        svg.appendChild(win);
        // Label in a gutter just past the buffer cells so it never collides.
        const labelX = COL_VALUE + Math.max(bufLen, v.offset + v.shape) * (CELL_W + CELL_GAP) + 8;
        addText(svg, labelX, barY + (VIEW_H - 4) / 2, `${obj.id}  [${v.offset}..${v.offset + v.shape}]`, color, 9, 'start', 'middle', mono);
      }
    }

    y += h + ROW_GAP;
  }
}

function hexAddr(addr: number): string {
  return `0x${addr.toString(16).padStart(4, '0')}`;
}

function addText(parent: SVGElement, x: number, y: number, text: string, fill: string, size: number, anchor: string, baseline: string, family = 'IBM Plex Sans, sans-serif'): void {
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('x', String(x));
  t.setAttribute('y', String(y));
  t.setAttribute('fill', fill);
  t.setAttribute('font-size', String(size));
  t.setAttribute('text-anchor', anchor);
  t.setAttribute('dominant-baseline', baseline);
  t.setAttribute('font-family', family);
  t.textContent = text;
  parent.appendChild(t);
}

