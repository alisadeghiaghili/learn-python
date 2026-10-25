/**
 * CPython execution helper for differential correctness testing.
 * Runs code against real CPython >= 3.12 via child_process.
 */

import { spawn, spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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

  const localToolsPy = path.resolve(__dirname, '../../.tools/python/python.exe');
  if (fs.existsSync(localToolsPy)) {
    candidates.push({ command: localToolsPy, args: [] });
  }

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

try:
    import asyncio
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    asyncio.create_task = _loop.create_task

    def _poly_run(*args, **kwargs):
        async def _runner():
            tasks = []
            for a in args:
                if asyncio.iscoroutine(a):
                    tasks.append(_loop.create_task(a))
                else:
                    tasks.append(a)
            if len(tasks) == 1:
                return await tasks[0]
            if len(tasks) > 1:
                return await asyncio.gather(*tasks)
            return None
        return _loop.run_until_complete(_runner())

    asyncio.run = _poly_run
except Exception:
    pass

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
export function runPython(source: string): Promise<ExecutionResult> {
  const py = findPython();
  if (!py) {
    return Promise.reject(new Error('CPython >= 3.12 is not available on this machine.'));
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(py.command, [...py.args, '-c', HARNESS_SCRIPT], {
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', MPLBACKEND: 'Agg' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.setEncoding('utf-8');
    proc.stderr.setEncoding('utf-8');

    proc.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('Execution timed out after 60 seconds'));
    }, 60000);

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      const normalizedStdout = stdout.replace(/\r\n/g, '\n');
      const normalizedStderr = stderr.replace(/\r\n/g, '\n');

      if (code === 0) {
        resolve({ stdout: normalizedStdout, errorType: null });
        return;
      }

      const excMatch = normalizedStderr.match(/__DIFF_EXC__:([A-Za-z0-9_]+)/);
      if (excMatch) {
        resolve({ stdout: normalizedStdout, errorType: excMatch[1] ?? 'Error', rawError: normalizedStderr });
        return;
      }

      const lines = normalizedStderr.trim().split('\n');
      const lastLine = lines[lines.length - 1] || '';
      const fallbackMatch = lastLine.match(/^([A-Za-z0-9_]+Error|[A-Za-z0-9_]+Exception|StopIteration)/);
      const errorType = fallbackMatch ? fallbackMatch[1] ?? 'Error' : 'Error';

      resolve({ stdout: normalizedStdout, errorType, rawError: normalizedStderr });
    });

    proc.stdin.write(source, 'utf-8');
    proc.stdin.end();
  });
}
