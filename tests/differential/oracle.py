#!/usr/bin/env python3
"""Differential oracle: verify the corpus ground truth against real CPython.

`corpus.json` is shared by the TypeScript simulator (via the vitest suite) and
this oracle. The simulator side asserts the engine's behaviour matches each
case's `expected` field (for `parity` cases). This oracle is the independent
check that `expected` actually IS what CPython does — run each source in a
fresh interpreter and compare.

If this script fails, the ground-truth column in `corpus.json` is wrong, not
the simulator; fix the corpus before trusting the differential suite.

Exit codes: 0 = all cases match CPython, 1 = at least one mismatch.
Requires Python >= 3.12.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile

CORPUS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corpus.json")

# A fixed runner so the try/except is always established around the *source*
# (which is read from a file), letting us capture even SyntaxError. Program
# prints go to stdout; the exception type is reported to stderr with a marker.
_RUNNER = (
    "import sys\n"
    "try:\n"
    "    code = open(sys.argv[1], 'rb').read().decode('utf-8')\n"
    "    exec(compile(code, '<case>', 'exec'))\n"
    "except BaseException as e:\n"
    "    sys.stderr.write('@@EXC@@' + type(e).__name__)\n"
    "    sys.exit(0)\n"
)

_EXC_RE = re.compile(r"@@EXC@@(.+)")


def run_in_cpython(source: str) -> dict:
    """Run one snippet in a fresh interpreter; return {kind, text|excType}."""
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as tmp:
        tmp.write(source)
        path = tmp.name
    try:
        proc = subprocess.run(
            [sys.executable, "-c", _RUNNER, path],
            capture_output=True,
            text=True,
            timeout=10,
        )
    finally:
        os.unlink(path)

    exc = _EXC_RE.search(proc.stderr or "")
    if exc:
        return {"kind": "exc", "excType": exc.group(1).strip()}
    # print() appends one newline per call; strip trailing newlines so the
    # captured stdout matches the `text` field (which has none).
    return {"kind": "ok", "text": (proc.stdout or "").rstrip("\n")}


def to_comparable(result: dict) -> str:
    if result["kind"] == "ok":
        return result["text"] or ""
    return "EXC:" + (result["excType"] or "?")


def main() -> int:
    with open(CORPUS_PATH, encoding="utf-8") as fh:
        cases = json.load(fh)

    print(f"Python {sys.version.split()[0]}  —  {len(cases)} differential cases")
    print("-" * 78)

    failures = 0
    for case in cases:
        actual = run_in_cpython(case["source"])
        expected = case["expected"]
        ok = to_comparable(actual) == to_comparable(expected)
        tag = "ok  " if ok else "FAIL"
        detail = to_comparable(actual)
        if not ok:
            failures += 1
            print(f"[{tag}] {case['id']}: CPython={detail!r}  expected={to_comparable(expected)!r}")
        else:
            print(f"[{tag}] {case['id']}: {detail!r}")

    print("-" * 78)
    if failures:
        print(f"{failures}/{len(cases)} ground-truth mismatches — fix corpus.json")
        return 1
    print(f"all {len(cases)} cases match CPython")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
