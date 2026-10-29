/**
 * Collapsible multi-line Python script drawer.
 * Alt+- inserts ` = `.
 * Ctrl+Enter runs the entire script (Run all); Ctrl+Shift+Enter runs current line.
 * Esc followed by Tab navigates out of the textarea without a keyboard trap.
 * Script code is persisted per-level in localStorage.
 */

export class ScriptEditorView {
  private root: HTMLElement;
  private textarea!: HTMLTextAreaElement;
  private onRun: (code: string) => void;
  private isExpanded = false;
  private currentLevelId = 'sandbox';
  private allowTabExit = false;

  constructor(root: HTMLElement, onRun: (code: string) => void) {
    this.root = root;
    this.onRun = onRun;
    this.render();
  }

  getValue(): string {
    return this.textarea.value;
  }

  setValue(val: string): void {
    this.textarea.value = val;
    this.saveCurrentCode();
  }

  setLevel(id: string, defaultCode = ''): void {
    this.saveCurrentCode();
    this.currentLevelId = id;
    try {
      const saved = localStorage.getItem(`learn-python-editor-${id}`);
      this.textarea.value = saved !== null ? saved : defaultCode;
    } catch {
      this.textarea.value = defaultCode;
    }
  }

  private saveCurrentCode(): void {
    if (!this.textarea) return;
    try {
      localStorage.setItem(`learn-python-editor-${this.currentLevelId}`, this.textarea.value);
    } catch {
      /* ignore */
    }
  }

  toggle(expanded?: boolean): void {
    this.isExpanded = expanded !== undefined ? expanded : !this.isExpanded;
    this.root.classList.toggle('is-open', this.isExpanded);
    if (this.isExpanded) {
      this.textarea.focus();
    }
  }

  isOpen(): boolean {
    return this.isExpanded;
  }

  highlightLine(line?: number): void {
    const badge = this.root.querySelector<HTMLElement>('#editor-line-badge');
    if (badge) {
      if (line !== undefined && line > 0) {
        badge.textContent = `▶ Line ${line}`;
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }

    if (line !== undefined && line > 0 && this.textarea) {
      const text = this.textarea.value;
      const lines = text.split('\n');
      if (line <= lines.length) {
        let startPos = 0;
        for (let i = 0; i < line - 1; i++) {
          startPos += (lines[i]?.length ?? 0) + 1;
        }
        const endPos = startPos + (lines[line - 1]?.length ?? 0);
        this.textarea.setSelectionRange(startPos, endPos);
      }
    }
  }

  private getCodeToRun(mode: 'line' | 'all' = 'all'): string {
    const val = this.textarea.value;
    if (!val.trim()) return '';

    if (mode === 'all') {
      return val.trim();
    }

    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;

    if (start !== end) {
      return val.substring(start, end).trim();
    }

    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = val.indexOf('\n', start);
    if (lineEnd === -1) lineEnd = val.length;

    const currentLine = val.substring(lineStart, lineEnd).trim();

    if (lineEnd < val.length) {
      this.textarea.selectionStart = this.textarea.selectionEnd = lineEnd + 1;
    }

    if (currentLine) {
      return currentLine;
    }

    return val.trim();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="editor-bar">
        <span class="editor-title">Python Script</span>
        <span class="editor-line-badge" id="editor-line-badge" hidden></span>
        <div class="editor-bar-actions">
          <button type="button" class="btn btn-sm primary" id="editor-run-all-btn" title="Run entire script (Ctrl+Enter)">
            <span>Run all</span>
            <span class="kbd-badge">Ctrl+↵</span>
          </button>
          <button type="button" class="btn btn-sm ghost" id="editor-run-btn" title="Run current line or selection (Ctrl+Shift+Enter)">
            <span>Run line</span>
            <span class="kbd-badge">⇧Ctrl+↵</span>
          </button>
          <button type="button" class="btn btn-sm ghost" id="editor-toggle-btn" title="Close editor">
            Close
          </button>
        </div>
      </div>
      <div class="editor-textarea-wrap">
        <textarea
          id="editor-textarea"
          class="editor-textarea"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          placeholder="# Write Python code here. Press Run all (Ctrl+Enter) or Run line (Ctrl+Shift+Enter)."
          rows="6"
        ></textarea>
      </div>
    `;

    this.textarea = this.root.querySelector('#editor-textarea')!;
    const runAllBtn = this.root.querySelector('#editor-run-all-btn')!;
    const runLineBtn = this.root.querySelector('#editor-run-btn')!;
    const toggleBtn = this.root.querySelector('#editor-toggle-btn')!;

    runAllBtn.addEventListener('click', () => {
      const code = this.getCodeToRun('all');
      if (code) this.onRun(code);
    });

    runLineBtn.addEventListener('click', () => {
      const code = this.getCodeToRun('line');
      if (code) this.onRun(code);
    });

    toggleBtn.addEventListener('click', () => {
      this.toggle(false);
    });

    this.textarea.addEventListener('input', () => {
      this.saveCurrentCode();
    });

    this.textarea.addEventListener('keydown', (e) => {
      // Ctrl+Shift+Enter runs current line / selection
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        const code = this.getCodeToRun('line');
        if (code) this.onRun(code);
        return;
      }
      // Ctrl+Enter runs entire script (Run all)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const code = this.getCodeToRun('all');
        if (code) this.onRun(code);
        return;
      }
      // Alt + - inserts Python assignment ` = `
      if (e.altKey && (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '–' || e.key === '—')) {
        e.preventDefault();
        const start = this.textarea.selectionStart ?? this.textarea.value.length;
        const end = this.textarea.selectionEnd ?? start;
        const val = this.textarea.value;
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
          this.textarea.value = before + insertion + after;
          const newPos = start + insertion.length;
          this.textarea.selectionStart = this.textarea.selectionEnd = newPos;
        }
        this.saveCurrentCode();
        return;
      }

      if (e.key === 'Escape') {
        this.allowTabExit = true;
        return;
      }

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Allow Shift+Tab to exit backwards naturally
          return;
        }
        if (this.allowTabExit) {
          // Esc was pressed, allow Tab to exit forwards naturally
          this.allowTabExit = false;
          return;
        }
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        this.textarea.value = this.textarea.value.substring(0, start) + '    ' + this.textarea.value.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
        this.saveCurrentCode();
        return;
      }

      this.allowTabExit = false;
    });
  }
}
