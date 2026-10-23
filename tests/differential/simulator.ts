/**
 * Simulator execution helper for differential correctness testing.
 * Runs code through the TypeScript engine's public session API.
 */

import { createSession } from '../../src/engine/session';
import type { ExecutionResult } from './cpython';

/**
 * Run Python source code through the TypeScript simulator.
 *
 * @param source Python code string to execute
 * @returns Standard output (joined lines with trailing newline) and exception type (if raised)
 */
export function runSimulator(source: string): ExecutionResult {
  const session = createSession();
  try {
    const state = session.run(source);
    const stdout = state.stdout.length > 0 ? state.stdout.join('\n') + '\n' : '';
    return {
      stdout,
      errorType: null,
    };
  } catch (err: unknown) {
    const rawError = err instanceof Error ? err.message : String(err);
    const match = rawError.match(/(?:^|\b)([A-Z][a-zA-Z]*(?:Error|Exception|Warning)|StopIteration)\b/);
    const errorType = match ? match[1] : 'Error';
    return {
      stdout: '',
      errorType,
      rawError,
    };
  }
}
