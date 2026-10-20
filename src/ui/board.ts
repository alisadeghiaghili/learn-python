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

/**
 * Render one plot spec as a self-contained SVG: light grid, labelled axes, and
 * the series (amber dots for `scatter`, a teal polyline for `line`). Returns the
 * full `<svg>` markup — no live DOM, so it composes safely into innerHTML.
 */
function plotSvg(spec: PlotSpec): string {
  const W = 480;
  const H = 360;
  const m = { l: 52, r: 18, t: 32, b: 42 };
  const px0 = m.l;
  const px1 = W - m.r;
  const py0 = H - m.b;
  const py1 = m.t;
  const pts = spec.points;

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

  // The series: a connected teal line (with node markers) or amber dots.
  let series = '';
  if (spec.kind === 'line' && pts.length >= 2) {
    const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ');
    series += `<path d="${d}" fill="none" stroke="${PLOT.teal}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    series += pts.map(([x, y]) => `<circle cx="${sx(x).toFixed(1)}" cy="${sy(y).toFixed(1)}" r="3.5" fill="${PLOT.teal}"/>`).join('');
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
