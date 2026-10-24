/**
 * CPython runner for differential testing.
 *
 * Locates a real CPython >= 3.12 interpreter on the machine or in the workspace tools,
 * runs Python code via stdin, and captures stdout and exception types.
 */

import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface PythonResult {
  stdout: string;
  stderr: string;
  exceptionType: string | null;
  exitCode: number;
}

interface PythonCommand {
  bin: string;
  args: string[];
}

let cachedCommand: PythonCommand | null | undefined = undefined;

/**
 * Locate a CPython >= 3.12 binary on the system.
 *
 * @returns The command and arguments to invoke CPython, or null if not found.
 * @throws {Error} If running in CI and no matching CPython binary is found.
 */
export function locateCPython(): PythonCommand | null {
  if (cachedCommand !== undefined) {
    return cachedCommand;
  }

  const candidates: Array<{ bin: string; args: string[] }> = [];

  if (process.env.PYTHON_BIN) {
    candidates.push({ bin: process.env.PYTHON_BIN, args: [] });
  }

  // Local tools directory if present
  const localToolsPy = path.resolve(__dirname, '../../.tools/python/python.exe');
  if (fs.existsSync(localToolsPy)) {
    candidates.push({ bin: localToolsPy, args: [] });
  }

  // Standard Windows and Unix candidates
  if (process.platform === 'win32') {
    candidates.push({ bin: 'py', args: ['-3'] });
    candidates.push({ bin: 'python', args: [] });
    candidates.push({ bin: 'python3', args: [] });
  } else {
    candidates.push({ bin: 'python3', args: [] });
    candidates.push({ bin: 'python', args: [] });
  }

  for (const cand of candidates) {
    try {
      const probe = spawnSync(cand.bin, [...cand.args, '-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'], {
        encoding: 'utf-8',
        timeout: 4000,
      });
      if (probe.status === 0 && probe.stdout) {
        const [major, minor] = probe.stdout.trim().split('.').map(Number);
        if (major === 3 && minor >= 12) {
          cachedCommand = cand;
          return cachedCommand;
        }
      }
    } catch {
      // Continue searching next candidate
    }
  }

  if (process.env.CI) {
    throw new Error('CPython >= 3.12 is required in CI for differential testing, but none was found.');
  }

  cachedCommand = null;
  return null;
}

/**
 * Extract the exception type name from Python traceback stderr.
 *
 * @param stderr - Standard error output from CPython.
 * @returns The exception class name (e.g. 'TypeError', 'SyntaxError') or null.
 */
export function parsePythonException(stderr: string): string | null {
  if (!stderr) return null;
  const lines = stderr.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*(?:Error|Exception)):/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Execute Python source code through real CPython.
 *
 * @param source - Python source code string.
 * @returns Execution result with normalized stdout and parsed exception type.
 * @throws {Error} If CPython is not found.
 */
export function runCPython(source: string): PythonResult {
  const py = locateCPython();
  if (!py) {
    throw new Error('CPython >= 3.12 is not available.');
  }

  const proc = spawnSync(py.bin, [...py.args, '-'], {
    input: source,
    encoding: 'utf-8',
    timeout: 10000,
  });

  const stdout = (proc.stdout || '').replace(/\r\n/g, '\n');
  const stderr = (proc.stderr || '').replace(/\r\n/g, '\n');
  const exceptionType = proc.status === 0 ? null : parsePythonException(stderr);

  return {
    stdout,
    stderr,
    exceptionType,
    exitCode: proc.status ?? (proc.signal ? 1 : 0),
  };
}

/**
 * Execute multiple Python snippets in a single batch CPython process.
 *
 * Avoids per-test process spawn overhead while keeping clean global isolation.
 *
 * @param items - Array of id and source code pairs.
 * @returns Map of id to PythonResult.
 */
export function runBatchCPython(items: Array<{ id: string; source: string }>): Record<string, PythonResult> {
  const py = locateCPython();
  if (!py) {
    throw new Error('CPython >= 3.12 is not available.');
  }

  const runnerScript = `
import sys, io, json

input_data = json.loads(sys.stdin.read())
results = {}

for item in input_data:
    level_id = item['id']
    code = item['source']
    buf_out = io.StringIO()
    buf_err = io.StringIO()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = buf_out, buf_err
    err_type = None
    try:
        compiled = compile(code, f"<{level_id}>", "exec")
        globs = {"__name__": "__main__"}
        exec(compiled, globs)
    except BaseException as e:
        err_type = type(e).__name__
    finally:
        sys.stdout, sys.stderr = old_out, old_err

    results[level_id] = {
        "stdout": buf_out.getvalue().replace("\\r\\n", "\\n"),
        "stderr": buf_err.getvalue().replace("\\r\\n", "\\n"),
        "exceptionType": err_type,
        "exitCode": 0 if err_type is None else 1,
    }

print(json.dumps(results))
`;

  const proc = spawnSync(py.bin, [...py.args, '-c', runnerScript], {
    input: JSON.stringify(items),
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000,
  });

  if (proc.status !== 0) {
    throw new Error(`Batch CPython execution failed: ${proc.stderr}`);
  }

  return JSON.parse(proc.stdout) as Record<string, PythonResult>;
}
