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
    // Phase C fills this with real SVG. For now render the spec as a list.
    const items = this.plots
      .map((p) => `<div class="plot-card"><strong>${escapeHtml(p.title || p.kind)}</strong> · ${p.points.length} points</div>`)
      .join('');
    this.plotBody.innerHTML = `<div class="plot-cards">${items}</div>`;
  }
}
