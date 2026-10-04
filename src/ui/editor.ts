/**
 * Collapsible multi-line Python script drawer (ported from learn-r).
 * Alt+- inserts ` = `.
 */

export class ScriptEditorView {
  private root: HTMLElement;
  private textarea!: HTMLTextAreaElement;
  private onRun: (code: string) => void;
  private isExpanded = false;

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

  private getCodeToRun(mode: 'line' | 'all' = 'line'): string {
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
        <div class="editor-bar-actions">
          <button type="button" class="btn btn-sm primary" id="editor-run-btn" title="Run current line or selection (Ctrl+Enter)">
            <span>Run</span>
            <span class="kbd-badge">Ctrl+↵</span>
          </button>
          <button type="button" class="btn btn-sm ghost" id="editor-run-all-btn" title="Run entire script (Ctrl+Shift+Enter)">
            Run all
          </button>
          <button type="button" class="btn btn-sm ghost" id="editor-toggle-btn">
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
          placeholder="# Write Python code here. Press Run (Ctrl+Enter) to execute the line/selection."
          rows="6"
        ></textarea>
      </div>
    `;

    this.textarea = this.root.querySelector('#editor-textarea')!;
    const runBtn = this.root.querySelector('#editor-run-btn')!;
    const runAllBtn = this.root.querySelector('#editor-run-all-btn')!;
    const toggleBtn = this.root.querySelector('#editor-toggle-btn')!;

    runBtn.addEventListener('click', () => {
      const code = this.getCodeToRun('line');
      if (code) this.onRun(code);
    });

    runAllBtn.addEventListener('click', () => {
      const code = this.getCodeToRun('all');
      if (code) this.onRun(code);
    });

    toggleBtn.addEventListener('click', () => {
      this.toggle(false);
    });

    this.textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        const code = this.getCodeToRun('all');
        if (code) this.onRun(code);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const code = this.getCodeToRun('line');
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
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        this.textarea.value = this.textarea.value.substring(0, start) + '  ' + this.textarea.value.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
      }
    });
  }
}
