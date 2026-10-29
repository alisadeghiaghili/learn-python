/**
 * Terminal UI: an interactive Python prompt, history scrollback, and ghost
 * auto-complete driven by level hints and vocabulary.
 *
 * Tab completions are generated dynamically so learners can hit Tab on any
 * exercise and fill the next word.
 *
 * Supports multi-line blocks with `... ` continuation prompts, auto-indentation,
 * paste block execution, history navigation, and keyboard shortcuts.
 */

import { escapeHtml } from './dialog';

export type LogKind = 'cmd' | 'out' | 'err' | 'ok' | 'meta';

export interface LogLine {
  kind: LogKind;
  text: string;
}

/** Python built-in keywords and common functions available at any prompt. */
const BASE_COMMANDS = [
  'help',
  'levels',
  'lesson',
  'goal',
  'hint',
  'solution',
  'undo',
  'reset',
  'sandbox',
  'script',
  'clear',
  'golf',
  'print()',
  'type()',
  'id()',
  'len()',
  'range()',
  'list()',
  'dict()',
  'set()',
  'tuple()',
  'int()',
  'float()',
  'str()',
  'bool()',
  'sum()',
  'min()',
  'max()',
  'sorted()',
  'enumerate()',
  'zip()',
  'map()',
  'filter()',
  'import numpy as np',
  'import pandas as pd',
  'import asyncio',
  'import threading',
  'import matplotlib.pyplot as plt',
];

interface WordState {
  head: string[];
  current: string;
  afterSpace: boolean;
}

function parseLine(value: string): WordState {
  const endsWithSpace = /\s$/.test(value);
  const trimmed = value.trim();
  if (!trimmed) {
    return { head: [], current: '', afterSpace: endsWithSpace };
  }
  const parts = trimmed.split(/\s+/);
  if (endsWithSpace) {
    return { head: parts, current: '', afterSpace: true };
  }
  return { head: parts.slice(0, -1), current: parts[parts.length - 1]!, afterSpace: false };
}

/** Check if a line opens a compound statement or has unclosed brackets. */
function isOpenBlock(code: string): boolean {
  const trimmed = code.trimEnd();
  if (trimmed.endsWith(':')) return true;
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '\\') { i++; continue; }
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (inSingle || inDouble) continue;
    if (ch === '#') break;
    if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (ch === '{') brace++;
    else if (ch === '}') brace = Math.max(0, brace - 1);
  }
  return paren > 0 || bracket > 0 || brace > 0;
}

export class TerminalView {
  private logEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private promptEl: HTMLElement;
  private wrapEl: HTMLElement;
  private ghostEl: HTMLElement;
  private hintEl: HTMLElement;
  private lines: LogLine[] = [];
  private history: string[] = [];
  private historyIdx = -1;
  private multilineBuffer: string[] = [];
  private draft = '';
  private hint = '';
  private extraCompletions: string[] = [];
  private wordCycle: string[] = [];
  private wordIdx = 0;
  private wordKey = '';
  private onSubmit: (cmd: string, options?: { alreadyEchoed?: boolean }) => void;
  private onOpenEditor: () => void;

  constructor(
    root: HTMLElement,
    onSubmit: (cmd: string, options?: { alreadyEchoed?: boolean }) => void,
    onOpenEditor: () => void,
  ) {
    this.onSubmit = onSubmit;
    this.onOpenEditor = onOpenEditor;

    root.innerHTML = `
      <div class="term-toolbar">
        <span class="term-status-badge">Console</span>
        <button type="button" class="btn btn-sm ghost" id="term-btn-script" title="Toggle multi-line script editor">
          Script
        </button>
      </div>
      <div class="term-log" id="term-log" role="log" aria-live="polite" dir="ltr"></div>
      <div class="term-hint" id="term-hint" hidden dir="ltr"></div>
      <div class="term-input-row" dir="ltr">
        <label class="prompt" for="term-input">&gt;&gt;&gt; </label>
        <div class="term-input-wrap" id="term-input-wrap">
          <div class="term-ghost" id="term-ghost" aria-hidden="true"></div>
          <input
            id="term-input"
            class="term-input"
            autocomplete="off"
            spellcheck="false"
            placeholder=""
            dir="ltr"
            aria-label="Python command input"
          />
        </div>
      </div>
    `;

    this.logEl = root.querySelector('#term-log')!;
    this.inputEl = root.querySelector('#term-input')!;
    this.promptEl = root.querySelector('.prompt')!;
    this.wrapEl = root.querySelector('#term-input-wrap')!;
    this.ghostEl = root.querySelector('#term-ghost')!;
    this.hintEl = root.querySelector('#term-hint')!;

    root.querySelector('#term-btn-script')?.addEventListener('click', () => {
      this.onOpenEditor();
    });

    this.inputEl.addEventListener('keydown', (e) => this.onKey(e));
    this.inputEl.addEventListener('input', () => this.syncGhost());

    this.inputEl.addEventListener('paste', (e) => {
      const text = e.clipboardData?.getData('text');
      if (text && text.includes('\n')) {
        e.preventDefault();
        const prefix = this.multilineBuffer.length > 0 ? this.multilineBuffer.join('\n') + '\n' : '';
        const combined = (prefix + text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
        this.multilineBuffer = [];
        this.promptEl.textContent = '>>> ';
        this.inputEl.value = '';
        this.recordHistory(combined);
        this.onSubmit(combined);
      }
    });
  }

  focus(): void {
    if (document.querySelector('.overlay .modal')) return;
    this.inputEl.focus();
    const len = this.inputEl.value.length;
    try {
      this.inputEl.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
  }

  setLog(lines: LogLine[]): void {
    this.lines = lines;
    this.render();
  }

  getLog(): LogLine[] {
    return this.lines;
  }

  getHistory(): string[] {
    return [...this.history];
  }

  setHistory(history: string[]): void {
    this.history = [...history];
    this.historyIdx = this.history.length;
  }

  private recordHistory(cmd: string): void {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    if (this.history.length > 0 && this.history[this.history.length - 1] === trimmed) {
      this.historyIdx = this.history.length;
      return;
    }
    this.history.push(trimmed);
    this.historyIdx = this.history.length;
  }

  push(kind: LogKind, text: string): void {
    if (kind === 'cmd' && text) {
      const clean = text.startsWith('>>> ') ? text.slice(4) : text;
      this.recordHistory(clean.replace(/\n\.\.\. /g, '\n'));
    }
    this.lines.push({ kind, text });
    if (this.lines.length > 500) this.lines = this.lines.slice(-400);
    this.render();
  }

  clear(): void {
    this.lines = [];
    this.multilineBuffer = [];
    if (this.promptEl) this.promptEl.textContent = '>>> ';
    this.render();
  }

  private render(): void {
    const html = this.lines
      .map((l) => `<div class="term-row is-${l.kind}">${escapeHtml(l.text)}</div>`)
      .join('');
    this.logEl.innerHTML = html;
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  setHint(command: string | null): void {
    const singleLine = (command ?? '').split('\n').map((s) => s.trim()).filter(Boolean)[0] ?? '';
    this.hint = singleLine;
    this.inputEl.placeholder = this.hint ? `Next: ${this.hint}` : 'Type Python — help · levels · hint · script';
    this.hintEl.hidden = !this.hint;
    if (this.hint) {
      this.hintEl.innerHTML = `Next: <code>${escapeHtml(this.hint)}</code> <span class="par-note">· Ctrl+Space / → fills word</span>`;
    }
    this.syncGhost();
  }

  setInput(value: string): void {
    this.inputEl.value = value;
    this.focus();
    this.syncGhost();
  }

  setExtraCompletions(commands: string[]): void {
    const singleLines = commands
      .flatMap((c) => (c || '').split('\n'))
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('#'));
    this.extraCompletions = [...new Set<string>(singleLines)];
  }

  private allCompletions(): string[] {
    const raw = [
      ...(this.hint ? [this.hint] : []),
      ...this.extraCompletions,
      ...BASE_COMMANDS,
      ...this.history.slice().reverse(),
    ];
    const singleLines = raw.flatMap((cmd) =>
      (cmd || '').split('\n').map((s) => s.trim()).filter(Boolean),
    );
    return [...new Set<string>(singleLines)];
  }

  private matchingCommands(head: string[], current: string): string[] {
    const cur = current.toLowerCase();
    return this.allCompletions().filter((cmd) => {
      const words = cmd.split(/\s+/);
      if (words.length <= head.length) {
        if (head.length && words.length === head.length) {
          return words.every((w, i) => w === head[i]);
        }
        return false;
      }
      for (let i = 0; i < head.length; i++) {
        if (words[i] !== head[i]) return false;
      }
      if (!cur) return true;
      return (words[head.length] ?? '').toLowerCase().startsWith(cur);
    });
  }

  private nextWords(head: string[], current: string): string[] {
    const matches = this.matchingCommands(head, current);
    const words: string[] = [];
    const push = (w: string | undefined) => {
      if (!w) return;
      if (!words.includes(w)) words.push(w);
    };
    if (this.hint) {
      const hw = this.hint.trim().split(/\s+/);
      const okHead = head.every((h, i) => hw[i] === h);
      if (okHead && hw[head.length]) push(hw[head.length]);
    }
    for (const cmd of matches) {
      const cw = cmd.trim().split(/\s+/);
      if (cw[head.length]) push(cw[head.length]);
    }
    return words.filter((w) => !current || w.toLowerCase().startsWith(current.toLowerCase()));
  }

  /** Ghost shows a suffix via a hidden typed span for pixel-perfect alignment. */
  private syncGhost(): void {
    const value = this.inputEl.value;
    this.ghostEl.dataset.visible = '0';
    this.ghostEl.innerHTML = '';
    this.wrapEl.classList.remove('has-ghost');

    if (!value) return;

    const { head, current, afterSpace } = parseLine(value);
    const words = this.nextWords(head, afterSpace ? '' : current);
    const first = words[0];
    if (!first) return;

    if (afterSpace) {
      this.ghostEl.innerHTML = `<span style="visibility:hidden">${escapeHtml(value)}</span><span class="ghost-suffix">${escapeHtml(first)}</span>`;
      this.ghostEl.dataset.visible = '1';
      this.wrapEl.classList.add('has-ghost');
      return;
    }

    if (first.toLowerCase().startsWith(current.toLowerCase()) && first.length > current.length) {
      const suffix = first.slice(current.length);
      this.ghostEl.innerHTML = `<span style="visibility:hidden">${escapeHtml(value)}</span><span class="ghost-suffix">${escapeHtml(suffix)}</span>`;
      this.ghostEl.dataset.visible = '1';
      this.wrapEl.classList.add('has-ghost');
    }
  }

  private applyTab(e: KeyboardEvent): void {
    e.preventDefault();
    const value = this.inputEl.value;
    const trimmedVal = value.trim();

    if (this.hint && trimmedVal.toLowerCase() === this.hint.trim().toLowerCase()) {
      return;
    }

    const { head, current, afterSpace } = parseLine(value);
    const cycleKey = `${head.join(' ')}|${afterSpace ? '' : current}`;

    if (!value && this.hint) {
      const firstWord = this.hint.trim().split(/\s+/)[0]!;
      this.inputEl.value = firstWord;
      this.wordCycle = [firstWord];
      this.wordIdx = 0;
      this.wordKey = firstWord;
      this.focus();
      this.syncGhost();
      return;
    }

    if (!afterSpace && current) {
      const currentMatches = this.nextWords(head, current);
      if (currentMatches.length === 1 && currentMatches[0].toLowerCase() === current.toLowerCase()) {
        const newHead = [...head, currentMatches[0]];
        const fullSoFar = newHead.join(' ');
        if (this.hint && fullSoFar.toLowerCase() === this.hint.trim().toLowerCase()) {
          this.inputEl.value = this.hint.trim();
          this.focus();
          this.syncGhost();
          return;
        }
        const nextOpts = this.nextWords(newHead, '');
        if (nextOpts.length > 0) {
          this.inputEl.value = `${newHead.join(' ')} ${nextOpts[0]}`;
          this.wordCycle = nextOpts;
          this.wordIdx = 0;
          this.wordKey = `${newHead.join(' ')}|`;
          this.focus();
          this.syncGhost();
          return;
        }
      }
    }

    const options = this.nextWords(head, afterSpace ? '' : current);
    if (!options.length) {
      this.syncGhost();
      return;
    }

    if (cycleKey !== this.wordKey || !this.wordCycle.length) {
      this.wordKey = cycleKey;
      this.wordCycle = options;
      this.wordIdx = 0;
    } else {
      this.wordIdx = (this.wordIdx + 1) % this.wordCycle.length;
    }

    const chosen = this.wordCycle[this.wordIdx] ?? options[0]!;
    const headText = head.length ? `${head.join(' ')} ` : '';
    this.inputEl.value = `${headText}${chosen}`;
    this.focus();
    this.syncGhost();

    if (this.wordCycle.length > 1) {
      const preview = this.wordCycle.slice(0, 6).join(' · ');
      this.hintEl.hidden = false;
      this.hintEl.innerHTML = `Tab word <strong>${this.wordIdx + 1}/${this.wordCycle.length}</strong>: <code>${escapeHtml(preview)}</code>${
        this.wordCycle.length > 6 ? ' …' : ''
      }`;
    } else if (this.hint) {
      this.hintEl.innerHTML = `Next: <code>${escapeHtml(this.hint)}</code> <span class="par-note">· Tab fills the word</span>`;
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.altKey && (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '–' || e.key === '—')) {
      e.preventDefault();
      this.insertAssignment();
      this.syncGhost();
      return;
    }
    if (e.key === 'Tab') {
      // Tab and Shift+Tab move focus naturally without keyboard trap (WCAG 2.1.2)
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.code === 'Space' || e.key === ' ')) {
      e.preventDefault();
      this.applyTab(e);
      return;
    }
    if (e.key === 'ArrowRight' && this.inputEl.selectionStart === this.inputEl.value.length) {
      const suffixEl = this.ghostEl.querySelector('.ghost-suffix');
      if (this.ghostEl.dataset.visible === '1' && suffixEl?.textContent) {
        e.preventDefault();
        this.inputEl.value += suffixEl.textContent;
        this.focus();
        this.syncGhost();
        return;
      }
      if (this.hint && !this.inputEl.value) {
        e.preventDefault();
        this.applyTab(e);
        return;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.multilineBuffer.length > 0) {
        this.multilineBuffer = [];
        this.promptEl.textContent = '>>> ';
        this.inputEl.value = '';
        this.push('meta', 'KeyboardInterrupt');
        this.syncGhost();
        return;
      }
      this.inputEl.value = '';
      this.wordCycle = [];
      this.wordKey = '';
      this.syncGhost();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (document.querySelector('.overlay .modal')) return;
      const rawValue = this.inputEl.value;
      this.inputEl.value = '';
      this.wordCycle = [];
      this.wordKey = '';

      if (this.multilineBuffer.length > 0) {
        // Inside a multi-line block
        if (!rawValue.trim()) {
          // Blank line finishes the block!
          this.lines.push({ kind: 'cmd', text: '... ' });
          this.promptEl.textContent = '>>> ';
          const fullCode = this.multilineBuffer.join('\n');
          this.multilineBuffer = [];
          this.recordHistory(fullCode);
          this.render();
          this.onSubmit(fullCode, { alreadyEchoed: true });
          this.focus();
          this.syncGhost();
          return;
        }
        // Continuation line inside block
        this.lines.push({ kind: 'cmd', text: `... ${rawValue}` });
        this.multilineBuffer.push(rawValue);
        const indentMatch = rawValue.match(/^(\s*)/);
        let indent = indentMatch ? indentMatch[1].length : 0;
        if (rawValue.trimEnd().endsWith(':')) {
          indent += 4;
        } else if (/^\s*(return|pass|break|continue|raise)\b/.test(rawValue)) {
          indent = Math.max(0, indent - 4);
        }
        this.inputEl.value = ' '.repeat(indent);
        this.render();
        this.focus();
        this.syncGhost();
        return;
      }

      // Single-line or start of new multi-line block
      const trimmed = rawValue.trim();
      if (isOpenBlock(rawValue)) {
        this.lines.push({ kind: 'cmd', text: `>>> ${rawValue}` });
        this.multilineBuffer.push(rawValue);
        this.promptEl.textContent = '... ';
        const indentMatch = rawValue.match(/^(\s*)/);
        const indent = (indentMatch ? indentMatch[1].length : 0) + (rawValue.trimEnd().endsWith(':') ? 4 : 4);
        this.inputEl.value = ' '.repeat(indent);
        this.render();
        this.focus();
        this.syncGhost();
        return;
      }

      if (trimmed) {
        this.recordHistory(trimmed);
        this.onSubmit(rawValue);
      }
      this.focus();
      this.syncGhost();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.history.length) return;
      if (this.historyIdx === this.history.length) this.draft = this.inputEl.value;
      this.historyIdx = Math.max(0, this.historyIdx - 1);
      this.inputEl.value = this.history[this.historyIdx] ?? '';
      this.wordCycle = [];
      this.syncGhost();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!this.history.length) return;
      this.historyIdx = Math.min(this.history.length, this.historyIdx + 1);
      this.inputEl.value =
        this.historyIdx >= this.history.length ? this.draft : (this.history[this.historyIdx] ?? '');
      this.wordCycle = [];
      this.syncGhost();
    }
  }

  /** Alt+- inserts a spaced ` = ` (Python assignment). */
  private insertAssignment(): void {
    const start = this.inputEl.selectionStart ?? this.inputEl.value.length;
    const end = this.inputEl.selectionEnd ?? start;
    const val = this.inputEl.value;
    const before = val.substring(0, start);
    const after = val.substring(end);
    const hasLeadingSpace = before.endsWith(' ') || before.endsWith('\n');
    const hasTrailingSpace = after.startsWith(' ') || after.startsWith('\n');
    let insertion = '=';
    if (!hasLeadingSpace && before.length > 0) insertion = ' ' + insertion;
    if (!hasTrailingSpace) insertion = insertion + ' ';

    let ok = false;
    try {
      ok = document.execCommand('insertText', false, insertion);
    } catch {
      ok = false;
    }
    if (!ok) {
      this.inputEl.value = before + insertion + after;
      const newPos = start + insertion.length;
      this.inputEl.setSelectionRange(newPos, newPos);
    }
  }
}
