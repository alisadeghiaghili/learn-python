/**
 * SVG memory visualizer: stack frames (left) and heap objects (right).
 */

import type { GoalPreview, MemoryState, RtValue } from '../engine/types';
import type { RefEdge } from '../engine/memory';

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

function containerRefs(obj: { type: string; value: unknown }): string[] {
  const { type, value } = obj;
  if (type === 'list' || type === 'tuple' || type === 'set') {
    return (value as RtValue[]).filter((v): v is string => typeof v === 'string' && v.startsWith('obj_'));
  }
  if (type === 'dict') {
    return (value as Array<[string, RtValue]>).flatMap(([, v]) => (typeof v === 'string' && v.startsWith('obj_') ? [v] : []));
  }
  return [];
}

function objectHeight(obj: { type: string; value: unknown }): number {
  const { type, value } = obj;
  if (type === 'list' || type === 'tuple' || type === 'set') {
    return 36 + Math.max((value as unknown[]).length, 1) * OBJ_ROW_H;
  }
  if (type === 'dict') {
    return 36 + Math.max((value as unknown[]).length, 1) * OBJ_ROW_H;
  }
  return 44;
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
  } else if (obj.type === 'dict') {
    (obj.value as Array<[string, RtValue]>).forEach(([k, v], i) => {
      const label = `${k}: ${cellLabel(v, obj, i)}`;
      addText(g, x + 14, y + 42 + i * OBJ_ROW_H, label, COLORS.ink, 12, 'start', 'middle', 'IBM Plex Mono, monospace');
    });
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

/**
 * HTML target preview for the level brief (paper card).
 */
export function renderGoalHtml(goalPreview: GoalPreview | null): string {
  if (!goalPreview) return '';
  const entries = Object.entries(goalPreview.vars || {});
  const aliasMap = new Map<string, string>();
  for (const [a, b] of goalPreview.aliased || []) {
    if (!aliasMap.has(a)) aliasMap.set(a, b);
  }
  const rows = entries
    .map(([name, spec]) => {
      const alias = aliasMap.has(name)
        ? `<span class="tg-alias">≡ ${escapeHtml(aliasMap.get(name)!)}</span>`
        : '';
      return (
        `<div class="tg-row">` +
        `<span class="tg-name">${escapeHtml(name)}</span>` +
        `<span class="tg-type">${escapeHtml(spec.type || '')}</span>` +
        `<span class="tg-repr">${escapeHtml(spec.repr ?? '')}</span>` +
        `${alias}</div>`
      );
    })
    .join('');
  return rows || '<div class="tg-row"><span class="tg-type">match goal</span></div>';
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
