/**
 * Simulator runner for differential testing.
 *
 * Runs Python source code through learn-python's simulated Python runtime
 * via the public session API and captures stdout and exception types.
 */

import { createSession } from '../../src/engine/session';

export interface SimulatorResult {
  stdout: string;
  exceptionType: string | null;
  rawError?: Error;
}

/**
 * Extract an exception type name from a simulator error message.
 *
 * @param message - Error message string from the simulator.
 * @returns The exception class name or null.
 */
export function parseSimulatorException(message: string): string | null {
  if (!message) return null;
  const match = message.match(/^([a-zA-Z_][a-zA-Z0-9_]*(?:Error|Exception)):/);
  if (match) {
    return match[1];
  }
  const wordMatch = message.match(/\b([a-zA-Z_][a-zA-Z0-9_]*(?:Error|Exception))\b/);
  return wordMatch ? wordMatch[1] : null;
}

/**
 * Execute Python source code through the simulator runtime.
 *
 * @param source - Python source code string.
 * @returns Execution result with normalized stdout and parsed exception type.
 */
export function runSimulator(source: string): SimulatorResult {
  const session = createSession();
  let exceptionType: string | null = null;
  let rawError: Error | undefined;

  try {
    session.run(source);
  } catch (err: unknown) {
    rawError = err instanceof Error ? err : new Error(String(err));
    exceptionType = parseSimulatorException(rawError.message);
  }

  const stdout = session.state.stdout.length > 0
    ? session.state.stdout.join('\n') + '\n'
    : '';

  if (!exceptionType && session.state.errors && session.state.errors.length > 0) {
    exceptionType = parseSimulatorException(session.state.errors[0]);
  }

  return {
    stdout,
    exceptionType,
    rawError,
  };
}
