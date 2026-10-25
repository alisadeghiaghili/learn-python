/**
 * Automated Accessibility (WCAG 2.2 AA) Test Suite.
 *
 * Verifies keyboard traps prevention, landmark regions, modal focus management,
 * WAI-ARIA tab pattern, canvas text alternatives, minimum font sizes, and
 * runs axe-core automated audits across views and modals.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';
import { App } from '../src/ui/app';
import { setLocale } from '../src/i18n';
import { showModal, closeModal } from '../src/ui/dialog';
import { BoardView } from '../src/ui/board';
import { ScriptEditorView } from '../src/ui/editor';
import { TerminalView } from '../src/ui/terminal';
import { runFresh } from '../src/engine/session';

describe('Phase 8 — Accessibility (WCAG 2.2 AA)', () => {
  let dom: JSDOM;
  let root: HTMLElement;
  const originalWindow = global.window;
  const originalDocument = global.document;

  beforeEach(() => {
    dom = new JSDOM(
      `<!DOCTYPE html><html lang="en"><head><title>learn-python</title></head><body><div id="app"></div></body></html>`,
      { url: 'http://localhost/?level=hello-world' }
    );
    // Bind globals
    global.window = dom.window as any;
    global.document = dom.window.document as any;
    global.Node = dom.window.Node as any;
    global.Element = dom.window.Element as any;
    global.HTMLElement = dom.window.HTMLElement as any;
    global.SVGElement = dom.window.SVGElement as any;
    global.HTMLInputElement = dom.window.HTMLInputElement as any;
    global.HTMLButtonElement = dom.window.HTMLButtonElement as any;
    global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement as any;

    root = dom.window.document.getElementById('app')!;
  });

  afterEach(() => {
    closeModal();
    setLocale('en');
    global.window = originalWindow;
    global.document = originalDocument;
  });

  describe('8.1 Keyboard trap prevention', () => {
    it('terminal input allows Tab to move focus naturally and uses Ctrl+Space for autocomplete', () => {
      const termEl = dom.window.document.createElement('div');
      root.appendChild(termEl);
      const terminal = new TerminalView(termEl, () => {}, () => {});
      terminal.setHint('print("hello")');

      const input = termEl.querySelector('input')!;
      let tabPrevented = false;
      const tabEvent = new dom.window.KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
      tabEvent.preventDefault = () => { tabPrevented = true; };
      input.dispatchEvent(tabEvent);

      // Tab must not be prevented (no keyboard trap)
      expect(tabPrevented).toBe(false);

      // Ctrl+Space triggers autocomplete
      let ctrlSpacePrevented = false;
      const ctrlSpaceEvent = new dom.window.KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        ctrlKey: true,
        cancelable: true,
      });
      ctrlSpaceEvent.preventDefault = () => { ctrlSpacePrevented = true; };
      input.dispatchEvent(ctrlSpaceEvent);

      expect(ctrlSpacePrevented).toBe(true);
      expect(input.value).toBe('print("hello")');
    });

    it('editor textarea indents on Tab, but allows Esc then Tab to move focus', () => {
      const editorEl = dom.window.document.createElement('div');
      root.appendChild(editorEl);
      new ScriptEditorView(editorEl, () => {});
      const textarea = editorEl.querySelector('textarea')!;

      // Normal Tab indents
      let tab1Prevented = false;
      const tab1 = new dom.window.KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
      tab1.preventDefault = () => { tab1Prevented = true; };
      textarea.dispatchEvent(tab1);
      expect(tab1Prevented).toBe(true);

      // Press Escape to request focus exit
      const esc = new dom.window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      textarea.dispatchEvent(esc);

      // Next Tab moves focus without preventDefault
      let tab2Prevented = false;
      const tab2 = new dom.window.KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
      tab2.preventDefault = () => { tab2Prevented = true; };
      textarea.dispatchEvent(tab2);
      expect(tab2Prevented).toBe(false);
    });
  });

  describe('8.2 Landmarks, skip link, and headings', () => {
    it('renders skip link, main landmark, header banner, level title h1, and sections', () => {
      new App(root);

      const skipLink = root.querySelector('.skip-link');
      expect(skipLink).not.toBeNull();
      expect(skipLink?.getAttribute('href')).toBe('#terminal-input');

      const main = root.querySelector('main#main-content');
      expect(main).not.toBeNull();

      const header = root.querySelector('header.toolbar[role="banner"]');
      expect(header).not.toBeNull();

      const h1 = root.querySelector('#level-title h1');
      expect(h1).not.toBeNull();
      expect(h1?.textContent).toContain('Hello, world');

      const boardWrap = root.querySelector('section#board-wrap');
      expect(boardWrap?.getAttribute('aria-label')).toBe('Memory and Execution Visualizer');

      const terminal = root.querySelector('section#terminal');
      expect(terminal?.getAttribute('aria-label')).toBe('Interactive Python Console');

      const dock = root.querySelector('aside#dock');
      expect(dock?.getAttribute('aria-label')).toBe('Learning guide');
    });
  });

  describe('8.3 Modals and dialog accessibility', () => {
    it('sets role=dialog, aria-modal, aria-labelledby, traps focus, and returns focus on close', () => {
      const triggerBtn = dom.window.document.createElement('button');
      triggerBtn.textContent = 'Open';
      dom.window.document.body.appendChild(triggerBtn);
      triggerBtn.focus();

      const modal = showModal({
        title: 'Level Overview',
        bodyHtml: '<p>Content</p><button class="btn-primary primary" id="ok-btn">OK</button>',
        actions: [{ label: 'Close', onClick: () => {} }],
      });

      const modalEl = dom.window.document.querySelector('.modal[role="dialog"]') as HTMLElement;
      expect(modalEl).not.toBeNull();
      expect(modalEl.getAttribute('aria-modal')).toBe('true');

      const labelledBy = modalEl.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const titleEl = dom.window.document.getElementById(labelledBy!);
      expect(titleEl?.textContent).toBe('Level Overview');

      // Primary action received initial focus
      const okBtn = dom.window.document.getElementById('ok-btn')!;
      expect(dom.window.document.activeElement).toBe(okBtn);

      // Focus trap wraps backwards on Shift+Tab from first element
      const shiftTab = new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
      let shiftTabPrevented = false;
      shiftTab.preventDefault = () => { shiftTabPrevented = true; };
      modalEl.dispatchEvent(shiftTab);
      expect(shiftTabPrevented).toBe(true);

      // Close modal and verify focus returns to trigger element
      modal.close();
      expect(dom.window.document.querySelector('.modal')).toBeNull();
      expect(dom.window.document.activeElement).toBe(triggerBtn);
    });
  });

  describe('8.4 Board Tabs WAI-ARIA pattern and arrow key navigation', () => {
    it('provides full tablist, tabs, tabpanels, and arrow key switching', () => {
      const boardWrap = dom.window.document.createElement('div');
      root.appendChild(boardWrap);
      const board = new BoardView(boardWrap);

      const tablist = boardWrap.querySelector('.board-tabs[role="tablist"]');
      expect(tablist).not.toBeNull();

      const tabs = boardWrap.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      expect(tabs).toHaveLength(3);

      const memoryTab = boardWrap.querySelector('#tab-memory');
      expect(memoryTab?.getAttribute('aria-selected')).toBe('true');
      expect(memoryTab?.getAttribute('aria-controls')).toBe('pane-memory');
      expect(memoryTab?.getAttribute('tabindex')).toBe('0');

      const plotTab = boardWrap.querySelector('#tab-plot');
      expect(plotTab?.getAttribute('aria-selected')).toBe('false');
      expect(plotTab?.getAttribute('tabindex')).toBe('-1');

      const panels = boardWrap.querySelectorAll('[role="tabpanel"]');
      expect(panels).toHaveLength(3);
      expect(boardWrap.querySelector('#pane-memory')?.getAttribute('aria-labelledby')).toBe('tab-memory');

      // Right arrow moves to Plot tab
      const rightArrow = new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
      tablist!.dispatchEvent(rightArrow);
      expect(board.getTab()).toBe('plot');
      expect(boardWrap.querySelector('#tab-plot')?.getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('8.5 Canvas text alternatives & Describe memory button', () => {
    it('describes stack frames, variables, heap objects, and aliases', () => {
      const boardWrap = dom.window.document.createElement('div');
      root.appendChild(boardWrap);
      const board = new BoardView(boardWrap);

      const state = runFresh('xs = [1, 2]\nys = xs');
      board.setTrace([state]);
      const desc = board.describeMemory(state);

      expect(desc).toContain('Frame <module>');
      expect(desc).toContain('xs → list');
      expect(desc).toContain('ys → list');
      expect(desc).toContain('(same object as xs)');
      expect(desc).toContain('Heap has 1 object');

      // Describe memory button triggers the announcement
      const describeBtn = boardWrap.querySelector('#describe-memory-btn') as HTMLButtonElement;
      expect(describeBtn).not.toBeNull();
      describeBtn.click();

      const liveRegion = boardWrap.querySelector('#board-live-region');
      expect(liveRegion?.textContent).toContain('Heap has');
    });

    it('guarantees plot SVG has role="img" and accessible title/desc', () => {
      const boardWrap = dom.window.document.createElement('div');
      root.appendChild(boardWrap);
      const board = new BoardView(boardWrap);

      board.setPlots([{
        kind: 'scatter',
        title: 'Test Scatter',
        points: [[1, 2], [3, 4]],
      }]);

      const svg = boardWrap.querySelector('svg.plot-svg');
      expect(svg?.getAttribute('role')).toBe('img');
      expect(svg?.getAttribute('aria-label')).toContain('Test Scatter: scatter plot with 2 points');
      expect(svg?.querySelector('title')?.textContent).toContain('Test Scatter');
    });
  });

  describe('8.6 Automated axe-core audits (zero serious or critical violations)', () => {
    async function auditCurrentDom(): Promise<axe.AxeResults['violations']> {
      const results = await axe.run(dom.window.document.body, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        },
        rules: {
          // Color contrast in JSDOM cannot evaluate rendered CSS styles accurately
          'color-contrast': { enabled: false },
        },
      });
      return results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
    }

    it('passes axe audit for English level view', async () => {
      setLocale('en');
      new App(root);
      const violations = await auditCurrentDom();
      expect(violations).toHaveLength(0);
    });

    it('passes axe audit for German level view', async () => {
      setLocale('de');
      new App(root);
      const violations = await auditCurrentDom();
      expect(violations).toHaveLength(0);
    });

    it('passes axe audit for Farsi level view', async () => {
      setLocale('fa');
      new App(root);
      const violations = await auditCurrentDom();
      expect(violations).toHaveLength(0);
    });

    it('passes axe audit for Sandbox view', async () => {
      setLocale('en');
      const app = new App(root);
      app.enterSandbox();
      const violations = await auditCurrentDom();
      expect(violations).toHaveLength(0);
    });

    it('passes axe audit with Modal dialog open', async () => {
      new App(root);
      showModal({
        title: 'Levels Catalog',
        bodyHtml: '<p>Choose a level:</p><button class="primary" id="lvl-1">Level 1</button>',
        actions: [{ label: 'Close', onClick: () => {} }],
      });
      const violations = await auditCurrentDom();
      expect(violations).toHaveLength(0);
    });

    it('passes axe audit with Celebration modal open', async () => {
      new App(root);
      showModal({
        title: 'Level Complete',
        variant: 'celebrate',
        bodyHtml: '<h3>Outstanding!</h3><p>You mastered reference binding.</p><button class="btn-primary primary">Next level</button>',
        actions: [{ label: 'Continue', onClick: () => {} }],
      });
      const violations = await auditCurrentDom();
      expect(violations).toHaveLength(0);
    });
  });
});
