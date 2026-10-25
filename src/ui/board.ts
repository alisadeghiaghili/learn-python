/**
 * Tabbed board: the signature Memory canvas (stack frames → heap objects →
 * amber reference edges), RAM board, and a Plot tab for plotting levels.
 *
 * Includes stepper scrubber slider, autoplay transport controls, scalar heap
 * toggle, and screen-reader accessible live text alternatives.
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

  const summary = `${spec.title ? spec.title + ': ' : ''}${spec.kind} plot with ${pts.length} points, x from ${fmtTick(xmin)} to ${fmtTick(xmax)}, y from ${fmtTick(ymin)} to ${fmtTick(ymax)}`;
  return `<svg class="plot-svg" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(summary)}"><title>${escapeHtml(summary)}</title><desc>${escapeHtml(summary)}</desc>${title}${grid}${axes}${ticks}${series}</svg>`;
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
  private stepSlider!: HTMLInputElement;
  private btnFirst!: HTMLButtonElement;
  private btnPrev!: HTMLButtonElement;
  private btnPlay!: HTMLButtonElement;
  private btnNext!: HTMLButtonElement;
  private btnLast!: HTMLButtonElement;
  private scalarToggleBtn!: HTMLButtonElement;
  private liveRegion!: HTMLElement;
  private textAlt!: HTMLElement;

  private currentTab: BoardTab = 'memory';
  private plots: PlotSpec[] = [];
  private onTabChange?: (tab: BoardTab) => void;
  /** Called with the frame index (0..trace.length-1) when the user scrubs. */
  private onStep?: (index: number) => void;
  private onToggleScalarsCb?: (show: boolean) => void;

  /** Recorded execution frames; empty = stepper hidden. */
  private trace: MemoryState[] = [];
  private stepIndex = 0;

  // Autoplay state
  private isPlaying = false;
  private playTimer: number | null = null;
  private playSpeed = 1; // 0.5, 1, 2
  private showScalarsOnHeap = false;

  constructor(
    root: HTMLElement,
    onTabChange?: (tab: BoardTab) => void,
    onStep?: (index: number) => void,
    onToggleScalars?: (show: boolean) => void,
  ) {
    this.root = root;
    this.onTabChange = onTabChange;
    this.onStep = onStep;
    this.onToggleScalarsCb = onToggleScalars;
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

  getScalarsOnHeap(): boolean {
    return this.showScalarsOnHeap;
  }

  setScalarsOnHeap(show: boolean): void {
    this.showScalarsOnHeap = show;
    this.updateScalarButton();
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
    const prevCount = this.plots.length;
    this.plots = [...plots];
    const switching = plots.length > 0 && prevCount === 0 && this.currentTab !== 'plot';
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
    this.pause();
    const changed = frames.length !== this.trace.length || frames !== this.trace;
    this.trace = frames;
    this.stepIndex = Math.max(frames.length - 1, 0);
    if (changed) this.render();
    this.updateStepper();
  }

  private stepNext(autoplay = false): void {
    if (this.stepIndex < this.trace.length - 1) {
      this.stepIndex++;
      this.updateStepper();
      this.onStep?.(this.stepIndex);
    } else if (autoplay) {
      this.pause();
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

  private goToStep(index: number): void {
    const clamped = Math.max(0, Math.min(this.trace.length - 1, index));
    if (clamped !== this.stepIndex) {
      this.stepIndex = clamped;
      this.updateStepper();
      this.onStep?.(this.stepIndex);
    }
  }

  private togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      if (this.stepIndex >= this.trace.length - 1) {
        this.stepIndex = 0;
        this.updateStepper();
        this.onStep?.(0);
      }
      this.play();
    }
  }

  private play(): void {
    this.isPlaying = true;
    if (this.btnPlay) {
      this.btnPlay.textContent = '⏸';
      this.btnPlay.title = 'Pause playback';
      this.btnPlay.setAttribute('aria-label', 'Pause playback');
    }
    const interval = Math.round(800 / this.playSpeed);
    if (this.playTimer) clearInterval(this.playTimer);
    this.playTimer = window.setInterval(() => {
      this.stepNext(true);
    }, interval);
  }

  private pause(): void {
    this.isPlaying = false;
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
    if (this.btnPlay) {
      this.btnPlay.textContent = '▶';
      this.btnPlay.title = 'Play trace';
      this.btnPlay.setAttribute('aria-label', 'Play trace');
    }
  }

  private setSpeed(speed: number): void {
    this.playSpeed = speed;
    this.root.querySelectorAll<HTMLButtonElement>('.step-speed-btn').forEach((btn) => {
      const s = parseFloat(btn.dataset.speed ?? '1');
      btn.classList.toggle('is-active', s === speed);
    });
    if (this.isPlaying) {
      this.play(); // restart timer with new interval
    }
  }

  private toggleScalars(): void {
    this.showScalarsOnHeap = !this.showScalarsOnHeap;
    this.updateScalarButton();
    this.onToggleScalarsCb?.(this.showScalarsOnHeap);
  }

  private updateScalarButton(): void {
    if (!this.scalarToggleBtn) return;
    this.scalarToggleBtn.setAttribute('aria-pressed', String(this.showScalarsOnHeap));
    this.scalarToggleBtn.textContent = this.showScalarsOnHeap
      ? 'Showing all on heap'
      : 'Inline scalars';
    this.scalarToggleBtn.title = this.showScalarsOnHeap
      ? 'Scalars are drawn as heap boxes with reference arrows (click to draw inline)'
      : 'Scalars are drawn inline inside stack frames (click to show on heap)';
  }

  private updateStepper(): void {
    if (!this.stepperBar) return;
    this.stepperBar.hidden = this.trace.length < 2;
    if (this.trace.length < 2) return;
    this.stepCounter.textContent = `${this.stepIndex + 1} / ${this.trace.length}`;
    this.stepSlider.max = String(this.trace.length - 1);
    this.stepSlider.value = String(this.stepIndex);
    this.btnFirst.disabled = this.stepIndex === 0;
    this.btnPrev.disabled = this.stepIndex === 0;
    this.btnNext.disabled = this.stepIndex >= this.trace.length - 1;
    this.btnLast.disabled = this.stepIndex >= this.trace.length - 1;

    // Accessibility announcement for screen readers
    this.updateAccessibility();
  }

  /** Update accessible text alternatives and aria-live region. */
  updateAccessibility(state?: MemoryState): void {
    this.describeMemory(state);
  }

  /** Produce and announce a structured text summary of the current memory state. */
  describeMemory(state?: MemoryState): string {
    const currentState = state ?? (this.trace.length > 0 ? this.trace[this.stepIndex] : undefined);
    if (!currentState) {
      const msg = 'Memory is empty.';
      if (this.liveRegion) this.liveRegion.textContent = msg;
      if (this.textAlt) this.textAlt.textContent = msg;
      return msg;
    }

    const frameLines = currentState.frames.map((f) => {
      const vars = Object.entries(f.locals).map(([k, v]) => {
        if (typeof v === 'string' && currentState.heap[v]) {
          const obj = currentState.heap[v];
          const aliases = Object.entries(f.locals)
            .filter(([otherK, otherV]) => otherK !== k && otherV === v)
            .map(([otherK]) => otherK);
          const aliasNote = aliases.length > 0 ? ` (same object as ${aliases.join(', ')})` : '';
          return `${k} → ${obj.type} ${obj.id} [${obj.repr}]${aliasNote}`;
        }
        return `${k} → ${v === null ? 'None' : String(v)}`;
      }).join('; ');
      return `Frame ${f.name}: ${vars || 'empty'}`;
    });

    const heapCount = Object.keys(currentState.heap).length;
    const stepPrefix = this.trace.length > 1 ? `Step ${this.stepIndex + 1} of ${this.trace.length}. ` : '';
    const summary = `${stepPrefix}${frameLines.join('. ')}. Heap has ${heapCount} object${heapCount === 1 ? '' : 's'}.`;

    if (this.liveRegion) this.liveRegion.textContent = summary;
    if (this.textAlt) this.textAlt.textContent = summary;
    return summary;
  }

  private render(): void {
    const hasPlot = this.plots.length > 0;
    this.root.innerHTML = `
      <div class="board-header">
        <div class="board-tabs" role="tablist" aria-label="Visualizer views">
          <button type="button" class="board-tab${this.currentTab === 'memory' ? ' is-active' : ''}" data-tab="memory" id="tab-memory" role="tab" aria-selected="${this.currentTab === 'memory'}" aria-controls="pane-memory" tabindex="${this.currentTab === 'memory' ? '0' : '-1'}">
            <span>Memory</span>
            <span class="tab-badge">stack · heap</span>
          </button>
          <button type="button" class="board-tab${this.currentTab === 'plot' ? ' is-active' : ''}" data-tab="plot" id="tab-plot" role="tab" aria-selected="${this.currentTab === 'plot'}" aria-controls="pane-plot" tabindex="${this.currentTab === 'plot' ? '0' : '-1'}">
            <span>Plot</span>
            ${hasPlot ? '<span class="tab-badge ok">●</span>' : ''}
          </button>
          <button type="button" class="board-tab${this.currentTab === 'ram' ? ' is-active' : ''}" data-tab="ram" id="tab-ram" role="tab" aria-selected="${this.currentTab === 'ram'}" aria-controls="pane-ram" tabindex="${this.currentTab === 'ram' ? '0' : '-1'}">
            <span>RAM</span>
            <span class="tab-badge">addr · ref</span>
          </button>
        </div>
        <div class="board-controls">
          <button type="button" class="describe-memory-btn" id="describe-memory-btn" aria-label="Describe current memory state">
            Describe memory
          </button>
          <button type="button" class="scalar-toggle-chip" id="scalar-toggle-btn" aria-pressed="${this.showScalarsOnHeap}">
            ${this.showScalarsOnHeap ? 'Showing all on heap' : 'Inline scalars'}
          </button>
        </div>
      </div>
      <div class="board-body">
        <div class="board-pane${this.currentTab === 'memory' ? ' is-active' : ''}" data-pane="memory" id="pane-memory" role="tabpanel" aria-labelledby="tab-memory" tabindex="0">
          <div class="canvas-wrap">
            <svg id="canvas" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Python memory visualization canvas"></svg>
            <div class="sr-only live-desc" id="board-live-region" aria-live="polite"></div>
            <div class="sr-only text-alternative" id="board-text-alt"></div>
          </div>
        </div>
        <div class="board-pane${this.currentTab === 'plot' ? ' is-active' : ''}" data-pane="plot" id="pane-plot" role="tabpanel" aria-labelledby="tab-plot" tabindex="0">
          <div class="plot-stage" id="plot-stage" tabindex="0" role="region" aria-label="Data plot view"></div>
        </div>
        <div class="board-pane${this.currentTab === 'ram' ? ' is-active' : ''}" data-pane="ram" id="pane-ram" role="tabpanel" aria-labelledby="tab-ram" tabindex="0">
          <div class="canvas-wrap"><svg id="ram-canvas" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Python RAM byte layout view"></svg></div>
        </div>
      </div>
      <div class="step-bar" id="step-bar" hidden>
        <span class="step-label">step</span>
        <button type="button" class="step-btn" data-step="first" aria-label="First step" title="First step (Home)">⏮</button>
        <button type="button" class="step-btn" data-step="prev" aria-label="Previous step" title="Previous step (Left Arrow)">◀</button>
        <button type="button" class="step-btn play" data-step="play" aria-label="Play trace" title="Play trace (Space)">▶</button>
        <button type="button" class="step-btn" data-step="next" aria-label="Next step" title="Next step (Right Arrow)">▶|</button>
        <button type="button" class="step-btn" data-step="last" aria-label="Last step" title="Last step (End)">⏭</button>
        <input type="range" class="step-slider" id="step-slider" min="0" max="0" value="0" aria-label="Trace step scrubber" />
        <span class="step-count" id="step-count">1 / 1</span>
        <div class="step-speed-group" role="group" aria-label="Playback speed">
          <button type="button" class="step-speed-btn${this.playSpeed === 0.5 ? ' is-active' : ''}" data-speed="0.5">0.5x</button>
          <button type="button" class="step-speed-btn${this.playSpeed === 1 ? ' is-active' : ''}" data-speed="1">1x</button>
          <button type="button" class="step-speed-btn${this.playSpeed === 2 ? ' is-active' : ''}" data-speed="2">2x</button>
        </div>
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
    this.stepSlider = this.root.querySelector('#step-slider') as HTMLInputElement;
    this.btnFirst = this.root.querySelector('[data-step="first"]') as HTMLButtonElement;
    this.btnPrev = this.root.querySelector('[data-step="prev"]') as HTMLButtonElement;
    this.btnPlay = this.root.querySelector('[data-step="play"]') as HTMLButtonElement;
    this.btnNext = this.root.querySelector('[data-step="next"]') as HTMLButtonElement;
    this.btnLast = this.root.querySelector('[data-step="last"]') as HTMLButtonElement;
    this.scalarToggleBtn = this.root.querySelector('#scalar-toggle-btn') as HTMLButtonElement;
    this.liveRegion = this.root.querySelector('#board-live-region')!;
    this.textAlt = this.root.querySelector('#board-text-alt')!;

    this.memoryTabBtn.addEventListener('click', () => this.setTab('memory'));
    this.plotTabBtn.addEventListener('click', () => this.setTab('plot'));
    this.ramTabBtn.addEventListener('click', () => this.setTab('ram'));
    this.btnFirst.addEventListener('click', () => this.stepFirst());
    this.btnPrev.addEventListener('click', () => this.stepPrev());
    this.btnPlay.addEventListener('click', () => this.togglePlay());
    this.btnNext.addEventListener('click', () => this.stepNext());
    this.btnLast.addEventListener('click', () => this.stepLast());
    this.stepSlider.addEventListener('input', () => this.goToStep(this.stepSlider.valueAsNumber));
    this.scalarToggleBtn.addEventListener('click', () => this.toggleScalars());

    const describeBtn = this.root.querySelector('#describe-memory-btn') as HTMLButtonElement | null;
    describeBtn?.addEventListener('click', () => this.describeMemory());

    const tabs: BoardTab[] = ['memory', 'plot', 'ram'];
    const tabBtns = [this.memoryTabBtn, this.plotTabBtn, this.ramTabBtn];
    const tablist = this.root.querySelector('.board-tabs');
    tablist?.addEventListener('keydown', (e) => {
      const evt = e as KeyboardEvent;
      const curIdx = tabs.indexOf(this.currentTab);
      let nextIdx = -1;
      if (evt.key === 'ArrowRight' || evt.key === 'ArrowDown') {
        nextIdx = (curIdx + 1) % tabs.length;
      } else if (evt.key === 'ArrowLeft' || evt.key === 'ArrowUp') {
        nextIdx = (curIdx - 1 + tabs.length) % tabs.length;
      } else if (evt.key === 'Home') {
        nextIdx = 0;
      } else if (evt.key === 'End') {
        nextIdx = tabs.length - 1;
      }
      if (nextIdx !== -1) {
        evt.preventDefault();
        const nextTab = tabs[nextIdx]!;
        this.setTab(nextTab);
        const nextBtn = tabBtns[nextIdx];
        nextBtn?.focus();
      }
    });

    this.root.querySelectorAll<HTMLButtonElement>('.step-speed-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed ?? '1');
        this.setSpeed(speed);
      });
    });

    this.updateScalarButton();
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
