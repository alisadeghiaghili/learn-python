/**
 * Application shell: mounted into #app. Toolbar, tabbed board (Memory/Plot),
 * script editor drawer, terminal console, and the always-on learning dock with a
 * live per-checklist. Synchronous (the Python engine is a pure in-memory
 * simulator — no async runtime to boot).
 */

import { createSession, type Session, referenceEdges, liveObjectIds } from '../engine/session';
import { setTraceEnabled } from '../engine/evaluator';
import { checkGoal } from '../engine/checks';
import type { GoalSpec, Level, MemoryState, Sequence, Snapshot } from '../engine/types';
import { splitPythonStatements } from '../engine/steps';
import { allLevels, getLevel, levelIndex, sequenceForLevel, sequences } from '../levels/index';
import { renderMemory, renderRam } from './memory';
import { BoardView } from './board';
import { TerminalView } from './terminal';
import { ScriptEditorView } from './editor';
import { escapeHtml, renderMarkdown, showModal, type ModalSpec } from './dialog';
import { startUiTour, uiHelpModalHtml } from './ui-help';
import { formatVisitorCount, startVisitorCounter } from './visitor-counter';
import { getLocale, LOCALES, localizeLevel, localizeSequence, setLocale, ui } from '../i18n';
import type { Locale } from '../i18n';
import brandLogoUrl from '../../assets/lp5-logo.svg';

const REPO_URL = 'https://github.com/alisadeghiaghili/learn-python';
const COFFEE_URL = 'https://www.buymeacoffee.com/alisadeghil';
const PROGRESS_KEY = 'learn-python-progress-v1';

/** Five equal-size dots; filled count = difficulty 1–5. */
function renderDiffDots(difficulty: number): string {
  const n = Math.max(0, Math.min(5, difficulty));
  return Array.from({ length: 5 }, (_, i) => `<i class="diff-dot${i < n ? ' on' : ''}"></i>`).join('');
}

interface UndoEntry {
  state: MemoryState;
  statementsUsed: number;
}

interface ProgressEntry {
  solved: boolean;
  bestStatements?: number;
}
type Progress = Record<string, ProgressEntry>;

export interface DockCheck {
  label: string;
  passed: boolean;
}

/** Rough statement count for golf: logical lines that are not blank / comments. */
export function countStatements(source: string): number {
  return source
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith('#');
    }).length;
}

/**
 * Evaluate a level's goal into one labeled row per check, for the dock
 * checklist. The overall `ok` is the logical AND of the rows.
 */
export function checkLevelGoal(
  goal: GoalSpec,
  snap: Snapshot,
  rt: MemoryState,
): { ok: boolean; results: DockCheck[] } {
  const overall = checkGoal(goal, snap, rt);

  if (goal.type === 'predicates') {
    const results = goal.predicates.map((p) => {
      const r = p(snap, rt);
      return {
        label: typeof r === 'string' ? r : 'Requirement met',
        passed: r === true,
      };
    });
    return { ok: overall.ok, results };
  }

  if (goal.type === 'stdout') {
    const results = goal.lines.map((ln) => ({
      label: `stdout contains: ${ln}`,
      passed: rt.stdout.includes(ln),
    }));
    return { ok: overall.ok, results };
  }

  if (goal.type === 'vars') {
    // A `vars` goal is satisfied only when every binding matches, so all rows
    // share the overall verdict.
    const results = Object.entries(goal.vars).map(([name, spec]) => ({
      label: `${name} → ${spec.type ?? 'value'}${spec.repr ? ` = ${spec.repr}` : ''}`,
      passed: overall.ok,
    }));
    return { ok: overall.ok, results };
  }

  if (goal.type === 'plot') {
    return {
      ok: overall.ok,
      results: [{ label: `draw a ${goal.kind ?? 'plot'}`, passed: overall.ok }],
    };
  }

  return { ok: overall.ok, results: [{ label: overall.message, passed: overall.ok }] };
}

export class App {
  private root: HTMLElement;
  private session: Session;
  private level: Level | null = null;
  private board!: BoardView;
  private terminal!: TerminalView;
  private editor!: ScriptEditorView;
  private dockEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private undoStack: UndoEntry[] = [];
  private statementsUsed = 0;
  private levelCompleted = false;
  /** Index into the current run's trace while the learner scrubs; null = live state. */
  private stepIndex: number | null = null;
  private showHint = false;
  private progress: Progress = loadProgress();
  private checkResults: DockCheck[] = [];
  /** Reopens the UI guide after a highlight tour finishes (see openUiHelp). */
  private helpReopenTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.session = createSession();
    setTraceEnabled(true); // record each run so loops can be watched step by step
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.nav-drawer') && !target.closest('[data-action="nav-toggle"]')) {
        this.closeNav();
      }
      if (!target.closest('.lang-menu')) {
        this.closeLang();
      }
    });
    this.mount();
    this.init();
    void startVisitorCounter((count) => this.renderVisitors(count));
  }

  /** Unique-visitor stat in the toolbar; stays hidden until a number is known. */
  private renderVisitors(count: number): void {
    const stat = this.root.querySelector<HTMLElement>('#visitor-stat');
    const value = this.root.querySelector<HTMLElement>('#visitor-count');
    if (!stat || !value) return;
    const text = formatVisitorCount(count);
    value.textContent = text;
    stat.setAttribute('aria-label', `${text} unique visitors`);
    stat.hidden = false;
  }

  /* —— Mounting & init —— */

  private init(): void {
    const params = new URLSearchParams(window.location.search);
    const savedLevel = safeGet(PROGRESS_KEY + '_last');
    const isSandboxParam = params.get('mode') === 'sandbox' || params.has('sandbox');
    const requested = params.get('level') || (!isSandboxParam && savedLevel && getLevel(savedLevel) ? savedLevel : null);

    if (requested && getLevel(requested)) {
      this.enterLevel(requested);
    } else if (!isSandboxParam && getLevel(allLevels()[0]!.id)) {
      this.enterLevel(allLevels()[0]!.id);
    } else {
      this.enterSandbox();
    }
  }

  private mount(): void {
    const current = getLocale();
    const langItems = LOCALES.map(
      (loc) =>
        `<button type="button" class="lang-option${current === loc ? ' on' : ''}" data-lang="${loc}" role="menuitem" aria-checked="${current === loc}">${loc.toUpperCase()}</button>`,
    ).join('');
    this.root.innerHTML = `
      <div class="app-main">
        <header class="toolbar">
          <a class="brand" href="./" aria-label="learnpython home">
            <img class="brand-logo" src="${brandLogoUrl}" width="22" height="22" alt="" />
            <span class="brand-text">learn<span class="brand-accent">python</span></span>
          </a>
          <div class="level-title" id="level-title"></div>
          <div class="toolbar-actions">
            <div class="lang-menu">
              <button type="button" class="lang-btn" data-action="lang-toggle" aria-haspopup="menu" aria-expanded="false" aria-label="${escapeHtml(ui().language)}">
                <span data-lang-label>${current.toUpperCase()}</span>
                <span class="lang-caret" aria-hidden="true"></span>
              </button>
              <div class="lang-dropdown" id="lang-dropdown" role="menu" hidden>
                ${langItems}
              </div>
            </div>
            <button type="button" class="nav-toggle" data-action="nav-toggle" aria-label="${escapeHtml(ui().menuLabel)}" aria-expanded="false" aria-controls="nav-drawer">
              <span class="nav-bars" aria-hidden="true"></span>
            </button>
            <div class="nav-drawer" id="nav-drawer" hidden>
              <button type="button" data-action="levels">${escapeHtml(ui().levels)}</button>
              <button type="button" data-action="lesson" title="${escapeHtml(ui().lessonTitle)}">${escapeHtml(ui().lesson)}</button>
              <button type="button" data-action="goal">${escapeHtml(ui().guide)}</button>
              <button type="button" data-action="hint">${escapeHtml(ui().hint)}</button>
              <button type="button" data-action="solution">${escapeHtml(ui().solution)}</button>
              <button type="button" data-action="undo">${escapeHtml(ui().undo)}</button>
              <button type="button" data-action="reset">${escapeHtml(ui().reset)}</button>
              <button type="button" data-action="sandbox" class="ghost">${escapeHtml(ui().sandboxBtn)}</button>
              <button type="button" class="help-btn" data-action="help" title="${escapeHtml(ui().help)}" aria-label="${escapeHtml(ui().help)}">?</button>
            </div>
            <span class="tb-stat visitors" id="visitor-stat" role="img" title="${escapeHtml(ui().visitorsTitle)}" aria-label="${escapeHtml(ui().visitorsTitle)}" hidden>
              <svg class="visitor-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0-2.21-2.69-4-6-4s-6 1.79-6 4v1h12v-1zm-1.07 0H3.07C3.56 11.83 5.48 11 8 11s4.44.83 4.93 2z"/></svg>
              <span class="visitor-count" id="visitor-count"></span>
            </span>
            <a class="tb-link gh" href="${REPO_URL}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(ui().githubTitle)}" aria-label="GitHub repository">
              <svg class="gh-mark" viewBox="0 0 16 16" width="18" height="18"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            </a>
            <a class="tb-link support" href="${COFFEE_URL}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(ui().supportTitle)}" aria-label="${escapeHtml(ui().supportTitle)}">${escapeHtml(ui().support)}</a>
          </div>
        </header>
        <div class="board-wrap" id="board-wrap"></div>
        <div class="editor-drawer" id="editor-drawer"></div>
        <div class="terminal" id="terminal"></div>
      </div>
      <aside class="dock" id="dock" aria-label="Learning guide"></aside>
    `;

    this.titleEl = this.root.querySelector('#level-title')!;
    this.dockEl = this.root.querySelector('#dock')!;
    this.board = new BoardView(
      this.root.querySelector('#board-wrap')!,
      (tab) => {
        // After a tab switch its canvas is rebuilt; redraw whichever tab we
        // just landed on.
        if (tab === 'memory') this.renderBoard();
        if (tab === 'ram') this.renderRamBoard();
      },
      (index) => this.renderStep(index),
      () => this.renderBoard(),
    );
    this.editor = new ScriptEditorView(
      this.root.querySelector('#editor-drawer')!,
      (code) => this.executeCode(code),
    );
    this.terminal = new TerminalView(
      this.root.querySelector('#terminal')!,
      (cmd) => this.handleCommand(cmd),
      () => this.editor.toggle(),
    );

    this.wireToolbar();
    this.updateTitle();
    this.renderDock();
  }

  private wireToolbar(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'nav-toggle') {
          this.toggleNav();
          return;
        }
        if (action === 'lang-toggle') {
          this.toggleLang();
          return;
        }
        this.closeNav();
        if (action === 'levels') this.openLevels();
        if (action === 'lesson') this.openLesson();
        if (action === 'goal') this.focusGuide();
        if (action === 'hint') this.triggerHint();
        if (action === 'solution') this.showSolution();
        if (action === 'undo') this.undo();
        if (action === 'reset') this.reset();
        if (action === 'sandbox') this.enterSandbox();
        if (action === 'local-setup') this.openLocalGuide();
        if (action === 'help') this.openUiHelp(true);
        this.terminal.focus();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const loc = btn.dataset.lang as Locale | undefined;
        if (!loc || loc === getLocale()) {
          this.closeLang();
          return;
        }
        setLocale(loc);
        this.remountAfterLocale();
      });
    });

    this.dockEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('.g-step-cmd');
      if (target?.dataset.cmd) {
        this.terminal.setInput(target.dataset.cmd);
      }
    });
  }

  private toggleNav(): void {
    const drawer = this.root.querySelector<HTMLElement>('#nav-drawer');
    const btn = this.root.querySelector<HTMLButtonElement>('[data-action="nav-toggle"]');
    if (!drawer || !btn) return;
    const open = drawer.classList.toggle('is-open');
    drawer.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  private closeNav(): void {
    const drawer = this.root.querySelector<HTMLElement>('#nav-drawer');
    const btn = this.root.querySelector<HTMLButtonElement>('[data-action="nav-toggle"]');
    if (!drawer || !btn) return;
    drawer.classList.remove('is-open');
    drawer.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  private toggleLang(): void {
    const menu = this.root.querySelector<HTMLElement>('#lang-dropdown');
    const btn = this.root.querySelector<HTMLButtonElement>('[data-action="lang-toggle"]');
    if (!menu || !btn) return;
    const open = menu.classList.toggle('is-open');
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) this.closeNav();
  }

  private closeLang(): void {
    const menu = this.root.querySelector<HTMLElement>('#lang-dropdown');
    const btn = this.root.querySelector<HTMLButtonElement>('[data-action="lang-toggle"]');
    menu?.classList.remove('is-open');
    if (menu) menu.hidden = true;
    btn?.setAttribute('aria-expanded', 'false');
  }

  /** Rebuild the shell so every chrome string re-renders in the active locale. */
  private remountAfterLocale(): void {
    if (this.level) {
      const raw = getLevel(this.level.id);
      if (raw) this.level = localizeLevel(raw);
    }
    this.mount();
    this.updateTitle();
    this.renderBoards();
    this.renderDock();
    this.terminal.focus();
  }

  /* —— Level / sandbox flow —— */

  enterLevel(id: string, opts?: { openLesson?: boolean }): void {
    const raw = getLevel(id);
    if (!raw) return;
    const level = localizeLevel(raw);
    this.level = level;
    this.showHint = false;
    this.statementsUsed = 0;
    this.levelCompleted = false;
    this.undoStack = [];
    this.terminal.clear();
    this.terminal.push('meta', ui().levelMeta(level.name));

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('level', id);
      url.searchParams.delete('mode');
      url.searchParams.delete('sandbox');
      window.history.replaceState({}, '', url.toString());
      safeSet(PROGRESS_KEY + '_last', id);
    } catch {
      // ignore
    }

    this.session.reset();
    if (level.start.trim()) {
      try {
        this.session.run(level.start);
      } catch (err) {
        this.terminal.push('err', err instanceof Error ? err.message : String(err));
      }
    }

    const solution = level.solution ?? level.brief;
    const setupLines = splitPythonStatements(level.start);
    const goalLines = splitPythonStatements(solution);
    this.terminal.setExtraCompletions([...goalLines, ...setupLines]);
    this.terminal.setHint(goalLines[0] ?? null);

    this.board.setPlots(this.session.state.plots);
    this.renderBoards();
    this.refreshDock();
    this.updateTitle();

    if (opts?.openLesson) this.openLesson();
  }

  enterSandbox(): void {
    this.level = null;
    this.showHint = false;
    this.statementsUsed = 0;
    this.levelCompleted = false;
    this.undoStack = [];
    this.terminal.clear();
    this.terminal.push('meta', ui().sandboxWelcome);
    this.terminal.setExtraCompletions([]);
    this.terminal.setHint(null);

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('level');
      url.searchParams.set('mode', 'sandbox');
      window.history.replaceState({}, '', url.toString());
      safeSet(PROGRESS_KEY + '_last', '');
    } catch {
      // ignore
    }

    this.session.reset();
    this.board.setPlots([]);
    this.renderBoards();
    this.renderDock();
    this.updateTitle();
  }

  private updateTitle(): void {
    if (this.level) {
      const idx = levelIndex(this.level.id) + 1;
      this.titleEl.textContent = ui().titleLine(idx, this.level.name);
    } else {
      this.titleEl.textContent = ui().sandboxTitle;
    }
  }

  /* —— Board (memory canvas) rendering —— */

  /**
   * The frame the canvas should show: a specific recorded step while the
   * learner scrubs, otherwise the live (final) session state.
   */
  private currentFrame(): MemoryState {
    if (this.stepIndex !== null && this.stepIndex < (this.session.state.trace?.length ?? 0)) {
      return this.session.state.trace![this.stepIndex]!;
    }
    return this.session.state;
  }

  private renderBoard(): void {
    const state = this.currentFrame();
    const edges = referenceEdges(state);
    const live = liveObjectIds(state);
    renderMemory(this.board.canvasEl, state, edges, live, {
      showScalarsOnHeap: this.board.getScalarsOnHeap(),
      onToggleScalars: () => {
        this.board.setScalarsOnHeap(!this.board.getScalarsOnHeap());
        this.renderBoard();
      },
    });
    this.board.updateAccessibility(state);
  }

  private renderRamBoard(): void {
    const state = this.currentFrame();
    renderRam(this.board.ramCanvasEl, state, liveObjectIds(state));
    this.board.updateAccessibility(state);
  }

  /** Redraw both memory boards so the Memory and RAM tabs stay in sync. */
  private renderBoards(): void {
    this.renderBoard();
    this.renderRamBoard();
  }

  /** The learner scrubbed the stepper: paint that recorded frame on both boards. */
  private renderStep(index: number): void {
    this.stepIndex = index;
    const state = this.currentFrame();
    if (state.currentLine) {
      this.editor.highlightLine(state.currentLine);
    } else {
      this.editor.highlightLine(undefined);
    }
    this.renderBoards();
  }

  /* —— Execution & verification —— */

  private executeCode(raw: string): void {
    const source = raw.replace(/\s+$/, '');
    if (!source.trim()) return;

    if (this.isMeta(source.trim())) {
      this.runMeta(source.trim());
      return;
    }

    this.terminal.push('cmd', `>>> ${source.replace(/\n/g, '\n... ')}`);
    this.undoStack.push({
      state: this.session.clone(),
      statementsUsed: this.statementsUsed,
    });

    try {
      this.stepIndex = null; // a fresh run shows the final state, not an old step
      const before = this.session.state.stdout.length;
      this.session.run(source);
      const newOut = this.session.state.stdout.slice(before);
      for (const line of newOut) this.terminal.push('out', line);
      this.statementsUsed += countStatements(source);
    } catch (err) {
      this.terminal.push('err', err instanceof Error ? err.message : String(err));
    }

    this.board.setPlots(this.session.state.plots);
    this.board.setTrace(this.session.state.trace ?? []);
    this.renderBoards();
    if (this.level) this.checkVerification(source);
  }

  private checkVerification(_lastCode: string): void {
    if (!this.level) return;
    const snap = this.session.snapshot();
    const verdict = checkLevelGoal(this.level.goal, snap, this.session.state);
    this.renderDock(verdict.results);

    if (!verdict.ok) {
      const solutionCmds = splitPythonStatements(this.level.solution ?? this.level.brief);
      const nextIdx = verdict.results.findIndex((r) => !r.passed);
      if (nextIdx !== -1) {
        const cmd = solutionCmds[Math.min(nextIdx, solutionCmds.length - 1)] ?? this.level.brief;
        this.terminal.setHint(cmd.split('\n')[0] ?? null);
      }
      return;
    }

    this.terminal.setHint(null);
    this.onLevelClear();
  }

  private onLevelClear(): void {
    if (!this.level || this.levelCompleted) return;
    this.levelCompleted = true;
    const level = this.level;
    const used = this.statementsUsed;
    const par = level.par;
    const prev = this.progress[level.id];
    this.progress[level.id] = {
      solved: true,
      bestStatements: Math.min(prev?.bestStatements ?? used, used),
    };
    saveProgress(this.progress);

    const u = ui();
    const golf = used <= par ? u.golfOnPar : u.golfStatements(used, par);
    this.terminal.push('ok', u.okLevelComplete(golf));

    const nextRaw = allLevels()[levelIndex(level.id) + 1];
    const next = nextRaw ? localizeLevel(nextRaw) : undefined;
    const cheer = CHEERS[Math.floor(Math.random() * CHEERS.length)]!;
    const bodyHtml = `
      <div class="celebrate" aria-live="polite">
        <div class="celebrate-visual" aria-hidden="true">
          <div class="celebrate-ring"></div>
          <div class="celebrate-star">★</div>
        </div>
        <div class="celebrate-badge">${escapeHtml(u.celebrateBadge)}</div>
        <h3 class="celebrate-title">${escapeHtml(level.name)}</h3>
        <p class="celebrate-sub"><code>${escapeHtml(level.id)}</code></p>
        <p class="celebrate-cheer">${escapeHtml(cheer)}</p>
        <div class="celebrate-stats">${u.celebrateStats(used, par)}</div>
        ${
          next
            ? `<div class="celebrate-next">${renderMarkdown(u.celebrateNext(next.name))}</div>`
            : `<div class="celebrate-next">${escapeHtml(u.celebrateEnd)}</div>`
        }
      </div>
    `;

    const actions: ModalSpec['actions'] = [
      { label: u.keepGoing, className: 'ghost', onClick: () => this.terminal.focus() },
    ];
    if (next) {
      actions.push({
        label: u.nextAction(next.name),
        className: 'primary',
        onClick: () => this.enterLevel(next.id, { openLesson: true }),
      });
    } else {
      actions.push({
        label: u.browseLevels,
        className: 'primary',
        onClick: () => this.openLevels(),
      });
    }

    showModal({ title: u.celebrateTitle, bodyHtml, actions });
  }

  /* —— Dock —— */

  private refreshDock(): void {
    if (!this.level) {
      this.renderDock();
      return;
    }
    const snap = this.session.snapshot();
    const verdict = checkLevelGoal(this.level.goal, snap, this.session.state);
    this.renderDock(verdict.results);
  }

  private renderDock(checkResults?: DockCheck[]): void {
    const u = ui();
    if (!this.level) {
      const items = u.dockStartHereItems.map((it) => `<li>${renderMarkdown(it)}</li>`).join('');
      this.dockEl.innerHTML = `
        <h2>${escapeHtml(u.dockSandboxTitle)}</h2>
        <p class="objective">${escapeHtml(u.dockSandboxObjective)}</p>
        <div class="learning-box">
          <div class="next-title">${escapeHtml(u.dockStartHere)}</div>
          <ul>${items}</ul>
        </div>
        <ul class="goal-list">
          <li class="met"><div class="g-label">${escapeHtml(u.dockNoActiveLevel)}</div><div class="g-detail">${escapeHtml(u.dockNoActiveLevelDetail)}</div></li>
        </ul>
      `;
      return;
    }

    const level = this.level;
    const solutionCmds = splitPythonStatements(level.solution ?? level.brief);
    const checks = checkResults ?? this.checkResults ?? [];
    const solved = checks.length > 0 && checks.every((c) => c.passed);
    const currentId = checks.findIndex((c) => !c.passed);

    const items = checks.map((c, i) => {
      const done = c.passed;
      const isCurrent = !solved && !done && i === currentId;
      const cmd = solutionCmds[i] ?? solutionCmds[0] ?? level.brief;
      const firstCmdLine = cmd.split('\n')[0] ?? cmd;
      return `<li class="${done ? 'met' : ''}${isCurrent ? ' current' : ''}">
        <div class="g-label" dir="ltr">${done ? '✓' : isCurrent ? '▶' : '○'} <code class="g-step-cmd" data-cmd="${escapeHtml(firstCmdLine)}" title="Click to fill into terminal">${escapeHtml(firstCmdLine)}</code>${
          isCurrent ? ` <span class="chip current-chip">${escapeHtml(u.nowChip)}</span>` : ''
        }</div>
        <div class="g-detail" dir="ltr">${escapeHtml(c.label)}</div>
      </li>`;
    }).join('');

    const firstNext = currentId !== -1 ? solutionCmds[currentId]?.split('\n')[0] : solutionCmds[0]?.split('\n')[0];
    const nextBlock = solved
      ? `<div class="next-box met">${escapeHtml(u.allChecksPassed)}</div>`
      : `<div class="next-box">
          <div class="next-title">${escapeHtml(u.nextTitle)}</div>
          <div class="next-row">
            <span class="g-label">${escapeHtml(u.tryLabel)}</span>
            ${firstNext ? `<code class="g-cmd g-step-cmd" data-cmd="${escapeHtml(firstNext)}" dir="ltr" title="Click to fill into terminal">${escapeHtml(firstNext)}</code>` : ''}
          </div>
        </div>`;

    this.checkResults = checks;
    this.dockEl.innerHTML = `
      <h2>${escapeHtml(level.name)}</h2>
      <p class="objective">${renderMarkdown(level.brief)}</p>
      ${level.learning?.length ? `<div class="learning-box">
        <div class="next-title">${escapeHtml(u.youAreLearning)}</div>
        <ul>${level.learning.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
      </div>` : ''}
      ${level.fieldNotes?.length ? `<div class="field-box">
        <div class="next-title">${escapeHtml(u.fieldNotesTitle)}</div>
        <ul>${level.fieldNotes.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
      </div>` : ''}
      <div class="par-note">${this.bestNote(level)}</div>
      ${nextBlock}
      <ul class="goal-list">${items}</ul>
      ${this.showHint ? `<div class="par-note"><strong>${escapeHtml(u.hintLabel)}</strong> ${renderMarkdown(level.hint)}</div>` : ''}
    `;
  }

  private bestNote(level: Level): string {
    const u = ui();
    const best = this.progress[level.id]?.bestStatements;
    return best !== undefined ? u.bestSoFar(best, level.par) : u.idealSolution(level.par);
  }

  /* —— Meta commands —— */

  private isMeta(source: string): boolean {
    return /^(help|levels|lesson|level|goal|hint|solution|undo|reset|sandbox|script|clear|golf)\b/.test(source);
  }

  private runMeta(source: string): void {
    const u = ui();
    const [cmd, ...rest] = source.split(/\s+/);
    switch (cmd) {
      case 'help':
        this.openUiHelp(false);
        return;
      case 'levels':
        this.openLevels();
        return;
      case 'lesson':
        this.openLesson();
        return;
      case 'level': {
        const id = rest[0];
        if (!id) {
          this.terminal.push('meta', u.usageLevel);
          return;
        }
        if (getLevel(id)) this.enterLevel(id);
        else this.terminal.push('err', u.unknownLevel(id));
        return;
      }
      case 'goal':
      case 'guide':
      case 'steps':
      case 'next':
        this.focusGuide();
        this.terminal.push('meta', u.guideRight);
        return;
      case 'hint':
        this.triggerHint();
        return;
      case 'solution':
      case 'show solution':
        this.showSolution();
        return;
      case 'undo':
        this.undo();
        return;
      case 'reset':
        this.reset();
        return;
      case 'sandbox':
        this.enterSandbox();
        return;
      case 'script':
      case 'editor':
        this.editor.toggle();
        return;
      case 'clear':
        this.terminal.clear();
        return;
      case 'golf':
        if (this.level) this.terminal.push('meta', u.golf(this.statementsUsed, this.level.par));
        return;
      default:
        this.terminal.push('err', u.unknownCommand(cmd));
    }
  }

  private triggerHint(): void {
    const u = ui();
    if (!this.level) {
      this.terminal.push('meta', u.hintsLevelsOnly);
      return;
    }
    this.showHint = true;
    this.renderDock(this.checkResults);
    this.terminal.push('meta', u.metaHint(this.level.hint));
  }

  private showSolution(): void {
    if (!this.level) return;
    this.terminal.push('meta', ui().metaSolution(this.level.solution ?? ''));
  }

  private focusGuide(): void {
    this.dockEl.classList.remove('dock-pulse');
    void this.dockEl.offsetWidth;
    this.dockEl.classList.add('dock-pulse');
    this.dockEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private undo(): void {
    const u = ui();
    const prev = this.undoStack.pop();
    if (!prev) {
      this.terminal.push('meta', u.nothingToUndo);
      return;
    }
    const state = this.session.state;
    state.frames = prev.state.frames;
    state.heap = prev.state.heap;
    state.stdout = prev.state.stdout;
    state.errors = prev.state.errors;
    state.plots = prev.state.plots;
    this.statementsUsed = prev.statementsUsed;
    this.levelCompleted = false;
    this.terminal.push('meta', u.undid);
    this.renderBoards();
    this.board.setPlots(state.plots);
    this.refreshDock();
  }

  private reset(): void {
    if (this.level) this.enterLevel(this.level.id);
    else this.enterSandbox();
    this.terminal.push('meta', ui().envReset);
  }

  /* —— Modals —— */

  handleCommand(cmd: string): void {
    // All terminal input is routed through runMeta or executeCode.
    this.executeCode(cmd);
  }

  private openLevels(): void {
    const u = ui();
    const firstId = allLevels()[0]?.id;
    const body = sequences
      .map((raw) => {
        const s = localizeSequence(raw);
        const rows = s.levels
          .map((l) => {
            const p = this.progress[l.id];
            const solved = Boolean(p?.solved);
            const active = this.level?.id === l.id;
            const isStart = l.id === firstId;
            return `<button type="button" class="level-row ${solved ? 'solved' : ''}${active ? ' active' : ''}${isStart ? ' start-here' : ''}" data-level="${l.id}">
              <span class="id">${isStart ? '▶ ' : ''}${escapeHtml(l.id)}</span>
              <span class="name">${escapeHtml(l.name)}</span>
              <span class="chip ${solved ? 'ok' : ''}" title="${escapeHtml(u.legendDifficulty)} ${l.difficulty}/5" aria-label="${escapeHtml(u.legendDifficulty)} ${l.difficulty} / 5">
                ${solved ? `✓ ${p?.bestStatements ?? l.par}` : `<span class="diff-dots" aria-hidden="true">${renderDiffDots(l.difficulty)}</span>`}
              </span>
              <span class="par-note">ideal ${l.par} command${l.par === 1 ? '' : 's'}</span>
            </button>`;
          })
          .join('');
        const deepBtn = s.deepLesson
          ? `<button type="button" class="series-deep" data-deep="${escapeHtml(s.id)}" title="${escapeHtml(u.deepLessonTitle(s.title))}">▤ ${escapeHtml(u.deepLessonBtn)}</button>`
          : '';
        return `<div class="series-block"><h3>${escapeHtml(s.title)}</h3><div class="level-list">${rows}</div>${deepBtn}</div>`;
      })
      .join('');

    const modal = showModal({
      title: u.levelsTitle,
      bodyHtml: `<p>${u.levelsIntro}</p>
        <div class="legend-box">
          <div class="next-title">${escapeHtml(u.howToRead)}</div>
          <ul class="legend-list">
            <li><span class="diff-dots" aria-hidden="true">${renderDiffDots(3)}</span> ${escapeHtml(u.legendDifficulty)}</li>
            <li><span class="par-note">ideal 3 commands</span> ${escapeHtml(u.legendPar)}</li>
            <li><span class="chip ok">✓ N</span> ${escapeHtml(u.legendSolved)}</li>
            <li><span class="start-mark">▶</span> ${escapeHtml(u.legendStart)}</li>
          </ul>
        </div>
        ${body}`,
      actions: [{ label: u.close, className: 'ghost', onClick: () => undefined }],
    });

    // showModal focuses the footer button, which the browser scrolls into view —
    // the tall catalog would land at its bottom. Reset to the top so the first
    // exercise is what's visible.
    const panel = modal.el.querySelector<HTMLElement>('.modal');
    panel?.scrollTo({ top: 0 });
    requestAnimationFrame(() => panel?.scrollTo({ top: 0 }));

    modal.el.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.level;
        modal.close();
        if (id) this.enterLevel(id, { openLesson: true });
      });
    });
    modal.el.querySelectorAll<HTMLButtonElement>('[data-deep]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const seq = sequences.find((s) => s.id === btn.dataset.deep);
        modal.close();
        if (seq) this.openDeepLesson(seq);
      });
    });
  }

  private openLesson(): void {
    const u = ui();
    if (!this.level) {
      this.openWelcome();
      return;
    }
    const level = this.level;
    const seq = sequenceForLevel(level.id);
    const parts: string[] = [];
    parts.push(`### ${level.name}`);
    parts.push(level.brief);
    if (level.lesson) {
      parts.push('');
      parts.push(level.lesson);
    }
    if (level.learning?.length) {
      parts.push('', `### ${u.whatThisTeaches}`);
      for (const b of level.learning) parts.push(`- ${b}`);
    }
    if (level.fieldNotes?.length) {
      parts.push('', `### ${u.inProduction}`);
      for (const n of level.fieldNotes) parts.push(`- ${n}`);
    }
    if (level.hint) {
      parts.push('', `**${u.hintColon}** ${level.hint}`);
    }
    const actions: ModalSpec['actions'] = [];
    if (seq?.deepLesson) {
      actions.push({ label: u.deepLessonAction, className: 'ghost', onClick: () => this.openDeepLesson(seq) });
    }
    actions.push({ label: u.closePrimary, className: 'primary', onClick: () => this.terminal.focus() });
    showModal({
      title: level.name,
      bodyHtml: renderMarkdown(parts.join('\n')),
      actions,
      onDismiss: () => this.terminal.focus(),
    });
  }

  private openDeepLesson(seq: Sequence): void {
    const u = ui();
    const loc = localizeSequence(seq);
    showModal({
      title: u.deepLessonModalTitle(loc.title),
      bodyHtml: renderMarkdown(loc.deepLesson ?? ''),
      actions: [{ label: u.closePrimary, className: 'primary', onClick: () => this.terminal.focus() }],
      onDismiss: () => this.terminal.focus(),
    });
  }

  /** Explain every on-screen region; optional highlight tour. */
  private openUiHelp(runTour = false): void {
    if (runTour) startUiTour(this.root);
    const modal = showModal({
      title: ui().uiGuideTitle,
      bodyHtml: uiHelpModalHtml(),
      actions: [{ label: ui().close, className: 'ghost', onClick: () => modal.close() }],
      onClose: () => {
        if (this.helpReopenTimer !== null) {
          window.clearTimeout(this.helpReopenTimer);
          this.helpReopenTimer = null;
        }
        this.terminal.focus();
      },
    });
    modal.el.querySelectorAll<HTMLButtonElement>('[data-focus-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.focusId;
        if (!id) return;
        modal.close();
        startUiTour(this.root, id, 3000);
        if (this.helpReopenTimer !== null) window.clearTimeout(this.helpReopenTimer);
        this.helpReopenTimer = window.setTimeout(() => {
          this.helpReopenTimer = null;
          this.openUiHelp(false);
        }, 3000);
      });
    });
  }

  private openLocalGuide(): void {
    showModal({
      title: 'Local Python Setup',
      bodyHtml: renderMarkdown(`
### From browser sandbox to a real Python project

#### 1. Environment & tooling
- **Python:** install the latest stable from [python.org](https://www.python.org/downloads/).
- **venv:** every project gets an isolated environment.
\`\`\`bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
\`\`\`

#### 2. Dependency pinning
\`\`\`bash
pip install -U pip
pip install ruff pytest
pip freeze > requirements.txt   # or use poetry.lock
\`\`\`

#### 3. Project layout
\`\`\`text
my_project/
├── pyproject.toml
├── .venv/               # local env (gitignored)
├── src/my_project/
└── tests/
\`\`\`

#### 4. Format & check
\`\`\`bash
ruff check . && ruff format .
pytest
\`\`\`
`),
      actions: [{ label: 'Close', className: 'primary', onClick: () => this.terminal.focus() }],
      onDismiss: () => this.terminal.focus(),
    });
  }

  private openWelcome(): void {
    const u = ui();
    showModal({
      title: u.welcomeTitle,
      bodyHtml: renderMarkdown(u.welcomeBody),
      actions: [
        { label: u.sandboxAction, className: 'ghost', onClick: () => undefined },
        { label: u.openLevelsAction, className: 'primary', onClick: () => this.openLevels() },
      ],
    });
  }
}

/* —— helpers —— */

const CHEERS = [
  'That object is well understood.',
  'The reference graph makes sense now.',
  'Names and objects, clearly separated.',
  'Nice — you traced the alias.',
  'The heap behaves as you expected.',
];

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Progress) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // ignore quota / private mode
  }
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
