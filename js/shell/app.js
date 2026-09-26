/**
 * Application shell: sandbox session, meta-commands, undo/reset, level flow.
 */

import { createSession, displayValue, snapshot, referenceEdges, liveObjectIds, runFresh } from '../engine/index.js';
import { checkGoal } from '../levels/compare.js';
import { allLevels, getLevel, levelIndex, sequences } from '../levels/pack.js';
import { renderMemory, renderGoalHtml } from '../viz/memory.js';

const STORAGE_KEY = 'learnpystate.v1';

/**
 * @typedef {{source: string, stdout: string[]}} HistoryEntry
 */

export class App {
  /**
   * @param {{
   *   canvas: SVGElement,
   *   brief: HTMLElement,
   *   terminal: HTMLElement,
   *   input: HTMLTextAreaElement,
   *   status: HTMLElement,
   *   levelList: HTMLElement,
   *   golf: HTMLElement,
   * }} els
   */
  constructor(els) {
    this.els = els;
    this.session = createSession();
    /** @type {HistoryEntry[]} */
    this.history = [];
    /** @type {Object[]} */
    this.undoStack = [];
    this.levelId = null;
    this.level = null;
    this.par = null;
    this.statementsUsed = 0;
    this.solved = loadSolved();
    this.sandboxBoot();
  }

  /** @returns {void} */
  sandboxBoot() {
    this.levelId = null;
    this.level = null;
    this.par = null;
    this.statementsUsed = 0;
    this.levelCompleted = false;
    this.session.reset();
    this.history = [];
    this.undoStack = [];
    this.els.input.value = '';
    this.els.terminal.innerHTML = '';
    this.println('LearnPyState sandbox. Type Python statements, or `help`.', 'muted');
    this.println('Meta: help · levels · level <id> · goal · hint · undo · reset · golf', 'muted');
    this.render();
  }

  /**
   * @param {string} text
   * @param {string} [cls]
   * @returns {void}
   */
  println(text, cls = '') {
    const line = document.createElement('div');
    line.className = `term-line ${cls}`.trim();
    line.textContent = text;
    this.els.terminal.appendChild(line);
    this.els.terminal.scrollTop = this.els.terminal.scrollHeight;
  }

  /**
   * @param {string} text
   * @returns {void}
   */
  printError(text) {
    this.println(text, 'error');
    this.els.status.textContent = text;
    this.els.status.dataset.tone = 'error';
  }

  /**
   * @param {string} text
   * @param {string} [statusLabel]
   * @returns {void}
   */
  printOk(text, statusLabel = 'ok') {
    this.println(text, 'ok');
    this.els.status.textContent = statusLabel;
    this.els.status.dataset.tone = 'ok';
  }

  /**
   * Submit one multi-line chunk from the REPL.
   *
   * @param {string} raw
   * @returns {void}
   */
  submit(raw) {
    const source = raw.replace(/\s+$/, '');
    if (!source.trim()) return;

    if (this.isMeta(source.trim())) {
      this.runMeta(source.trim());
      return;
    }

    this.undoStack.push({
      state: this.session.clone(),
      history: [...this.history],
      statementsUsed: this.statementsUsed,
    });

    const statementCount = countStatements(source);
    this.println('>>> ' + source.replace(/\n/g, '\n... '), 'cmd');

    try {
      const before = this.session.state.stdout.length;
      this.session.run(source);
      const newOut = this.session.state.stdout.slice(before);
      for (const line of newOut) this.println(line, 'stdout');
      this.history.push({ source, stdout: newOut });
      this.statementsUsed += statementCount;
      this.els.status.textContent = 'ok';
      this.els.status.dataset.tone = 'ok';
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      this.printError(message);
    }

    this.render();
    if (this.level) this.checkLevelComplete();
  }

  /**
   * @param {string} source
   * @returns {boolean}
   */
  isMeta(source) {
    return /^(help|levels|level|goal|hint|undo|reset|golf|sandbox)\b/.test(source);
  }

  /**
   * @param {string} source
   * @returns {void}
   */
  runMeta(source) {
    const [cmd, ...rest] = source.split(/\s+/);
    switch (cmd) {
      case 'help':
        this.println('Python subset: assignments, lists, dicts, tuples, functions, print, arithmetic.', 'muted');
        this.println('Meta: levels · level <id> · goal · hint · undo · reset · golf · sandbox', 'muted');
        break;
      case 'levels':
        this.showLevels();
        break;
      case 'level': {
        const id = rest[0];
        if (!id) {
          this.println('Usage: level <id>   e.g. level intro-1', 'muted');
          break;
        }
        this.loadLevel(id);
        break;
      }
      case 'goal':
        if (!this.level) this.println('No active level. Use `levels` then `level <id>`.', 'muted');
        else this.println(this.level.brief, 'muted');
        break;
      case 'hint':
        if (!this.level) this.println('No active level.', 'muted');
        else this.println('Hint: ' + this.level.hint, 'muted');
        break;
      case 'undo':
        this.undo();
        break;
      case 'reset':
        this.resetLevel();
        break;
      case 'golf':
        if (!this.level) this.println('No active level.', 'muted');
        else this.println(`statements: ${this.statementsUsed} · par: ${this.par}`, 'muted');
        break;
      case 'sandbox':
        this.sandboxBoot();
        break;
      default:
        this.printError(`Unknown command: ${cmd}`);
    }
    this.render();
  }

  /** @returns {void} */
  showLevels() {
    this.println('Levels', 'muted');
    for (const seq of sequences) {
      this.println(`  ${seq.title}`, 'muted');
      for (const level of seq.levels) {
        const mark = this.solved.has(level.id) ? '✓' : '·';
        const active = this.levelId === level.id ? ' (active)' : '';
        this.println(`    ${mark} ${level.id}  ${level.name}${active}`, 'muted');
      }
    }
  }

  /**
   * @param {string} id
   * @returns {void}
   */
  loadLevel(id) {
    const level = getLevel(id);
    if (!level) {
      this.printError(`Unknown level: ${id}`);
      return;
    }
    this.level = level;
    this.levelId = level.id;
    this.par = level.par;
    this.statementsUsed = 0;
    this.levelCompleted = false;
    this.history = [];
    this.undoStack = [];
    this.session = createSession();
    if (level.start.trim()) {
      try {
        this.session.run(level.start);
      } catch (err) {
        this.printError('Level start failed: ' + (err.message || err));
      }
    }
    this.els.terminal.innerHTML = '';
    this.println(`Level ${level.id} — ${level.name}`, 'ok');
    this.println(level.brief, 'muted');
    this.println(`par ${level.par} statements · type goal or hint`, 'muted');
    this.els.status.textContent = level.name;
    this.els.status.dataset.tone = 'ok';
    this.persist();
    this.render();
  }

  /** @returns {void} */
  resetLevel() {
    if (!this.level) {
      this.sandboxBoot();
      return;
    }
    this.loadLevel(this.levelId);
    this.println('Level reset.', 'muted');
  }

  /** @returns {void} */
  undo() {
    const prev = this.undoStack.pop();
    if (!prev) {
      this.println('Nothing to undo.', 'muted');
      return;
    }
    const state = this.session.state;
    state.frames = prev.state.frames;
    state.heap = prev.state.heap;
    state.stdout = prev.state.stdout;
    state.errors = prev.state.errors;
    this.history = prev.history;
    this.statementsUsed = prev.statementsUsed;
    this.println('Undid last statement.', 'muted');
    this.render();
  }

  /** @returns {void} */
  checkLevelComplete() {
    if (this.levelCompleted) return;
    const snap = snapshot(this.session.state);
    const result = checkGoal(this.level.goal, snap, this.session.state);
    if (!result.ok) {
      this.els.status.textContent = result.message;
      this.els.status.dataset.tone = 'idle';
      return;
    }
    this.levelCompleted = true;
    this.solved.add(this.level.id);
    this.persist();
    const golf = this.statementsUsed <= this.par ? ' on par' : '';
    this.printOk(
      `Level complete${golf}. ${this.statementsUsed} statements (par ${this.par}).`,
      `${this.level.id} complete`,
    );
    const idx = levelIndex(this.level.id);
    const next = allLevels()[idx + 1];
    if (next) this.println(`Next: level ${next.id}`, 'muted');
  }

  /** @returns {void} */
  persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ solved: [...this.solved], levelId: this.levelId }),
      );
    } catch {
      // ignore quota / private mode
    }
  }

  /** @returns {void} */
  render() {
    const state = this.session.state;
    const edges = referenceEdges(state);
    const live = liveObjectIds(state);
    renderMemory(this.els.canvas, state, edges, live);

    if (this.level) {
      this.els.brief.innerHTML = '';
      const title = document.createElement('h2');
      title.className = 'brief-title';
      title.textContent = this.level.name;
      this.els.brief.appendChild(title);

      const id = document.createElement('div');
      id.className = 'brief-id';
      id.textContent = this.level.id;
      this.els.brief.appendChild(id);

      const body = document.createElement('p');
      body.className = 'brief-body';
      body.textContent = this.level.brief;
      this.els.brief.appendChild(body);

      const meta = document.createElement('div');
      meta.className = 'brief-meta';
      meta.innerHTML = `<span>par ${this.par}</span><span>used ${this.statementsUsed}</span>`;
      this.els.brief.appendChild(meta);

      const label = document.createElement('div');
      label.className = 'brief-label';
      label.textContent = 'Target';
      this.els.brief.appendChild(label);

      const target = document.createElement('div');
      target.className = 'brief-target';
      target.innerHTML = renderGoalHtml(this.level.goalPreview);
      this.els.brief.appendChild(target);

      this.els.golf.textContent = `${this.statementsUsed}/${this.par}`;
    } else {
      this.els.brief.innerHTML = `
        <h2 class="brief-title">Sandbox</h2>
        <p class="brief-body">Type Python to mutate the memory graph. Names sit on the stack; mutables live on the heap; amber edges are references.</p>
        <p class="brief-body">Try: <code>a = [1]</code> · <code>b = a</code> · <code>a.append(2)</code></p>
      `;
      this.els.golf.textContent = '—';
    }

    this.renderLevelList();
  }

  /** @returns {void} */
  renderLevelList() {
    const root = this.els.levelList;
    root.innerHTML = '';
    for (const seq of sequences) {
      const seqEl = document.createElement('div');
      seqEl.className = 'level-seq';
      seqEl.textContent = seq.title;
      root.appendChild(seqEl);
      for (const level of seq.levels) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'level-item';
        if (this.levelId === level.id) btn.classList.add('is-active');
        if (this.solved.has(level.id)) btn.classList.add('is-solved');
        btn.innerHTML = `<span class="level-mark">${this.solved.has(level.id) ? '✓' : '·'}</span><span>${level.name}</span><span class="level-par">${level.par}</span>`;
        btn.addEventListener('click', () => this.loadLevel(level.id));
        root.appendChild(btn);
      }
    }
  }
}

/**
 * Rough statement count for golf (lines that are not blank / comments).
 *
 * @param {string} source
 * @returns {number}
 */
export function countStatements(source) {
  return source
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith('#');
    }).length;
}

/**
 * @returns {Set<string>}
 */
function loadSolved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw);
    return new Set(data.solved || []);
  } catch {
    return new Set();
  }
}
