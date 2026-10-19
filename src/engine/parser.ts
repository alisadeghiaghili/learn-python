/**
 * Recursive-descent parser for learn-python's Python subset.
 *
 * Produces a small AST consumed by the evaluator. Not a full CPython grammar —
 * only constructs the memory visualizer can teach well.
 */

import { tokenize } from './tokenizer';
import type { AstNode, Token, TokenType } from './types';

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType, value?: string): Token {
    const tok = this.peek();
    if (!tok || tok.type !== type || (value !== undefined && tok.value !== value)) {
      const got = tok ? `${tok.type} ${JSON.stringify(tok.value)}` : 'EOF';
      throw new Error(`SyntaxError: expected ${type} ${value ?? ''}, got ${got}`);
    }
    return this.next();
  }

  private eatOp(value: string): boolean {
    const tok = this.peek();
    if (tok && tok.type === 'OP' && tok.value === value) {
      this.next();
      return true;
    }
    return false;
  }

  /** Parse a full module (sequence of simple statements / defs). */
  parseModule(): AstNode[] {
    const body: AstNode[] = [];
    while (this.peek() && this.peek().type !== 'END') {
      while (this.peek() && this.peek().type === 'NEWLINE') this.next();
      if (!this.peek() || this.peek().type === 'END') break;
      if (this.peek().type === 'DEDENT') {
        this.next();
        continue;
      }
      body.push(this.parseStatement());
    }
    return body;
  }

  private parseStatement(): AstNode {
    const tok = this.peek();
    if (!tok) throw new Error('SyntaxError: unexpected end of input');
    if (tok.type === 'KEYWORD' && tok.value === 'async') {
      const next = this.tokens[this.pos + 1];
      if (!next || next.type !== 'KEYWORD' || next.value !== 'def') {
        throw new Error('SyntaxError: only "async def" is supported (line ' + tok.line + ')');
      }
      return this.parseCoroutineDef();
    }
    if (tok.type === 'KEYWORD' && tok.value === 'def') {
      return this.parseFunctionDef();
    }
    if (tok.type === 'KEYWORD' && tok.value === 'return') {
      this.next();
      let value: AstNode | null = null;
      if (this.peek() && this.peek().type !== 'NEWLINE') {
        value = this.parseExpr();
      }
      this.eatNewline();
      return { kind: 'Return', value, line: tok.line };
    }
    if (tok.type === 'KEYWORD' && tok.value === 'pass') {
      this.next();
      this.eatNewline();
      return { kind: 'Pass', line: tok.line };
    }
    if (tok.type === 'KEYWORD' && tok.value === 'import') {
      return this.parseImport();
    }
    if (tok.type === 'KEYWORD' && tok.value === 'if') {
      return this.parseIf();
    }
    if (tok.type === 'KEYWORD' && tok.value === 'for') {
      return this.parseFor();
    }
    if (tok.type === 'KEYWORD' && tok.value === 'while') {
      return this.parseWhile();
    }
    if (tok.type === 'KEYWORD' && tok.value === 'break') {
      this.next();
      this.eatNewline();
      return { kind: 'Break', line: tok.line };
    }
    if (tok.type === 'KEYWORD' && tok.value === 'continue') {
      this.next();
      this.eatNewline();
      return { kind: 'Continue', line: tok.line };
    }
    return this.parseSimpleStatement();
  }

  private eatNewline(): void {
    const tok = this.peek();
    if (tok && tok.type === 'NEWLINE') this.next();
  }

  /**
   * Look ahead inside an open `{`: a `{`-literal is a dict if a top-level `:`
   * appears before the first top-level `,` or closing `}` (e.g. `{1: 2}` vs
   * `{1, 2, 3}`). Nesting depth from `(`/`[`/`{` is tracked so a nested
   * container's colon doesn't misfire.
   */
  private scanHasColonBeforeCommaOrBrace(): boolean {
    let i = this.pos;
    let depth = 0;
    while (i < this.tokens.length) {
      const t = this.tokens[i];
      if (!t || t.type === 'END') return false;
      if (t.type === 'OP') {
        if (t.value === '(' || t.value === '[' || t.value === '{') depth++;
        else if (t.value === ')' || t.value === ']' || t.value === '}') {
          if (depth === 0) return false; // closing the set/dict itself
          depth--;
        } else if (depth === 0 && t.value === ':') return true;
        else if (depth === 0 && t.value === ',') return false;
      }
      i++;
    }
    return false;
  }

  /**
   * Parse an indented suite following a `name(...):` / `if ...:` header: consume
   * the `:` `NEWLINE` `INDENT`, then statements until the `DEDENT`. Shared by
   * `def`, `async def`, `if`, `elif`, `else`, `for`, and `while` so nested
   * indented blocks reuse one code path.
   */
  private parseSuite(): AstNode[] {
    this.expect('NEWLINE');
    this.expect('INDENT');
    const body: AstNode[] = [];
    while (this.peek() && this.peek().type !== 'DEDENT' && this.peek().type !== 'END') {
      while (this.peek() && this.peek().type === 'NEWLINE') this.next();
      if (!this.peek() || this.peek().type === 'DEDENT' || this.peek().type === 'END') break;
      body.push(this.parseStatement());
    }
    this.expect('DEDENT');
    return body;
  }

  private parseFunctionDef(): AstNode {
    const tok = this.expect('KEYWORD', 'def');
    const name = this.expect('NAME').value;
    this.expect('OP', '(');
    const params: string[] = [];
    if (!(this.peek() && this.peek().type === 'OP' && this.peek().value === ')')) {
      params.push(this.expect('NAME').value);
      while (this.eatOp(',')) params.push(this.expect('NAME').value);
    }
    this.expect('OP', ')');
    this.eatOp(':');
    const body = this.parseSuite();
    return { kind: 'FunctionDef', name, params, body, line: tok.line };
  }

  /** `async def name(params):` — a coroutine function definition. */
  private parseCoroutineDef(): AstNode {
    const tok = this.expect('KEYWORD', 'async');
    this.expect('KEYWORD', 'def');
    const name = this.expect('NAME').value;
    this.expect('OP', '(');
    const params: string[] = [];
    if (!(this.peek() && this.peek().type === 'OP' && this.peek().value === ')')) {
      params.push(this.expect('NAME').value);
      while (this.eatOp(',')) params.push(this.expect('NAME').value);
    }
    this.expect('OP', ')');
    this.eatOp(':');
    const body = this.parseSuite();
    return { kind: 'CoroutineDef', name, params, body, line: tok.line };
  }

  /** `if <test>:` body [`elif <test>:` body ...] [`else:` body] */
  private parseIf(): AstNode {
    const tok = this.expect('KEYWORD', 'if');
    const test = this.parseExpr();
    this.eatOp(':');
    const body = this.parseSuite();
    const elifs: Array<{ test: AstNode; body: AstNode[] }> = [];
    let elseBody: AstNode[] | null = null;
    for (;;) {
      // Skip the NEWLINE(s) before the dedent; the header's NEWLINE was already
      // consumed by parseSuite, so the next NEWLINE belongs to the branch head.
      this.eatNewline();
      const n = this.peek();
      if (n && n.type === 'KEYWORD' && n.value === 'elif') {
        this.next();
        const branchTest = this.parseExpr();
        this.eatOp(':');
        const branchBody = this.parseSuite();
        elifs.push({ test: branchTest, body: branchBody });
      } else if (n && n.type === 'KEYWORD' && n.value === 'else') {
        this.next();
        this.eatOp(':');
        elseBody = this.parseSuite();
        this.eatNewline();
        break;
      } else {
        break;
      }
    }
    return { kind: 'If', test, body, elifs, elseBody, line: tok.line };
  }

  /** `for <name> in <iterable>:` body */
  private parseFor(): AstNode {
    const tok = this.expect('KEYWORD', 'for');
    const target = this.expect('NAME').value;
    this.expect('KEYWORD', 'in');
    const iterable = this.parseExpr();
    this.eatOp(':');
    const body = this.parseSuite();
    this.eatNewline();
    return { kind: 'For', target, iterable, body, line: tok.line };
  }

  /** `while <test>:` body */
  private parseWhile(): AstNode {
    const tok = this.expect('KEYWORD', 'while');
    const test = this.parseExpr();
    this.eatOp(':');
    const body = this.parseSuite();
    this.eatNewline();
    return { kind: 'While', test, body, line: tok.line };
  }

  /** `import x`, `import x.y`, or `import x as z`. (from-imports are v1.) */
  private parseImport(): AstNode {
    const tok = this.expect('KEYWORD', 'import');
    const parts: string[] = [this.expect('NAME').value];
    while (this.eatOp('.')) parts.push(this.expect('NAME').value);
    let alias: string | null = null;
    if (this.peek()?.type === 'KEYWORD' && this.peek().value === 'as') {
      this.next();
      alias = this.expect('NAME').value;
    }
    this.eatNewline();
    return { kind: 'Import', name: parts.join('.'), alias, line: tok.line };
  }

  /** Assignment, expression statement, print, augmented assign. */
  private parseSimpleStatement(): AstNode {
    const line = this.peek().line;
    const expr = this.parseExpr();
    const tok = this.peek();

    if (tok && tok.type === 'OP' && tok.value === '=') {
      this.next();
      const value = this.parseExpr();
      this.eatNewline();
      return { kind: 'Assign', target: expr, value, line };
    }
    const augOps = ['+=', '-=', '*=', '/=', '%=', '//=', '**='];
    if (tok && tok.type === 'OP' && augOps.includes(tok.value)) {
      this.next();
      const value = this.parseExpr();
      this.eatNewline();
      return { kind: 'AugAssign', target: expr, op: tok.value.slice(0, -1), value, line };
    }
    this.eatNewline();
    return { kind: 'ExprStatement', expr, line };
  }

  private parseExpr(): AstNode {
    return this.parseOr();
  }

  private parseOr(): AstNode {
    let left = this.parseAnd();
    while (this.peek()?.type === 'KEYWORD' && this.peek().value === 'or') {
      const line = this.next().line;
      const right = this.parseAnd();
      left = { kind: 'BoolOp', op: 'or', left, right, line };
    }
    return left;
  }

  private parseAnd(): AstNode {
    let left = this.parseNot();
    while (this.peek()?.type === 'KEYWORD' && this.peek().value === 'and') {
      const line = this.next().line;
      const right = this.parseNot();
      left = { kind: 'BoolOp', op: 'and', left, right, line };
    }
    return left;
  }

  private parseNot(): AstNode {
    if (this.peek()?.type === 'KEYWORD' && this.peek().value === 'not') {
      const line = this.next().line;
      const operand = this.parseNot();
      return { kind: 'UnaryOp', op: 'not', operand, line };
    }
    return this.parseComparison();
  }

  private parseComparison(): AstNode {
    let left = this.parseAdditive();
    for (;;) {
      const tok = this.peek();
      if (!tok) break;
      let op: string | null = null;
      const line = tok.line;
      if (tok.type === 'OP' && ['==', '!=', '<', '<=', '>', '>='].includes(tok.value)) {
        op = tok.value;
        this.next();
      } else if (tok.type === 'KEYWORD' && tok.value === 'is') {
        this.next();
        if (this.peek()?.type === 'KEYWORD' && this.peek().value === 'not') {
          this.next();
          op = 'is not';
        } else {
          op = 'is';
        }
      } else if (tok.type === 'KEYWORD' && tok.value === 'in') {
        this.next();
        op = 'in';
      } else {
        break;
      }
      const right = this.parseAdditive();
      left = { kind: 'Compare', op, left, right, line };
    }
    return left;
  }

  private parseAdditive(): AstNode {
    let left = this.parseMultiplicative();
    while (this.peek()?.type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const tok = this.next();
      const right = this.parseMultiplicative();
      left = { kind: 'BinOp', op: tok.value, left, right, line: tok.line };
    }
    return left;
  }

  private parseMultiplicative(): AstNode {
    let left = this.parseUnary();
    while (
      this.peek()?.type === 'OP' &&
      ['*', '/', '//', '%', '**'].includes(this.peek().value)
    ) {
      const tok = this.next();
      const right = this.parseUnary();
      left = { kind: 'BinOp', op: tok.value, left, right, line: tok.line };
    }
    return left;
  }

  private parseUnary(): AstNode {
    if (this.peek()?.type === 'OP' && (this.peek().value === '-' || this.peek().value === '+')) {
      const tok = this.next();
      const operand = this.parseUnary();
      return { kind: 'UnaryOp', op: tok.value, operand, line: tok.line };
    }
    if (this.peek()?.type === 'KEYWORD' && this.peek().value === 'await') {
      const tok = this.next();
      const value = this.parseUnary();
      return { kind: 'Await', value, line: tok.line };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): AstNode {
    let node = this.parseAtom();
    // Attribute the immediately-preceding `.` selector, so `obj.attr[...]`
    // becomes a Subscript/Slice over `obj` carrying `attr` (pandas loc/iloc).
    let pendingAttr: string | null = null;
    for (;;) {
      const tok = this.peek();
      if (!tok) break;
      if (tok.type === 'OP' && tok.value === '.') {
        this.next();
        const name = this.expect('NAME').value;
        node = { kind: 'Attribute', object: node, attr: name, line: tok.line };
        pendingAttr = name;
        continue;
      }
      if (tok.type === 'OP' && tok.value === '[') {
        this.next();
        // `obj.attr[...]` is subscripted over the BASE object with the attr as
        // a tag (pandas loc/iloc); a plain `obj[...]` subscripts `obj` directly.
        const attrBase = node.kind === 'Attribute' && pendingAttr !== null ? (node as { object: AstNode }).object : node;
        const attr = node.kind === 'Attribute' && pendingAttr !== null ? pendingAttr : undefined;
        pendingAttr = null;
        let index: AstNode | null = null;
        if (!(this.peek()?.type === 'OP' && this.peek().value === ']')) {
          if (this.peek()?.type === 'OP' && this.peek().value === ':') {
            this.next();
            const stop = this.peek()?.type === 'OP' && this.peek().value === ']' ? null : this.parseExpr();
            this.expect('OP', ']');
            node = { kind: 'Slice', object: attrBase, start: null, stop, line: tok.line, attr };
            continue;
          }
          const start = this.parseExpr();
          if (this.peek()?.type === 'OP' && this.peek().value === ':') {
            this.next();
            const stop = this.peek()?.type === 'OP' && this.peek().value === ']' ? null : this.parseExpr();
            this.expect('OP', ']');
            node = { kind: 'Slice', object: attrBase, start, stop, line: tok.line, attr };
            continue;
          }
          index = start;
        }
        this.expect('OP', ']');
        node = { kind: 'Subscript', object: attrBase, index, line: tok.line, attr };
        continue;
      }
      if (tok.type === 'OP' && tok.value === '(') {
        this.next();
        const args: AstNode[] = [];
        if (!(this.peek()?.type === 'OP' && this.peek().value === ')')) {
          args.push(this.parseExpr());
          while (this.eatOp(',')) {
            if (this.peek()?.type === 'OP' && this.peek().value === ')') break;
            args.push(this.parseExpr());
          }
        }
        this.expect('OP', ')');
        node = { kind: 'Call', func: node, args, line: tok.line };
        continue;
      }
      break;
    }
    return node;
  }

  private parseAtom(): AstNode {
    const tok = this.peek();
    if (!tok) throw new Error('SyntaxError: unexpected end of input');

    if (tok.type === 'NUMBER') {
      this.next();
      const raw = tok.value.replace(/_/g, '');
      const value = raw.includes('.') ? Number(raw) : parseInt(raw, 10);
      return { kind: 'Literal', value, line: tok.line };
    }
    if (tok.type === 'STRING') {
      this.next();
      return { kind: 'Literal', value: tok.value, line: tok.line };
    }
    if (tok.type === 'KEYWORD') {
      if (tok.value === 'True') {
        this.next();
        return { kind: 'Literal', value: true, line: tok.line };
      }
      if (tok.value === 'False') {
        this.next();
        return { kind: 'Literal', value: false, line: tok.line };
      }
      if (tok.value === 'None') {
        this.next();
        return { kind: 'Literal', value: null, line: tok.line };
      }
    }
    if (tok.type === 'NAME') {
      this.next();
      return { kind: 'Name', id: tok.value, line: tok.line };
    }
    if (tok.type === 'OP' && tok.value === '(') {
      this.next();
      if (this.eatOp(')')) {
        return { kind: 'Tuple', elts: [], line: tok.line };
      }
      const first = this.parseExpr();
      if (this.eatOp(',')) {
        const elts: AstNode[] = [first];
        while (this.peek() && !(this.peek().type === 'OP' && this.peek().value === ')')) {
          elts.push(this.parseExpr());
          if (!this.eatOp(',')) break;
        }
        this.expect('OP', ')');
        return { kind: 'Tuple', elts, line: tok.line };
      }
      this.expect('OP', ')');
      return first;
    }
    if (tok.type === 'OP' && tok.value === '[') {
      this.next();
      const elts: AstNode[] = [];
      if (!(this.peek()?.type === 'OP' && this.peek().value === ']')) {
        elts.push(this.parseExpr());
        while (this.eatOp(',')) {
          if (this.peek()?.type === 'OP' && this.peek().value === ']') break;
          elts.push(this.parseExpr());
        }
      }
      this.expect('OP', ']');
      return { kind: 'List', elts, line: tok.line };
    }
    if (tok.type === 'OP' && tok.value === '{') {
      this.next();
      if (this.peek()?.type === 'OP' && this.peek().value === '}') {
        this.next();
        // {} is the empty dict in Python; empty sets must be built with set().
        return { kind: 'Dict', keys: [], values: [], line: tok.line };
      }
      // Set vs dict: a dict's first entry has a `:` before any `,` or `}`.
      const isDict = this.scanHasColonBeforeCommaOrBrace();
      if (isDict) {
        const keys: AstNode[] = [];
        const values: AstNode[] = [];
        for (;;) {
          keys.push(this.parseExpr());
          this.expect('OP', ':');
          values.push(this.parseExpr());
          if (!this.eatOp(',')) break;
          if (this.peek()?.type === 'OP' && this.peek().value === '}') break;
        }
        this.expect('OP', '}');
        return { kind: 'Dict', keys, values, line: tok.line };
      }
      const elts: AstNode[] = [];
      for (;;) {
        elts.push(this.parseExpr());
        if (!this.eatOp(',')) break;
        if (this.peek()?.type === 'OP' && this.peek().value === '}') break;
      }
      this.expect('OP', '}');
      return { kind: 'Set', elts, line: tok.line };
    }
    throw new Error(`SyntaxError: unexpected token ${JSON.stringify(tok.value)} at line ${tok.line}`);
  }
}

/**
 * Parse source into an AST statement list.
 *
 * @throws {Error} on syntax errors
 */
export function parse(source: string): AstNode[] {
  const tokens = tokenize(source);
  return new Parser(tokens).parseModule();
}
