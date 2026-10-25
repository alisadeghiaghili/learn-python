"""
Pyodide & CPython CLI Execution Bridge for learn-python.

Executes Python code in an isolated session, captures standard output and exceptions,
and serializes the resulting memory state via `introspect.py`.
"""

import sys
import io
import json
import traceback
from pathlib import Path

# Ensure directory is on sys.path
sys.path.insert(0, str(Path(__file__).parent))
from introspect import serialize_runtime

def execute(source: str) -> str:
    namespace = {'__name__': '__main__'}
    old_stdout = sys.stdout
    buf = io.StringIO()
    sys.stdout = buf
    errors = []

    try:
        exec(source, namespace)
    except Exception:
        errors.append(traceback.format_exc())
    finally:
        sys.stdout = old_stdout

    stdout_lines = buf.getvalue().splitlines(keepends=True)
    return serialize_runtime(namespace, stdout_lines, errors)

if __name__ == '__main__':
    source_code = sys.stdin.read()
    print(execute(source_code))
