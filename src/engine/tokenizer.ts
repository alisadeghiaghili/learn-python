/**
 * Tokenizer for learn-python's Python subset.
 */

import type { Token } from './types';

const KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'in', 'while',
  'and', 'or', 'not', 'is', 'None', 'True', 'False', 'pass',
  'break', 'continue', 'import', 'from', 'as', 'class', 'lambda',
  'async', 'await', 'global', 'nonlocal', 'try', 'except', 'finally', 'raise', 'with',
]);

const THREE_CHAR_OPS = ['//=', '**=', '...'];
const TWO_CHAR_OPS = ['==', '!=', '<=', '>=', '//', '**', '+=', '-=', '*=', '/=', '%=', '->'];

/**
 * Tokenize Python-subset source.
 *
 * @throws {Error} on unterminated string
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split(/\r?\n/);
  let atLineStart = true;
  let parenDepth = 0;
  const indentStack = [0];

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo];
    let i = 0;

    if (atLineStart && parenDepth === 0) {
      let indent = 0;
      while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
        indent += line[i] === '\t' ? 4 : 1;
        i++;
      }
      if (i >= line.length || line[i] === '#') {
        continue;
      }
      if (indent > indentStack[indentStack.length - 1]) {
        indentStack.push(indent);
        tokens.push({ type: 'INDENT', value: '', line: lineNo + 1, col: 1 });
      } else {
        while (indent < indentStack[indentStack.length - 1]) {
          indentStack.pop();
          tokens.push({ type: 'DEDENT', value: '', line: lineNo + 1, col: 1 });
        }
        if (indent !== indentStack[indentStack.length - 1]) {
          throw new Error(`IndentationError: unexpected indent at line ${lineNo + 1}`);
        }
      }
      atLineStart = false;
    } else if (atLineStart) {
      while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
      if (i >= line.length || line[i] === '#') continue;
      atLineStart = false;
    }

    while (i < line.length) {
      const ch = line[i];
      if (ch === ' ' || ch === '\t') {
        i++;
        continue;
      }
      if (ch === '#') break;
      if (ch === '(' || ch === '[' || ch === '{') {
        parenDepth++;
        tokens.push({ type: 'OP', value: ch, line: lineNo + 1, col: i + 1 });
        i++;
        continue;
      }
      if (ch === ')' || ch === ']' || ch === '}') {
        parenDepth = Math.max(0, parenDepth - 1);
        tokens.push({ type: 'OP', value: ch, line: lineNo + 1, col: i + 1 });
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const quote = ch;
        let j = i + 1;
        let s = '';
        while (j < line.length && line[j] !== quote) {
          if (line[j] === '\\') {
            j++;
            if (j >= line.length) break;
            const esc = line[j];
            s += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc;
            j++;
          } else {
            s += line[j];
            j++;
          }
        }
        if (j >= line.length) {
          throw new Error(`SyntaxError: unterminated string at line ${lineNo + 1}`);
        }
        tokens.push({ type: 'STRING', value: s, line: lineNo + 1, col: i + 1 });
        i = j + 1;
        continue;
      }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(line[i + 1] || ''))) {
        let j = i;
        if (ch === '0' && (line[i + 1] === 'x' || line[i + 1] === 'X')) {
          j += 2;
          while (j < line.length && /[0-9a-fA-F_]/.test(line[j])) j++;
        } else if (ch === '0' && (line[i + 1] === 'b' || line[i + 1] === 'B')) {
          j += 2;
          while (j < line.length && /[01_]/.test(line[j])) j++;
        } else if (ch === '0' && (line[i + 1] === 'o' || line[i + 1] === 'O')) {
          j += 2;
          while (j < line.length && /[0-7_]/.test(line[j])) j++;
        } else {
          while (j < line.length && /[0-9_]/.test(line[j])) j++;
          if (j < line.length && line[j] === '.') {
            j++;
            while (j < line.length && /[0-9_]/.test(line[j])) j++;
          }
          if (j < line.length && (line[j] === 'e' || line[j] === 'E')) {
            j++;
            if (j < line.length && (line[j] === '+' || line[j] === '-')) j++;
            while (j < line.length && /[0-9_]/.test(line[j])) j++;
          }
        }
        tokens.push({ type: 'NUMBER', value: line.slice(i, j), line: lineNo + 1, col: i + 1 });
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
        const word = line.slice(i, j);
        tokens.push({
          type: KEYWORDS.has(word) ? 'KEYWORD' : 'NAME',
          value: word,
          line: lineNo + 1,
          col: i + 1,
        });
        i = j;
        continue;
      }

      let matched = false;
      for (const op of THREE_CHAR_OPS) {
        if (line.startsWith(op, i)) {
          tokens.push({ type: 'OP', value: op, line: lineNo + 1, col: i + 1 });
          i += op.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;
      for (const op of TWO_CHAR_OPS) {
        if (line.startsWith(op, i)) {
          tokens.push({ type: 'OP', value: op, line: lineNo + 1, col: i + 1 });
          i += op.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      tokens.push({ type: 'OP', value: ch, line: lineNo + 1, col: i + 1 });
      i++;
    }

    if (parenDepth === 0) {
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineNo + 1, col: line.length + 1 });
      atLineStart = true;
    }
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ type: 'DEDENT', value: '', line: lines.length, col: 1 });
  }
  tokens.push({ type: 'END', value: '', line: lines.length, col: 1 });
  return tokens;
}
