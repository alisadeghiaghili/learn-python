/**
 * Tabbed board: the signature Memory canvas (stack frames → heap objects →
 * amber reference edges) and a Plot tab for the plotting levels (Phase C).
 *
 * The memory tab hosts a persistent `<svg id="canvas">` — `renderMemory` clears
 * and re-renders it on every state change, so the reference-edge draw animation
 * keeps firing without the tab being rebuilt.
 */

import type { MemoryState, PlotSpec } from '../engine/types';
import { escapeHtml } from './dialog';

// Plot palette mirrors the memory canvas (memory.ts) so the two lenses read as
// one board: amber = data, teal = the fitted trend, muted ink for axes/labels.
const PLOT = {
  ink: '#E7EEF2',
  muted: '#8FA0A8',
  amber: '#F0A050',
  teal: '#5BC4B0',
  coral: '#F07070',
  line: '#2A353B',
};
const PLOT_MONO = 'IBM Plex Mono, monospace';
const PLOT_SANS = 'IBM Plex Sans, sans-serif';

/** Shorten an axis value for a tick label without losing its meaning. */
function fmtTick(n: number): string {
  if (!isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 10000 || (abs > 0 && abs < 0.01)) return n.toExponential(1);
  return String(Math.round(n * 100) / 100);
}

/** Categorical palette for pie slices / bar fills (extends the board palette). */
const CAT = [
  PLOT.amber, PLOT.teal, '#F07070', '#7CB0F0', '#C9A0F0',
  '#F0D070', '#90E0A0', '#E0A0D0', '#B0C0D0', '#D0B090',
];
const catColor = (i: number): string => CAT[i % CAT.length]!;

/** Interpolate the heatmap ramp (teal → amber) at t in [0, 1]. */
function heatColor(t: number): string {
  const c = (a: number, b: number): number => Math.round(a + (b - a) * t);
  const r = c(0x5b, 0xf0), g = c(0xc4, 0xa0), b = c(0xb0, 0x50);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Dispatch a plot spec to the renderer for its kind. Every renderer returns a
 * full self-contained `<svg>` string, so the result composes into innerHTML.
 */
function plotSvg(spec: PlotSpec): string {
  if (spec.kind === 'bar' || spec.kind === 'countplot' || spec.kind === 'hist') return barPlotSvg(spec);
  if (spec.kind === 'pie') return piePlotSvg(spec);
  if (spec.kind === 'boxplot') return boxPlotSvg(spec);
  if (spec.kind === 'heatmap') return heatPlotSvg(spec);
  return xyPlotSvg(spec); // scatter, line, area, reg
}

/**
 * Render a 2-D x/y chart: a light grid, labelled axes, and the series (amber
 * dots for `scatter`; a connected teal line for `line`; a filled band for
 * `area`; dots + a fitted line for `reg`).
 */
function xyPlotSvg(spec: PlotSpec): string {
  const W = 480;
  const H = 360;
  const m = { l: 52, r: 18, t: 32, b: 42 };
  const px0 = m.l;
  const px1 = W - m.r;
  const py0 = H - m.b;
  const py1 = m.t;
  const pts = spec.points ?? [];

  // Data bounds, padded 8% so points never sit on the axis edges.
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const [x, y] of pts) {
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  }
  if (pts.length === 0) {
    xmin = 0; xmax = 1; ymin = 0; ymax = 1;
  }
  if (xmax === xmin) { xmin -= 1; xmax += 1; }
  if (ymax === ymin) { ymin -= 1; ymax += 1; }
  const padX = (xmax - xmin) * 0.08;
  const padY = (ymax - ymin) * 0.08;
  xmin -= padX; xmax += padX;
  ymin -= padY; ymax += padY;

  const sx = (x: number) => px0 + ((x - xmin) / (xmax - xmin)) * (px1 - px0);
  const sy = (y: number) => py0 - ((y - ymin) / (ymax - ymin)) * (py0 - py1);

  // Faint gridlines + tick labels, evenly spaced across the padded range.
  const TICKS = 5;
  let grid = '';
  let ticks = '';
  for (let i = 0; i < TICKS; i++) {
    const fx = xmin + ((xmax - xmin) * i) / (TICKS - 1);
    const fy = ymin + ((ymax - ymin) * i) / (TICKS - 1);
    const X = sx(fx).toFixed(1);
    const Y = sy(fy).toFixed(1);
    grid += `<line x1="${X}" y1="${py1}" x2="${X}" y2="${py0}" stroke="${PLOT.line}" stroke-width="1"/>`;
    grid += `<line x1="${px0}" y1="${Y}" x2="${px1}" y2="${Y}" stroke="${PLOT.line}" stroke-width="1"/>`;
    ticks += `<text x="${X}" y="${py0 + 18}" fill="${PLOT.muted}" font-size="11" text-anchor="middle" font-family="${PLOT_MONO}">${fmtTick(fx)}</text>`;
    ticks += `<text x="${px0 - 8}" y="${Number(Y) + 4}" fill="${PLOT.muted}" font-size="11" text-anchor="end" font-family="${PLOT_MONO}">${fmtTick(fy)}</text>`;
  }

  // The series, by kind.
  let series = '';
  const lineD = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ');
  if (spec.kind === 'area') {
    if (pts.length >= 2) {
      const areaD = lineD + ` L${sx(pts[pts.length - 1]![0]!).toFixed(1)},${py0.toFixed(1)} L${sx(pts[0]![0]!).toFixed(1)},${py0.toFixed(1)} Z`;
      series += `<path d="${areaD}" fill="${PLOT.teal}" fill-opacity="0.25" stroke="none"/>`;
      series += `<path d="${lineD}" fill="none" stroke="${PLOT.teal}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
  } else if (spec.kind === 'line' && pts.length >= 2) {
    series += `<path d="${lineD}" fill="none" stroke="${PLOT.teal}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    series += pts.map(([x, y]) => `<circle cx="${sx(x).toFixed(1)}" cy="${sy(y).toFixed(1)}" r="3.5" fill="${PLOT.teal}"/>`).join('');
  } else if (spec.kind === 'reg') {
    series += pts.map(([x, y]) => `<circle cx="${sx(x).toFixed(1)}" cy="${sy(y).toFixed(1)}" r="4.5" fill="${PLOT.amber}" fill-opacity="0.9" stroke="#0b0f12" stroke-width="1"/>`).join('');
    const slope = spec.slope ?? 0;
    const intercept = spec.intercept ?? 0;
    const x0 = pts[0]?.[0] ?? xmin;
    const x1 = pts[pts.length - 1]?.[0] ?? xmax;
    series += `<path d="M${sx(x0).toFixed(1)},${sy(slope * x0 + intercept).toFixed(1)} L${sx(x1).toFixed(1)},${sy(slope * x1 + intercept).toFixed(1)}" fill="none" stroke="${PLOT.teal}" stroke-width="2.5" stroke-linecap="round"/>`;
  } else {
    series = pts.map(([x, y]) => `<circle cx="${sx(x).toFixed(1)}" cy="${sy(y).toFixed(1)}" r="4.5" fill="${PLOT.amber}" fill-opacity="0.9" stroke="#0b0f12" stroke-width="1"/>`).join('');
  }

  const axes =
    `<line x1="${px0}" y1="${py0}" x2="${px1}" y2="${py0}" stroke="${PLOT.muted}" stroke-width="1.5"/>` +
    `<line x1="${px0}" y1="${py1}" x2="${px0}" y2="${py0}" stroke="${PLOT.muted}" stroke-width="1.5"/>`;

  const title = spec.title
    ? `<text x="${(px0 + px1) / 2}" y="20" fill="${PLOT.ink}" font-size="13" text-anchor="middle" font-family="${PLOT_SANS}" font-weight="600">${escapeHtml(spec.title)}</text>`
    : '';

  return `<svg class="plot-svg" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(spec.title || spec.kind)}">${title}${grid}${axes}${ticks}${series}</svg>`;
}

/** A histogram: auto-bin the raw `values` (≈9 bins) and draw one bar per bin. */
function computeHistBins(values: number[]): Array<{ lo: number; hi: number; count: number }> {
  if (values.length === 0) return [];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) { lo -= 0.5; hi += 0.5; }
  const NBINS = 9;
  const width = (hi - lo) / NBINS;
  const counts = new Array(NBINS).fill(0);
  for (const v of values) {
    let b = Math.floor((v - lo) / width);
    if (b < 0) b = 0;
    if (b >= NBINS) b = NBINS - 1;
    counts[b]!++;
  }
  return counts.map((count, i) => ({ lo: lo + i * width, hi: lo + (i + 1) * width, count }));
}

/**
 * A categorical bar chart shared by `bar` (labels + values), `countplot`
 * (tally the raw labels), and `hist` (auto-binned values). Vertical bars with
 * value labels on top and rotated category labels beneath.
 */
function barPlotSvg(spec: PlotSpec): string {
  let labels: string[];
  let values: number[];
  if (spec.kind === 'countplot') {
    const raw = spec.labels ?? [];
    const counts = new Map<string, number>();
    for (const l of raw) counts.set(l, (counts.get(l) ?? 0) + 1);
    const items = [...counts.entries()];
    labels = items.map(([k]) => k);
    values = items.map(([, c]) => c);
  } else if (spec.kind === 'hist') {
    const bins = computeHistBins(spec.values ?? []);
    labels = bins.map((b) => `${fmtTick(b.lo)}–${fmtTick(b.hi)}`);
    values = bins.map((b) => b.count);
  } else {
    labels = spec.labels ?? [];
    values = spec.values ?? [];
  }
  const n = labels.length;
  const W = 480;
  const H = 360;
  const m = { l: 52, r: 18, t: 40, b: 76 };
  const px0 = m.l;
  const px1 = W - m.r;
  const py0 = H - m.b;
  const py1 = m.t;

  const maxVal = Math.max(0, ...values, 1);
  let grid = '';
  let yticks = '';
  const TICKS = 5;
  for (let i = 0; i < TICKS; i++) {
    const v = (maxVal * i) / (TICKS - 1);
    const Y = py0 - (v / maxVal) * (py0 - py1);
    grid += `<line x1="${px0}" y1="${Y.toFixed(1)}" x2="${px1}" y2="${Y.toFixed(1)}" stroke="${PLOT.line}" stroke-width="1"/>`;
    yticks += `<text x="${px0 - 8}" y="${Number(Y) + 4}" fill="${PLOT.muted}" font-size="11" text-anchor="end" font-family="${PLOT_MONO}">${fmtTick(v)}</text>`;
  }

  let bars = '';
  let xlabels = '';
  if (n > 0) {
    const slot = (px1 - px0) / n;
    const barW = slot * 0.62;
    for (let i = 0; i < n; i++) {
      const x = px0 + slot * i + (slot - barW) / 2;
      const h = ((values[i] ?? 0) / maxVal) * (py0 - py1);
      const y = py0 - h;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${catColor(i)}" fill-opacity="0.9" stroke="#0b0f12" stroke-width="1"/>`;
      bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" fill="${PLOT.ink}" font-size="11" text-anchor="middle" font-family="${PLOT_MONO}">${fmtTick(values[i] ?? 0)}</text>`;
      const cx = x + barW / 2;
      xlabels += `<text x="${cx.toFixed(1)}" y="${py0 + 14}" fill="${PLOT.muted}" font-size="10.5" text-anchor="end" transform="rotate(-32 ${cx.toFixed(1)} ${(py0 + 14).toFixed(1)})" font-family="${PLOT_MONO}">${escapeHtml(labels[i] ?? '')}</text>`;
    }
  }

  const axes =
    `<line x1="${px0}" y1="${py0}" x2="${px1}" y2="${py0}" stroke="${PLOT.muted}" stroke-width="1.5"/>` +
    `<line x1="${px0}" y1="${py1}" x2="${px0}" y2="${py0}" stroke="${PLOT.muted}" stroke-width="1.5"/>`;

  const title = `<text x="${W / 2}" y="20" fill="${PLOT.ink}" font-size="13" text-anchor="middle" font-family="${PLOT_SANS}" font-weight="600">${escapeHtml(spec.title || spec.kind)}</text>`;

  return `<svg class="plot-svg" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(spec.title || spec.kind)}">${title}${grid}${axes}${yticks}${bars}${xlabels}</svg>`;
}

/** A pie chart: one wedge per (label, value), plus a legend with percentages. */
function piePlotSvg(spec: PlotSpec): string {
  const labels = spec.labels ?? [];
  const values = spec.values ?? [];
  const W = 480;
  const H = 360;
  const cx = 180;
  const cy = 190;
  const R = 120;
  const total = values.reduce((a, b) => a + b, 0);
  const pol = (ang: number, r: number): [number, number] => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];

  let wedges = '';
  let legend = '';
  let start = -Math.PI / 2;
  for (let i = 0; i < values.length; i++) {
    const frac = total > 0 ? (values[i] ?? 0) / total : 0;
    const end = start + frac * Math.PI * 2;
    const [x0, y0] = pol(start, R);
    const [x1, y1] = pol(end, R);
    const large = frac > 0.5 ? 1 : 0;
    if (frac > 0) {
      wedges += `<path d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${catColor(i)}" stroke="#0b0f12" stroke-width="1.2"/>`;
    }
    const lx = 28;
    const ly = 44 + i * 22;
    legend += `<rect x="${lx}" y="${ly - 9}" width="14" height="14" rx="3" fill="${catColor(i)}"/>`;
    legend += `<text x="${lx + 22}" y="${ly + 1}" fill="${PLOT.ink}" font-size="11.5" text-anchor="start" font-family="${PLOT_MONO}">${escapeHtml(labels[i] ?? '')} · ${(frac * 100).toFixed(0)}%</text>`;
    start = end;
  }

  const title = `<text x="${W / 2}" y="20" fill="${PLOT.ink}" font-size="13" text-anchor="middle" font-family="${PLOT_SANS}" font-weight="600">${escapeHtml(spec.title || 'pie')}</text>`;

  return `<svg class="plot-svg" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(spec.title || 'pie')}">${title}${wedges}${legend}</svg>`;
}

/** A box-and-whisker chart computed from raw `values` (quartiles + outliers). */
function boxPlotSvg(spec: PlotSpec): string {
  const vals = [...(spec.values ?? [])].sort((a, b) => a - b);
  const W = 480;
  const H = 360;
  const m = { l: 52, r: 18, t: 40, b: 40 };
  const py0 = H - m.b;
  const py1 = m.t;
  const cx = (52 + (W - 18)) / 2;

  let svg = `<text x="${W / 2}" y="20" fill="${PLOT.ink}" font-size="13" text-anchor="middle" font-family="${PLOT_SANS}" font-weight="600">${escapeHtml(spec.title || 'boxplot')}</text>`;
  if (vals.length === 0) {
    svg += `<text x="${W / 2}" y="${H / 2}" fill="${PLOT.muted}" font-size="13" text-anchor="middle">no values</text>`;
    return `<svg class="plot-svg" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(spec.title || 'boxplot')}">${svg}</svg>`;
  }

  const q = (p: number): number => {
    const pos = (vals.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = vals[base + 1];
    return next !== undefined ? vals[base]! + rest * (next - vals[base]!) : vals[base]!;
  };
  const q1 = q(0.25);
  const med = q(0.5);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  const loFence = q1 - 1.5 * iqr;
  const hiFence = q3 + 1.5 * iqr;
  const inliers = vals.filter((v) => v >= loFence && v <= hiFence);
  const loWhisk = inliers.length ? Math.min(...inliers) : vals[0]!;
  const hiWhisk = inliers.length ? Math.max(...inliers) : vals[vals.length - 1]!;
  const outliers = vals.filter((v) => v < loFence || v > hiFence);

  let dmin = Math.min(...vals);
  let dmax = Math.max(...vals);
  if (dmin === dmax) { dmin -= 1; dmax += 1; }
  const pad = (dmax - dmin) * 0.1;
  dmin -= pad; dmax += pad;
  const sy = (v: number) => py0 - ((v - dmin) / (dmax - dmin)) * (py0 - py1);

  // y axis + gridlines
  let grid = '';
  const TICKS = 5;
  for (let i = 0; i < TICKS; i++) {
    const v = dmin + ((dmax - dmin) * i) / (TICKS - 1);
    const Y = sy(v).toFixed(1);
    grid += `<line x1="52" y1="${Y}" x2="${W - 18}" y2="${Y}" stroke="${PLOT.line}" stroke-width="1"/>`;
    grid += `<text x="44" y="${Number(Y) + 4}" fill="${PLOT.muted}" font-size="11" text-anchor="end" font-family="${PLOT_MONO}">${fmtTick(v)}</text>`;
  }

  const bw = 120;
  const bx = cx - bw / 2;
  let box = '';
  box += `<line x1="${cx}" y1="${sy(loWhisk).toFixed(1)}" x2="${cx}" y2="${sy(hiWhisk).toFixed(1)}" stroke="${PLOT.teal}" stroke-width="2"/>`;
  box += `<line x1="${(cx - 24).toFixed(1)}" y1="${sy(loWhisk).toFixed(1)}" x2="${(cx + 24).toFixed(1)}" y2="${sy(loWhisk).toFixed(1)}" stroke="${PLOT.teal}" stroke-width="2"/>`;
  box += `<line x1="${(cx - 24).toFixed(1)}" y1="${sy(hiWhisk).toFixed(1)}" x2="${(cx + 24).toFixed(1)}" y2="${sy(hiWhisk).toFixed(1)}" stroke="${PLOT.teal}" stroke-width="2"/>`;
  box += `<rect x="${bx}" y="${sy(q3).toFixed(1)}" width="${bw}" height="${(sy(q1) - sy(q3)).toFixed(1)}" rx="3" fill="${PLOT.teal}" fill-opacity="0.22" stroke="${PLOT.teal}" stroke-width="2"/>`;
  box += `<line x1="${bx}" y1="${sy(med).toFixed(1)}" x2="${bx + bw}" y2="${sy(med).toFixed(1)}" stroke="${PLOT.amber}" stroke-width="2.5"/>`;
  for (const o of outliers) box += `<circle cx="${cx}" cy="${sy(o).toFixed(1)}" r="3.5" fill="${PLOT.coral}"/>`;

  const axes = `<line x1="52" y1="${py1}" x2="52" y2="${py0}" stroke="${PLOT.muted}" stroke-width="1.5"/>`;

  return `<svg class="plot-svg" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(spec.title || 'boxplot')}">${grid}${axes}${box}</svg>`;
}

/** A heatmap: a grid of cells (row labels × column labels) shaded by value. */
function heatPlotSvg(spec: PlotSpec): string {
  const rows = spec.labels ?? [];
  const cols = spec.cols ?? [];
  const matrix = spec.matrix ?? [];
  const all = matrix.flat();
  let vmin = all.length ? Math.min(...all) : 0;
  let vmax = all.length ? Math.max(...all) : 1;
  if (vmin === vmax) { vmin -= 0.5; vmax += 0.5; }

  const cell = 54;
  const labelL = 52;
  const labelT = 28;
  const gridW = Math.max(cols.length, 1) * cell;
  const gridH = Math.max(rows.length, 1) * cell;
  const W = Math.max(480, labelL + gridW + 24);
  const H = labelT + gridH + 24;
  const x0 = labelL;
  const y0 = labelT;

  let svg = `<text x="${W / 2}" y="18" fill="${PLOT.ink}" font-size="13" text-anchor="middle" font-family="${PLOT_SANS}" font-weight="600">${escapeHtml(spec.title || 'heatmap')}</text>`;
  cols.forEach((c, j) => {
    svg += `<text x="${(x0 + j * cell + cell / 2).toFixed(1)}" y="${(y0 - 10).toFixed(1)}" fill="${PLOT.muted}" font-size="11" text-anchor="middle" font-family="${PLOT_MONO}">${escapeHtml(c)}</text>`;
  });
  rows.forEach((r, i) => {
    svg += `<text x="${(x0 - 10).toFixed(1)}" y="${(y0 + i * cell + cell / 2 + 4).toFixed(1)}" fill="${PLOT.muted}" font-size="11" text-anchor="end" font-family="${PLOT_MONO}">${escapeHtml(r)}</text>`;
    for (let j = 0; j < cols.length; j++) {
      const val = matrix[i]?.[j] ?? 0;
      const t = (val - vmin) / (vmax - vmin);
      svg += `<rect x="${(x0 + j * cell + 2).toFixed(1)}" y="${(y0 + i * cell + 2).toFixed(1)}" width="${cell - 4}" height="${cell - 4}" rx="4" fill="${heatColor(t)}" stroke="#0b0f12" stroke-width="0.5"/>`;
      svg += `<text x="${(x0 + j * cell + cell / 2).toFixed(1)}" y="${(y0 + i * cell + cell / 2 + 4).toFixed(1)}" fill="${PLOT.ink}" font-size="12" text-anchor="middle" font-family="${PLOT_MONO}">${fmtTick(val)}</text>`;
    }
  });

  return `<svg class="plot-svg" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(spec.title || 'heatmap')}">${svg}</svg>`;
}

export type BoardTab = 'memory' | 'plot' | 'ram';

export class BoardView {
  private root: HTMLElement;
  private canvas!: SVGSVGElement;
  private ramCanvas!: SVGSVGElement;
  private plotBody!: HTMLElement;
  private memoryTabBtn!: HTMLButtonElement;
  private plotTabBtn!: HTMLButtonElement;
  private ramTabBtn!: HTMLButtonElement;
  private stepperBar!: HTMLElement;
  private stepCounter!: HTMLElement;
  private btnFirst!: HTMLButtonElement;
  private btnPrev!: HTMLButtonElement;
  private btnPlay!: HTMLButtonElement;
  private btnLast!: HTMLButtonElement;
  private currentTab: BoardTab = 'memory';
  private plots: PlotSpec[] = [];
  private onTabChange?: (tab: BoardTab) => void;
  /** Called with the frame index (0..trace.length-1) when the user scrubs. */
  private onStep?: (index: number) => void;
  /** Recorded execution frames; empty = stepper hidden. */
  private trace: MemoryState[] = [];
  private stepIndex = 0;

  constructor(
    root: HTMLElement,
    onTabChange?: (tab: BoardTab) => void,
    onStep?: (index: number) => void,
  ) {
    this.root = root;
    this.onTabChange = onTabChange;
    this.onStep = onStep;
    this.render();
  }

  /** The live memory canvas (App drives it via renderMemory). */
  get canvasEl(): SVGSVGElement {
    return this.canvas;
  }

  /** The live RAM canvas (App drives it via renderRam). */
  get ramCanvasEl(): SVGSVGElement {
    return this.ramCanvas;
  }

  setTab(tab: BoardTab): void {
    if (tab === this.currentTab) return;
    this.currentTab = tab;
    this.render();
    this.onTabChange?.(tab);
  }

  getTab(): BoardTab {
    return this.currentTab;
  }

  /**
   * Update the plot collection. When a new plot appears the board auto-switches
   * to the Plot tab (learn-r parity).
   */
  setPlots(plots: PlotSpec[]): void {
    const hadPlot = this.plots.length > 0;
    this.plots = plots;
    const switching = plots.length > 0 && !hadPlot && this.currentTab !== 'plot';
    if (switching) {
      this.currentTab = 'plot';
    }
    this.render();
    if (switching) this.onTabChange?.(this.currentTab);
  }

  /**
   * Provide the recorded execution frames for the "watch it run" stepper.
   * An empty trace hides the bar; a non-empty one shows the transport controls
   * and jumps to the final frame. App renders each frame on scrub.
   */
  setTrace(frames: MemoryState[]): void {
    const changed = frames.length !== this.trace.length || frames !== this.trace;
    this.trace = frames;
    this.stepIndex = Math.max(frames.length - 1, 0);
    if (changed) this.render();
    this.updateStepper();
  }

  private stepNext(): void {
    if (this.stepIndex < this.trace.length - 1) {
      this.stepIndex++;
      this.updateStepper();
      this.onStep?.(this.stepIndex);
    }
  }

  private stepPrev(): void {
    if (this.stepIndex > 0) {
      this.stepIndex--;
      this.updateStepper();
      this.onStep?.(this.stepIndex);
    }
  }

  private stepFirst(): void {
    if (this.stepIndex !== 0) {
      this.stepIndex = 0;
      this.updateStepper();
      this.onStep?.(0);
    }
  }

  private stepLast(): void {
    const last = this.trace.length - 1;
    if (this.stepIndex !== last) {
      this.stepIndex = last;
      this.updateStepper();
      this.onStep?.(last);
    }
  }

  private updateStepper(): void {
    if (!this.stepperBar) return;
    this.stepperBar.hidden = this.trace.length < 2;
    if (this.trace.length < 2) return;
    this.stepCounter.textContent = `${this.stepIndex + 1} / ${this.trace.length}`;
    this.btnFirst.disabled = this.stepIndex === 0;
    this.btnPrev.disabled = this.stepIndex === 0;
    this.btnPlay.disabled = this.stepIndex >= this.trace.length - 1;
    this.btnLast.disabled = this.stepIndex >= this.trace.length - 1;
  }

  private render(): void {
    const hasPlot = this.plots.length > 0;
    this.root.innerHTML = `
      <div class="board-header">
        <div class="board-tabs" role="tablist">
          <button type="button" class="board-tab${this.currentTab === 'memory' ? ' is-active' : ''}" data-tab="memory" role="tab" aria-selected="${this.currentTab === 'memory'}">
            <span>Memory</span>
            <span class="tab-badge">stack · heap</span>
          </button>
          <button type="button" class="board-tab${this.currentTab === 'plot' ? ' is-active' : ''}" data-tab="plot" role="tab" aria-selected="${this.currentTab === 'plot'}">
            <span>Plot</span>
            ${hasPlot ? '<span class="tab-badge ok">●</span>' : ''}
          </button>
          <button type="button" class="board-tab${this.currentTab === 'ram' ? ' is-active' : ''}" data-tab="ram" role="tab" aria-selected="${this.currentTab === 'ram'}">
            <span>RAM</span>
            <span class="tab-badge">addr · ref</span>
          </button>
        </div>
      </div>
      <div class="board-body">
        <div class="board-pane${this.currentTab === 'memory' ? ' is-active' : ''}" data-pane="memory">
          <div class="canvas-wrap"><svg id="canvas" xmlns="http://www.w3.org/2000/svg"></svg></div>
        </div>
        <div class="board-pane${this.currentTab === 'plot' ? ' is-active' : ''}" data-pane="plot">
          <div class="plot-stage" id="plot-stage"></div>
        </div>
        <div class="board-pane${this.currentTab === 'ram' ? ' is-active' : ''}" data-pane="ram">
          <div class="canvas-wrap"><svg id="ram-canvas" xmlns="http://www.w3.org/2000/svg"></svg></div>
        </div>
      </div>
      <div class="step-bar" id="step-bar" hidden>
        <span class="step-label">step</span>
        <button type="button" class="step-btn" data-step="first" aria-label="First step" title="First step">⏮</button>
        <button type="button" class="step-btn" data-step="prev" aria-label="Previous step" title="Previous step">◀</button>
        <button type="button" class="step-btn play" data-step="play" aria-label="Play one step" title="Play one step">▶</button>
        <button type="button" class="step-btn" data-step="last" aria-label="Last step" title="Last step">⏭</button>
        <span class="step-count" id="step-count">1 / 1</span>
      </div>
    `;

    this.canvas = this.root.querySelector('#canvas')!;
    this.ramCanvas = this.root.querySelector('#ram-canvas')!;
    this.plotBody = this.root.querySelector('#plot-stage')!;
    this.memoryTabBtn = this.root.querySelector('[data-tab="memory"]') as HTMLButtonElement;
    this.plotTabBtn = this.root.querySelector('[data-tab="plot"]') as HTMLButtonElement;
    this.ramTabBtn = this.root.querySelector('[data-tab="ram"]') as HTMLButtonElement;
    this.stepperBar = this.root.querySelector('#step-bar')!;
    this.stepCounter = this.root.querySelector('#step-count')!;
    this.btnFirst = this.root.querySelector('[data-step="first"]') as HTMLButtonElement;
    this.btnPrev = this.root.querySelector('[data-step="prev"]') as HTMLButtonElement;
    this.btnPlay = this.root.querySelector('[data-step="play"]') as HTMLButtonElement;
    this.btnLast = this.root.querySelector('[data-step="last"]') as HTMLButtonElement;

    this.memoryTabBtn.addEventListener('click', () => this.setTab('memory'));
    this.plotTabBtn.addEventListener('click', () => this.setTab('plot'));
    this.ramTabBtn.addEventListener('click', () => this.setTab('ram'));
    this.btnFirst.addEventListener('click', () => this.stepFirst());
    this.btnPrev.addEventListener('click', () => this.stepPrev());
    this.btnPlay.addEventListener('click', () => this.stepNext());
    this.btnLast.addEventListener('click', () => this.stepLast());

    this.updateStepper();
    this.renderPlot();
  }

  private renderPlot(): void {
    if (!this.plotBody) return;
    if (!this.plots.length) {
      this.plotBody.innerHTML =
        '<div class="board-empty"><p>No plot yet. Call <code>scatter(x, y)</code> or <code>line(x, y)</code> to draw one.</p></div>';
      return;
    }
    // Draw every plot as a real SVG chart (scatter = dots, line = connected
    // trend). Each keeps its title so the student can see what they plotted.
    const items = this.plots
      .map((p) => `<figure class="plot-card">${plotSvg(p)}</figure>`)
      .join('');
    this.plotBody.innerHTML = `<div class="plot-cards">${items}</div>`;
  }
}
