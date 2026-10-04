/**
 * Split Python source into logical statements.
 *
 * Unlike a naive line split, a compound statement header (`def`, `if`, `for`,
 * `while`) plus its indented body is a *single* logical statement — which is
 * what we want for the checklist and terminal completions.
 */
export function splitPythonStatements(code: string): string[] {
  if (!code || !code.trim()) return [];

  const lines = code.split('\n');
  const statements: string[] = [];
  let current: string[] = [];

  const flush = (): void => {
    if (current.length) {
      // Trim leading/trailing blank lines inside a statement.
      while (current.length && !current[0]!.trim()) current.shift();
      while (current.length && !current[current.length - 1]!.trim()) current.pop();
      if (current.length) statements.push(current.join('\n'));
      current = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indented = /^\s/.test(rawLine);
    if (!indented) {
      flush();
      current.push(rawLine);
    } else {
      // Continues the preceding block's body (or stands alone if none yet).
      current.push(rawLine);
    }
  }
  flush();

  return statements.length ? statements : [code.trim()];
}
