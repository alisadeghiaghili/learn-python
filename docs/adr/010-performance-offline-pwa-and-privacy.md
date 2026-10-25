# learn-python — ADR 010: Performance Optimization, Offline PWA, and Privacy Architecture

## Status

Accepted

## Context

Phase 9 addressed critical scalability, offline reliability, and privacy concerns:
1. **Per-Run Memory & Cloning Slowdown**: Successive execution runs in the same session experienced quadratic slowdown ($O(N^2)$ growth) because `recordStep()` and session cloning deep-copied the growing `state.trace` array inside the memory state itself, and `undoStack` was unbounded.
2. **Bundle Chunk Size**: The application emitted a single monolithic bundle (>500 kB), triggering bundler chunk size warnings and slowing initial page load.
3. **Web Font External Dependency**: Render-blocking Google Fonts stylesheets caused white-screen delays of up to 8 seconds on filtered, restricted, or offline networks.
4. **Offline Capability**: Learners with intermittent or zero internet connectivity could not use the app reliably.
5. **Visitor Counter Transparency**: The anonymous visitor counter could log console network errors when blocked by content blockers or offline environments.

## Decision

1. **State Clone Isolation & Bounded Undo**:
   - Detached `state.trace` prior to `cloneState()` calls in `recordStep()` and `Session.clone()`, eliminating cumulative quadratic cloning overhead.
   - Bounded `undoStack` in `App` to 20 entries.
   - Added `tests/perf.test.ts` verifying that consecutive loop runs maintain flat execution duration without degradation.
2. **Code Splitting & Dynamic Bundling**:
   - Configured Rollup `manualChunks` in `vite.config.ts` separating `engine`, `levels`, `i18n-de`, and `i18n-fa`.
   - Reduced main bundle size from 575 kB to 302 kB, with all chunks comfortably under 150 kB.
3. **Self-Hosted System Fallbacks & Non-Blocking Typography**:
   - Replaced external Google Fonts CDN links in `index.html` with robust cross-platform font stacks (`IBM Plex Sans`, `IBM Plex Mono`, `Fraunces`, system-ui).
4. **Offline PWA & Service Worker**:
   - Added `public/manifest.json` enabling progressive web app installation.
   - Implemented `public/sw.js` with Cache-First asset caching and offline navigation fallback.
   - Registered service worker in `src/main.ts`.
5. **Privacy and Anonymous Analytics**:
   - Deferred visitor counter initialization to first user interaction.
   - Made network failures fail silently without console errors.
   - Explicitly documented the privacy policy and counter behavior in `README.md`.

## Consequences

- Consecutive runs maintain flat, constant-time performance across loops and undo operations.
- The app installs as an offline PWA and functions completely offline without network connectivity.
- Bundle sizes comply with performance budgets and load instantly across all devices.
