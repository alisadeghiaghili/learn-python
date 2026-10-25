# learn-python — ADR 009: Accessibility and WCAG 2.2 AA Compliance

## Status

Accepted

## Context

Prior to Phase 8, the web application exhibited several critical accessibility defects:
1. **Keyboard Traps**:
   - The terminal input swallowed `Tab` and `Shift+Tab` for autocomplete, trapping keyboard users inside the input with no focus escape.
   - The script editor textarea intercepted `Tab` to insert two spaces, trapping focus without an exit mechanism.
2. **Missing Landmarks and Structure**:
   - No skip-to-content link existed for keyboard navigation.
   - The application root lacked a `<main>` landmark, `<header role="banner">`, `<section>` landmarks, and an `<h1>` heading for level and sandbox titles.
3. **Modal Dialogs (WAI-ARIA Dialog Pattern)**:
   - Modals lacked proper `aria-labelledby` referencing their title headings.
   - No focus trap existed while dialogs were open, allowing focus to escape into hidden background content.
   - Initial focus landed on the bottom Close button rather than primary actions.
   - Focus did not return to the invoking element when dialogs were closed.
4. **Board Tabs (WAI-ARIA Tablist Pattern)**:
   - Visualizer board tabs lacked full `role="tab"`, `role="tablist"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, and `tabindex` attributes.
   - Arrow key navigation (`ArrowRight`, `ArrowLeft`, `ArrowUp`, `ArrowDown`, `Home`, `End`) between tabs was missing.
5. **Canvas Visual Representations & Non-Text Contrast**:
   - The memory and RAM canvases were purely visual SVG elements without live text descriptions for screen readers.
   - Badge elements (`.tab-badge`) had insufficient contrast (4.14:1) against background lines.
   - Several SVG canvas text labels had font sizes smaller than 12px.
   - Data plots lacked structured textual data summaries.

## Decision

1. **Eliminate Keyboard Traps**:
   - Updated terminal input to let `Tab` and `Shift+Tab` move focus naturally. Moved autocomplete trigger to `Ctrl+Space` and `ArrowRight`.
   - Updated script editor textarea so pressing `Escape` permits the subsequent `Tab` or `Shift+Tab` to exit focus.
2. **Page Landmarks and Heading Structure**:
   - Added a visible-on-focus `<a href="#terminal-input" class="skip-link">Skip to console</a>`.
   - Structured the shell with `<main id="main-content">`, `<header role="banner">`, `<aside aria-label="Learning guide">`, and `<section>` landmarks for visualizer and terminal.
   - Rendered the active level/sandbox title as an `<h1>` element.
3. **Modal Focus Management**:
   - Assigned unique IDs to modal headings and wired `aria-labelledby` on the modal dialog card.
   - Implemented an internal focus trap cycling focus between focusable elements on Tab and Shift+Tab.
   - Focused the primary action upon opening and restored focus to the invoking trigger upon closing.
4. **WAI-ARIA Tab Pattern**:
   - Implemented `role="tablist"` with `role="tab"` buttons and `role="tabpanel"` panes with `aria-controls` and `aria-labelledby`.
   - Added arrow key listeners to switch active tabs and focus accordingly.
5. **Non-Visual Alternatives and Contrast**:
   - Added a structured memory state summarizer (`describeMemory`) describing active frames, local variables, heap objects, and alias relationships, accompanied by a "Describe memory" button and an `aria-live="polite"` region.
   - Enhanced plot SVGs with `role="img"`, `<title>`, `<desc>`, and comprehensive data summaries in `aria-label`.
   - Enforced `font-size >= 12` in `addText` across all SVG canvas renderings.
   - Fixed contrast on `.tab-badge` by setting high-contrast foreground color (`var(--ink)`), achieving 8.6:1 contrast ratio.
6. **Automated Audits**:
   - Added `tests/accessibility.test.ts` running automated `axe-core` checks across English, German, Farsi, Sandbox, Levels catalog, and Celebration modal views, guaranteeing zero serious or critical WCAG 2.2 AA violations.

## Consequences

- The application is fully operable using only a keyboard without traps.
- Screen reader users receive rich semantic structure, live state updates, and accessible modals.
- All automated accessibility tests pass 100% green with zero serious or critical violations.
