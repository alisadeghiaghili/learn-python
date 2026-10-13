/**
 * Application shell: mounted into #app. Toolbar, tabbed board (Memory/Plot),
 * script editor drawer, terminal console, and the always-on learning dock with a
 * live per-checklist. Synchronous (the Python engine is a pure in-memory
 * simulator — no async runtime to boot).
 */

import { createSession, type Session, referenceEdges, liveObjectIds } from '../engine/session';
import { checkGoal } from '../engine/checks';
import type { GoalSpec, Level, MemoryState, Sequence, Snapshot } from '../engine/types';
import { splitPythonStatements } from '../engine/steps';
import { allLevels, getLevel, levelIndex, sequenceForLevel, sequences } from '../levels/index';
import { renderMemory, renderRam } from './memory';
import { BoardView } from './board';
import { TerminalView } from './terminal';
import { ScriptEditorView } from './editor';
import { escapeHtml, renderMarkdown, showModal, type ModalSpec } from './dialog';
import { formatVisitorCount, startVisitorCounter } from './visitor-counter';

const REPO_URL = 'https://github.com/alisadeghiaghili/learn-python';
const COFFEE_URL = 'https://www.buymeacoffee.com/alisadeghil';
const PROGRESS_KEY = 'learn-python-progress-v1';

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
  private showHint = false;
  private progress: Progress = loadProgress();
  private checkResults: DockCheck[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
    this.session = createSession();
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
    this.root.innerHTML = `
      <div class="app-main">
        <header class="toolbar">
          <a class="brand" href="./" aria-label="learn-python home">
            <img class="brand-logo" src="assets/python.svg" width="24" height="24" alt="" />
            <span class="brand-text">learn<span class="brand-accent">-</span>python</span>
          </a>
          <div class="level-title" id="level-title"></div>
          <div class="toolbar-actions">
            <button type="button" class="nav-toggle" data-action="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="nav-drawer">
              <span class="nav-bars" aria-hidden="true"></span>
            </button>
            <div class="nav-drawer" id="nav-drawer">
              <button type="button" data-action="levels">Levels</button>
              <button type="button" data-action="lesson">Lesson</button>
              <button type="button" data-action="goal">Guide</button>
              <button type="button" data-action="hint">Hint</button>
              <button type="button" data-action="solution">Solution</button>
              <button type="button" data-action="undo">Undo</button>
              <button type="button" data-action="reset">Reset</button>
              <button type="button" data-action="sandbox" class="ghost">Sandbox</button>
              <button type="button" data-action="local-setup" class="ghost">Local setup</button>
              <button type="button" class="help-btn" data-action="help" title="Help" aria-label="Help">?</button>
            </div>
            <span class="tb-stat visitors" id="visitor-stat" role="img" title="Unique visitors" aria-label="Unique visitors" hidden>
              <svg class="visitor-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0-2.21-2.69-4-6-4s-6 1.79-6 4v1h12v-1zm-1.07 0H3.07C3.56 11.83 5.48 11 8 11s4.44.83 4.93 2z"/></svg>
              <span class="visitor-count" id="visitor-count"></span>
            </span>
            <a class="tb-link gh" href="${REPO_URL}" target="_blank" rel="noopener noreferrer" title="GitHub repository" aria-label="GitHub repository">
              <svg class="gh-mark" viewBox="0 0 16 16" width="18" height="18"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            </a>
            <a class="tb-link support" href="${COFFEE_URL}" target="_blank" rel="noopener noreferrer" title="Buy me a coffee" aria-label="Buy me a coffee">☕</a>
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
        if (action === 'help') this.openHelp();
        this.terminal.focus();
      });
    });

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.nav-drawer') && !target.closest('[data-action="nav-toggle"]')) {
        this.closeNav();
      }
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
    const open = drawer.hasAttribute('hidden');
    if (open) {
      drawer.removeAttribute('hidden');
      drawer.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    } else {
      drawer.setAttribute('hidden', '');
      drawer.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  private closeNav(): void {
    const drawer = this.root.querySelector<HTMLElement>('#nav-drawer');
    const btn = this.root.querySelector<HTMLButtonElement>('[data-action="nav-toggle"]');
    if (!drawer || !btn) return;
    drawer.setAttribute('hidden', '');
    drawer.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  /* —— Level / sandbox flow —— */

  enterLevel(id: string, opts?: { openLesson?: boolean }): void {
    const level = getLevel(id);
    if (!level) return;
    this.level = level;
    this.showHint = false;
    this.statementsUsed = 0;
    this.levelCompleted = false;
    this.undoStack = [];
    this.terminal.clear();
    this.terminal.push('meta', `Level: ${level.name}`);

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
    this.terminal.push('meta', 'learn-python sandbox. Type Python statements, or `help`.');
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
      this.titleEl.textContent = `Level ${idx} · ${this.level.name}`;
    } else {
      this.titleEl.textContent = 'Sandbox';
    }
  }

  /* —— Board (memory canvas) rendering —— */

  private renderBoard(): void {
    const state = this.session.state;
    const edges = referenceEdges(state);
    const live = liveObjectIds(state);
    renderMemory(this.board.canvasEl, state, edges, live);
  }

  private renderRamBoard(): void {
    const state = this.session.state;
    renderRam(this.board.ramCanvasEl, state, liveObjectIds(state));
  }

  /** Redraw both memory boards so the Memory and RAM tabs stay in sync. */
  private renderBoards(): void {
    this.renderBoard();
    this.renderRamBoard();
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
      const before = this.session.state.stdout.length;
      this.session.run(source);
      const newOut = this.session.state.stdout.slice(before);
      for (const line of newOut) this.terminal.push('out', line);
      this.statementsUsed += countStatements(source);
    } catch (err) {
      this.terminal.push('err', err instanceof Error ? err.message : String(err));
    }

    this.board.setPlots(this.session.state.plots);
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

    const golf = used <= par ? 'on par' : `${used} statements (par ${par})`;
    this.terminal.push('ok', `Level complete — ${golf}.`);

    const next = allLevels()[levelIndex(level.id) + 1];
    const cheer = CHEERS[Math.floor(Math.random() * CHEERS.length)]!;
    const bodyHtml = `
      <div class="celebrate" aria-live="polite">
        <div class="celebrate-visual" aria-hidden="true">
          <div class="celebrate-ring"></div>
          <div class="celebrate-star">★</div>
        </div>
        <div class="celebrate-badge">Level clear</div>
        <h3 class="celebrate-title">${escapeHtml(level.name)}</h3>
        <p class="celebrate-sub"><code>${escapeHtml(level.id)}</code></p>
        <p class="celebrate-cheer">${escapeHtml(cheer)}</p>
        <div class="celebrate-stats">${used} statement${used === 1 ? '' : 's'} · par ${par}</div>
        ${
          next
            ? `<div class="celebrate-next">Up next: **${escapeHtml(next.name)}**</div>`
            : `<div class="celebrate-next">You reached the end of this pack.</div>`
        }
      </div>
    `;

    const actions: ModalSpec['actions'] = [
      { label: 'Keep going', className: 'ghost', onClick: () => this.terminal.focus() },
    ];
    if (next) {
      actions.push({
        label: `Next: ${next.name}`,
        className: 'primary',
        onClick: () => this.enterLevel(next.id, { openLesson: true }),
      });
    } else {
      actions.push({
        label: 'Browse levels',
        className: 'primary',
        onClick: () => this.openLevels(),
      });
    }

    showModal({ title: 'Level complete', bodyHtml, actions });
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
    if (!this.level) {
      this.dockEl.innerHTML = `
        <h2>Sandbox</h2>
        <p class="objective">Type Python to mutate the memory graph. Names sit on the stack; mutables live on the heap; amber edges are references.</p>
        <div class="learning-box">
          <div class="next-title">Start here</div>
          <ul>
            <li><code>a = [1]</code> — a name pointing at a heap list</li>
            <li><code>b = a</code> — two names, one object (aliasing)</li>
            <li><code>a.append(2)</code> — mutate the shared object in place</li>
          </ul>
        </div>
        <ul class="goal-list">
          <li class="met"><div class="g-label">No active level</div><div class="g-detail">Pick a level from the menu to start checking goals.</div></li>
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
          isCurrent ? ' <span class="chip current-chip">now</span>' : ''
        }</div>
        <div class="g-detail" dir="ltr">${escapeHtml(c.label)}</div>
      </li>`;
    }).join('');

    const firstNext = currentId !== -1 ? solutionCmds[currentId]?.split('\n')[0] : solutionCmds[0]?.split('\n')[0];
    const nextBlock = solved
      ? `<div class="next-box met">All checks passed.</div>`
      : `<div class="next-box">
          <div class="next-title">Next</div>
          <div class="next-row">
            <span class="g-label">try</span>
            ${firstNext ? `<code class="g-cmd g-step-cmd" data-cmd="${escapeHtml(firstNext)}" dir="ltr" title="Click to fill into terminal">${escapeHtml(firstNext)}</code>` : ''}
          </div>
        </div>`;

    this.checkResults = checks;
    this.dockEl.innerHTML = `
      <h2>${escapeHtml(level.name)}</h2>
      <p class="objective">${renderMarkdown(level.brief)}</p>
      <div class="par-note">${this.bestNote(level)}</div>
      ${nextBlock}
      <ul class="goal-list">${items}</ul>
      ${this.showHint ? `<div class="par-note"><strong>Hint:</strong> ${renderMarkdown(level.hint)}</div>` : ''}
    `;
  }

  private bestNote(level: Level): string {
    const prog = this.progress[level.id];
    if (prog?.bestStatements !== undefined) {
      return `Best: ${prog.bestStatements} statement${prog.bestStatements === 1 ? '' : 's'} · par ${level.par}`;
    }
    return `Par ${level.par} statement${level.par === 1 ? '' : 's'}`;
  }

  /* —— Meta commands —— */

  private isMeta(source: string): boolean {
    return /^(help|levels|lesson|level|goal|hint|solution|undo|reset|sandbox|script|clear|golf)\b/.test(source);
  }

  private runMeta(source: string): void {
    const [cmd, ...rest] = source.split(/\s+/);
    switch (cmd) {
      case 'help':
        this.openHelp();
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
          this.terminal.push('meta', 'Usage: level <id>   e.g. level first-name');
          return;
        }
        if (getLevel(id)) this.enterLevel(id);
        else this.terminal.push('err', `Unknown level: ${id}`);
        return;
      }
      case 'goal':
      case 'guide':
      case 'steps':
      case 'next':
        this.focusGuide();
        this.terminal.push('meta', 'The live guide is on the right.');
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
        if (this.level) this.terminal.push('meta', `statements: ${this.statementsUsed} · par: ${this.level.par}`);
        return;
      default:
        this.terminal.push('err', `Unknown command: ${cmd}`);
    }
  }

  private triggerHint(): void {
    if (!this.level) {
      this.terminal.push('meta', 'Hints are available in levels mode.');
      return;
    }
    this.showHint = true;
    this.renderDock(this.checkResults);
    this.terminal.push('meta', `Hint: ${this.level.hint}`);
  }

  private showSolution(): void {
    if (!this.level) return;
    this.terminal.push('meta', `Solution:\n${this.level.solution ?? ''}`);
  }

  private focusGuide(): void {
    this.dockEl.classList.remove('dock-pulse');
    void this.dockEl.offsetWidth;
    this.dockEl.classList.add('dock-pulse');
    this.dockEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) {
      this.terminal.push('meta', 'Nothing to undo.');
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
    this.terminal.push('meta', 'Undid last statement.');
    this.renderBoards();
    this.board.setPlots(state.plots);
    this.refreshDock();
  }

  private reset(): void {
    if (this.level) this.enterLevel(this.level.id);
    else this.enterSandbox();
    this.terminal.push('meta', 'Environment reset.');
  }

  /* —— Modals —— */

  handleCommand(cmd: string): void {
    // All terminal input is routed through runMeta or executeCode.
    this.executeCode(cmd);
  }

  private openLevels(): void {
    const body = sequences
      .map((s) => {
        const rows = s.levels
          .map((l) => {
            const p = this.progress[l.id];
            const solved = Boolean(p?.solved);
            const active = this.level?.id === l.id;
            return `<button type="button" class="level-row ${solved ? 'solved' : ''}${active ? ' active' : ''}" data-level="${l.id}">
              <span class="id">${escapeHtml(l.id)}</span>
              <span class="name">${escapeHtml(l.name)}</span>
              <span class="par-note">par ${l.par}</span>
              <span class="chip ${solved ? 'ok' : ''}">${solved ? `✓ ${p?.bestStatements ?? l.par}` : l.par}</span>
            </button>`;
          })
          .join('');
        const deepBtn = s.deepLesson
          ? `<button type="button" class="series-deep" data-deep="${escapeHtml(s.id)}" title="Read the full ${escapeHtml(s.title)} lesson (ELI5→ELI-PHD)">▤ deep lesson</button>`
          : '';
        return `<div class="series-block"><h3>${escapeHtml(s.title)}</h3><div class="level-list">${rows}</div>${deepBtn}</div>`;
      })
      .join('');

    const modal = showModal({
      title: 'Levels',
      bodyHtml: `<p>Pick a challenge. Each level mutates the memory graph to a target state.</p>
        <div class="legend-box">
          <div class="next-title">How to read</div>
          <ul class="legend-list">
            <li><span class="par-note">par N</span> ideal number of statements</li>
            <li><span class="chip ok">✓ N</span> solved, best ${''}statements</li>
          </ul>
        </div>
        ${body}`,
      actions: [{ label: 'Close', className: 'ghost', onClick: () => undefined }],
    });

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
      parts.push('', '### What this teaches');
      for (const b of level.learning) parts.push(`- ${b}`);
    }
    if (level.fieldNotes?.length) {
      parts.push('', '### In production');
      for (const n of level.fieldNotes) parts.push(`- ${n}`);
    }
    if (level.hint) {
      parts.push('', `**Hint:** ${level.hint}`);
    }
    const actions: ModalSpec['actions'] = [];
    if (seq?.deepLesson) {
      actions.push({ label: 'Deep lesson', className: 'ghost', onClick: () => this.openDeepLesson(seq) });
    }
    actions.push({ label: 'Close', className: 'primary', onClick: () => this.terminal.focus() });
    showModal({
      title: level.name,
      bodyHtml: renderMarkdown(parts.join('\n')),
      actions,
      onDismiss: () => this.terminal.focus(),
    });
  }

  private openDeepLesson(seq: Sequence): void {
    showModal({
      title: `${seq.title} — deep lesson`,
      bodyHtml: renderMarkdown(seq.deepLesson ?? ''),
      actions: [{ label: 'Close', className: 'primary', onClick: () => this.terminal.focus() }],
      onDismiss: () => this.terminal.focus(),
    });
  }

  private openHelp(): void {
    showModal({
      title: 'Help',
      bodyHtml: renderMarkdown(`
### Command Reference

| Command | Effect |
|---|---|
| \`levels\` | Open the level catalog |
| \`lesson\` | Explain the current level |
| \`hint\` | Reveal the level hint |
| \`solution\` | Show the target solution |
| \`undo\` | Remove the last statement |
| \`reset\` | Clear the environment |
| \`sandbox\` | Enter open sandbox mode |
| \`clear\` | Clear the console log |
| \`script\` | Toggle the multi-line script editor |
| \`local\` | Local Python setup guide |

### Execution
- Type in the console prompt and press **Enter**.
- **Tab** cycles through autocomplete suggestions.
- **Alt + -** inserts a spaced \` = \`.
- Press **Ctrl / Cmd + Enter** in the script editor to run.
`),
      actions: [{ label: 'Close', onClick: () => undefined }],
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
    showModal({
      title: 'Welcome to learn-python',
      bodyHtml: renderMarkdown(`
Make Python's memory model visible. Names live on the **stack**; mutable objects live on the **heap**; amber arrows are **references**.

- **Memory tab** — the live object graph.
- **Plot tab** — for the plotting levels.
- **Dock** — the always-on guide with a per-check checklist.

There are **${allLevels().length} levels** across ${sequences.length} series, from first bindings to aliasing, containers, and call frames.
`),
      actions: [
        { label: 'Sandbox', className: 'ghost', onClick: () => undefined },
        { label: 'Open levels', className: 'primary', onClick: () => this.openLevels() },
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
