# learn-python — ADR 012: UI/UX Ergonomics and Visualizer Depth

## Status

Accepted

## Context

A learning visualizer must offer frictionless navigation, responsive layout across desktop and mobile, full accessibility without keyboard traps, and visual depth hierarchy. Prior to this phase:
1. The terminal console lacked multi-line compound statement buffering, lacked paste execution, and pushed duplicated commands to history.
2. The script editor trapped keyboard focus (pressing `Tab` inserted spaces with no keyboard exit path), lacked per-level code persistence, and reversed the primary action ("Run line" instead of "Run all").
3. In the memory SVG canvas, edges were drawn over the top of stack and heap cards, Task and Thread cards crowded titles and statuses onto a single row causing text overprinting, and large containers caused unbounded card heights.
4. Navigation between levels was restricted to modal dialogs; terminal `level` meta-command rejected level numbers (e.g., `level 73`), and there was no search filter or active exercise auto-scroll in the catalog.
5. The application lacked a light theme for bright environments and had inconsistent touch targets on mobile devices.

## Decision

1. **Terminal Console Enhancements**:
   - Implemented multi-line block buffering: lines ending in `:` or unclosed brackets trigger continuation prompts (`... `) and automatic indentation.
   - Blank lines in continuation mode terminate and execute the compound statement block.
   - Supported multi-line paste execution and deduplicated command history navigation (`ArrowUp`/`ArrowDown`).
   - Allowed `Escape` to cancel multi-line buffering cleanly.

2. **Editor Ergonomics and Keyboard Navigation**:
   - Reordered action hierarchy: **Run all** is primary (`Ctrl+Enter`), and **Run line** is secondary (`Ctrl+Shift+Enter`).
   - Eliminated keyboard traps by allowing `Escape` followed by `Tab` to cycle focus out of the textarea.
   - Added persistent level code storage in `localStorage` keyed by level ID.

3. **Memory and RAM Canvas Depth & Clarity**:
   - Separated SVG render layers into `<g class="edges-layer">` and `<g class="nodes-layer">`, ensuring amber reference lines route underneath cards.
   - Redesigned asynchronous and concurrency cards (Tasks, Threads, Coroutines, EventLoop) into structured 2-row layouts (title at $y+26$, status at $y+44$, height 58).
   - Added container folding for collections exceeding 12 items (`[... N items collapsed ...]`).
   - Added wheel zoom, drag pan, and a "Fit to view" button (`Fit`, `+`, `−`).

4. **Stepping and Level Navigation**:
   - Added stepper transport keyboard shortcuts (`ArrowLeft`/`ArrowRight`, `Home`/`End`, `Space`).
   - Added toolbar level navigation buttons (`◀`/`▶`) with disabled boundaries and keyboard navigation.
   - Added support for level numbers in the terminal (`level 1` through `level 78`).
   - Added instant search filtering and active level auto-scroll in the exercises modal.

5. **Theming, Mobile, and Touch Ergonomics**:
   - Added a persistent light theme toggle with design tokens adhering to system `prefers-color-scheme`.
   - Transformed the editor drawer on mobile screens ($\le 768\text{px}$) into a bottom sheet overlay.
   - Enforced WCAG 2.2 touch target minimums ($\ge 44 \times 44\text{px}$) on coarse pointer devices.

## Consequences

- The visualizer offers an ergonomic, accessible, and intuitive workbench for beginners and advanced learners alike.
- Terminal, editor, and visualizer components behave predictably across desktop, tablet, and mobile browsers.
