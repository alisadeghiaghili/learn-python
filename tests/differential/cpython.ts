/**
 * CPython execution helper for differential correctness testing.
 * Runs code against real CPython >= 3.12 via child_process.
 */

import { spawnSync } from 'child_process';

export interface PythonExecutable {
  command: string;
  args: string[];
  version: string;
}

export interface ExecutionResult {
  stdout: string;
  errorType: string | null;
  rawError?: string;
}

let cachedPython: PythonExecutable | null | undefined = undefined;

/**
 * Locate a CPython >= 3.12 binary on the system.
 * Throws in CI if absent; returns null locally if absent.
 */
export function findPython(): PythonExecutable | null {
  if (cachedPython !== undefined) {
    return cachedPython;
  }

  const candidates: Array<{ command: string; args: string[] }> = [];

  if (process.env.PYTHON_BIN) {
    candidates.push({ command: process.env.PYTHON_BIN, args: [] });
  }

  if (process.platform === 'win32') {
    candidates.push({ command: 'py', args: ['-3'] });
    candidates.push({ command: 'python', args: [] });
    candidates.push({ command: 'python3', args: [] });
  } else {
    candidates.push({ command: 'python3', args: [] });
    candidates.push({ command: 'python', args: [] });
  }

  for (const c of candidates) {
    try {
      const probe = spawnSync(
        c.command,
        [...c.args, '-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}\\n{sys.executable}")'],
        { encoding: 'utf-8', timeout: 5000 }
      );
      if (probe.status === 0 && probe.stdout) {
        const lines = probe.stdout.trim().split('\n');
        const verStr = lines[0]?.trim() || '';
        const exePath = lines[1]?.trim() || c.command;
        const [majorStr, minorStr] = verStr.split('.');
        const major = parseInt(majorStr, 10);
        const minor = parseInt(minorStr, 10);
        if (major === 3 && minor >= 12) {
          cachedPython = { command: exePath, args: [], version: verStr };
          return cachedPython;
        }
      }
    } catch {
      // Continue searching
    }
  }

  if (process.env.CI) {
    throw new Error('CPython >= 3.12 is required in CI environment but could not be located.');
  }

  cachedPython = null;
  return null;
}

const HARNESS_SCRIPT = `
import sys

code = sys.stdin.read()
try:
    compiled = compile(code, "<probe>", "exec")
    exec(compiled, {})
except BaseException as e:
    sys.stderr.write(f"\\n__DIFF_EXC__:{type(e).__name__}\\n")
    sys.exit(1)
`;

/**
 * Run Python source code through real CPython.
 *
 * @param source Python code string to execute
 * @returns Standard output (normalized to \\n) and exception type (if raised)
 */
export function runPython(source: string): ExecutionResult {
  const py = findPython();
  if (!py) {
    throw new Error('CPython >= 3.12 is not available on this machine.');
  }

  const res = spawnSync(py.command, [...py.args, '-c', HARNESS_SCRIPT], {
    input: source,
    encoding: 'utf-8',
    timeout: 10000,
  });

  const stdout = (res.stdout || '').replace(/\r\n/g, '\n');
  const stderr = (res.stderr || '').replace(/\r\n/g, '\n');

  if (res.status === 0) {
    return { stdout, errorType: null };
  }

  const excMatch = stderr.match(/__DIFF_EXC__:([A-Za-z0-9_]+)/);
  if (excMatch) {
    return { stdout, errorType: excMatch[1], rawError: stderr };
  }

  // Fallback: extract exception type from last line of traceback
  const lines = stderr.trim().split('\n');
  const lastLine = lines[lines.length - 1] || '';
  const fallbackMatch = lastLine.match(/^([A-Za-z0-9_]+Error|[A-Za-z0-9_]+Exception|StopIteration)/);
  const errorType = fallbackMatch ? fallbackMatch[1] : 'Error';

  return { stdout, errorType, rawError: stderr };
}
