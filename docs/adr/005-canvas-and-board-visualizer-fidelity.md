# learn-python — ADR 005: Canvas, Heap, and RAM Board Fidelity

## Status

Accepted

## Context

The initial memory visualizer omitted scalar values inside stack frames, hid all scalars from the heap without an option to make Python's object model visible, labeled reference counts with the ambiguous and misleading `REFC` header, lacked stepping controls (scrubber slider, autoplay, speed control), did not highlight executing lines in the script editor during trace replay, trapped keyboard navigation in the terminal via unconditional Tab interception, and lacked accessible alternatives for screen-reader users.

## Decision

1. **Scalar Value Display and Heap Toggle**:
   - By default, display scalar values directly alongside variable names inside the stack frame (e.g. `x = 3 (int)`).
   - Provide a toggle in the UI: "Show every object on the heap" (and subtle chip `${N} scalars drawn inline · [show on heap]`).
   - When enabled, allocate visual heap boxes for all scalars. Integers in CPython's small-int cache range ($[-5, 256]$) map to canonical shared heap boxes (`scalar_int_N`), causing aliased names (`a = 100`, `b = 100`) to draw reference edges to the exact same heap box, visually proving interning.

2. **Truthful Reference Counting in RAM View**:
   - Compute reference counts from the live reference graph, including frame root bindings, container elements, and function closure cells.
   - Update the column header to `REFS` and add full descriptive tooltips and accessible labels: `"References from program: N"`.

3. **Stepper Scrubber and Autoplay**:
   - Connect recorded execution traces to a scrubber range slider, allowing non-destructive scrubbing back and forth through execution history.
   - Implement autoplay playback with play/pause toggling and variable speed multipliers ($0.5\times$, $1\times$, $2\times$).
   - Record `currentLine` on memory states to visually highlight executing lines in the script editor drawer during trace replay.

4. **Accessibility and Responsive Layout**:
   - Provide a hidden, live-updated text alternative (`#board-text-alt`) summarizing call stack frames, local variables, and heap objects.
   - Announce step changes to assistive technologies via an `aria-live="polite"` live region (`#board-live-region`).
   - Eliminate keyboard traps in the console REPL: allow `Shift+Tab` to navigate backward out of the input, and allow `Escape` to disarm word cycling and let `Tab` navigate forward.
   - Set responsive min-widths on SVGs and enforce `min-height: 200px` on `.board-wrap` to prevent layout collapse at $200\%$ zoom and viewports down to $360\text{ px}$.

## Consequences

- The memory model faithfully conveys Python's object identity for both scalars and containers.
- Teachers and learners can visually demonstrate integer caching and object mutability.
- Stepping through programs and loops is smooth, accessible, and responsive across all devices and zoom levels.
