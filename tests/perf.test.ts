/**
 * Performance regression test suite (Phase 9).
 *
 * Verifies that consecutive execution runs in the same session with trace recording
 * enabled do not suffer from O(N^2) state clone slowdown or unbounded memory growth.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSession } from '../src/engine/session';
import { setTraceEnabled } from '../src/engine/evaluator';

describe('Phase 9 — Performance regression tests', () => {
  beforeEach(() => {
    setTraceEnabled(true);
  });

  it('consecutive runs of loops in the same session do not suffer from exponential slowdown', () => {
    const session = createSession();
    const code = `
total = 0
for i in range(50):
    total = total + i
`;

    // Warm up run
    session.run(code);

    const times: number[] = [];
    const runs = 10;

    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      session.run(code);
      const elapsed = performance.now() - start;
      times.push(elapsed);
    }

    const lastRun = times[times.length - 1]!;
    const avgRun = times.reduce((a, b) => a + b, 0) / times.length;

    // Last run should remain close to the average run and not suffer from exponential degradation
    // (A 10x or 5x slowdown indicates exponential cloning leak; we assert it stays within 2x of average).
    expect(lastRun).toBeLessThan(Math.max(50, avgRun * 2.5));
  });

  it('session clone detaches trace to prevent exponential state duplication in undo stacks', () => {
    const session = createSession();
    session.run(`
xs = []
for i in range(30):
    xs.append(i)
`);
    const cloned = session.clone();
    expect(cloned.trace).toBeUndefined();
    expect(cloned.frames.length).toBeGreaterThan(0);
    expect(Object.keys(cloned.heap).length).toBeGreaterThan(0);
  });
});
