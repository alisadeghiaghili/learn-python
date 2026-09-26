/**
 * Recursive-descent parser for the LearnPyState Python subset.
 *
 * Produces a small AST consumed by the evaluator. Not a full CPython grammar —
 * only constructs the memory visualizer can teach well.
 */

import { tokenize } from './tokenizer.js';

/**
 * @typedef {{kind: string, line: number} & Object} Node
 */

class Parser {
  /**
   * @param {import('./tokenizer.js').Token[]} tokens
   */
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  /** @returns {import('./tokenizer.js').Token} */
  peek() {
    return this.tokens[this.pos];
  }

  /** @returns {import('./tokenizer.js').Token} */
  next() {
    return this.tokens[this.pos++];
  }

  /**
   * @param {TokenType} type
   * @param {string} [value]
   * @returns {import('./tokenizer.js').Token}
   */
  expect(type, value) {
    const tok = this.peek();
    if (!tok || tok.type !== type || (value !== undefined && tok.value !== value)) {
      const got = tok ? `${tok.type} ${JSON.stringify(tok.value)}` : 'EOF';
      throw new Error(`SyntaxError: expected ${type} ${value ?? ''}, got ${got}`);
    }
    return this.next();
  }

  /**
   * @param {string} value
   * @returns {boolean}
   */
  eatOp(value) {
    const tok = this.peek();
    if (tok && tok.type === 'OP' && tok.value === value) {
      this.next();
      return true;
    }
    return false;
  }

  /**
   * Parse a full module (sequence of simple statements / defs).
   * @returns {Node[]}
   */
  parseModule() {
    const body = [];
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

  /**
   * @returns {Node}
   */
  parseStatement() {
    const tok = this.peek();
    if (!tok) throw new Error('SyntaxError: unexpected end of input');
    if (tok.type === 'KEYWORD' && tok.value === 'def') {
      return this.parseFunctionDef();
    }
    if (tok.type === 'KEYWORD' && tok.value === 'return') {
      this.next();
      let value = null;
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
    if (tok.type === 'KEYWORD' && (tok.value === 'if' || tok.value === 'while' || tok.value === 'for')) {
      throw new Error('SyntaxError: control flow is not supported in v0');
    }
    return this.parseSimpleStatement();
  }

  /** @returns {void} */
  eatNewline() {
    const tok = this.peek();
    if (tok && tok.type === 'NEWLINE') this.next();
  }

  /**
   * @returns {Node}
   */
  parseFunctionDef() {
    const tok = this.expect('KEYWORD', 'def');
    const name = this.expect('NAME').value;
    this.expect('OP', '(');
    const params = [];
    if (!(this.peek() && this.peek().type === 'OP' && this.peek().value === ')')) {
      params.push(this.expect('NAME').value);
      while (this.eatOp(',')) params.push(this.expect('NAME').value);
    }
    this.expect('OP', ')');
    this.eatOp(':');
    this.expect('NEWLINE');
    this.expect('INDENT');
    const body = [];
    while (this.peek() && this.peek().type !== 'DEDENT' && this.peek().type !== 'END') {
      while (this.peek() && this.peek().type === 'NEWLINE') this.next();
      if (!this.peek() || this.peek().type === 'DEDENT' || this.peek().type === 'END') break;
      body.push(this.parseStatement());
    }
    this.expect('DEDENT');
    return { kind: 'FunctionDef', name, params, body, line: tok.line };
  }

  /**
   * Assignment, expression statement, print, augmented assign.
   * @returns {Node}
   */
  parseSimpleStatement() {
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

  /**
   * @returns {Node}
   */
  parseExpr() {
    return this.parseOr();
  }

  /** @returns {Node} */
  parseOr() {
    let left = this.parseAnd();
    while (this.peek()?.type === 'KEYWORD' && this.peek().value === 'or') {
      const line = this.next().line;
      const right = this.parseAnd();
      left = { kind: 'BoolOp', op: 'or', left, right, line };
    }
    return left;
  }

  /** @returns {Node} */
  parseAnd() {
    let left = this.parseNot();
    while (this.peek()?.type === 'KEYWORD' && this.peek().value === 'and') {
      const line = this.next().line;
      const right = this.parseNot();
      left = { kind: 'BoolOp', op: 'and', left, right, line };
    }
    return left;
  }

  /** @returns {Node} */
  parseNot() {
    if (this.peek()?.type === 'KEYWORD' && this.peek().value === 'not') {
      const line = this.next().line;
      const operand = this.parseNot();
      return { kind: 'UnaryOp', op: 'not', operand, line };
    }
    return this.parseComparison();
  }

  /** @returns {Node} */
  parseComparison() {
    let left = this.parseAdditive();
    for (;;) {
      const tok = this.peek();
      if (!tok) break;
      let op = null;
      let line = tok.line;
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

  /** @returns {Node} */
  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.peek()?.type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const tok = this.next();
      const right = this.parseMultiplicative();
      left = { kind: 'BinOp', op: tok.value, left, right, line: tok.line };
    }
    return left;
  }

  /** @returns {Node} */
  parseMultiplicative() {
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

  /** @returns {Node} */
  parseUnary() {
    if (this.peek()?.type === 'OP' && (this.peek().value === '-' || this.peek().value === '+')) {
      const tok = this.next();
      const operand = this.parseUnary();
      return { kind: 'UnaryOp', op: tok.value, operand, line: tok.line };
    }
    return this.parsePostfix();
  }

  /** @returns {Node} */
  parsePostfix() {
    let node = this.parseAtom();
    for (;;) {
      const tok = this.peek();
      if (!tok) break;
      if (tok.type === 'OP' && tok.value === '.') {
        this.next();
        const name = this.expect('NAME').value;
        node = { kind: 'Attribute', object: node, attr: name, line: tok.line };
        continue;
      }
      if (tok.type === 'OP' && tok.value === '[') {
        this.next();
        let index = null;
        let slice = false;
        if (!(this.peek()?.type === 'OP' && this.peek().value === ']')) {
          if (this.peek()?.type === 'OP' && this.peek().value === ':') {
            slice = true;
            this.next();
            const stop = this.peek()?.type === 'OP' && this.peek().value === ']' ? null : this.parseExpr();
            this.expect('OP', ']');
            node = { kind: 'Slice', object: node, start: null, stop, line: tok.line };
            continue;
          }
          const start = this.parseExpr();
          if (this.peek()?.type === 'OP' && this.peek().value === ':') {
            slice = true;
            this.next();
            const stop = this.peek()?.type === 'OP' && this.peek().value === ']' ? null : this.parseExpr();
            this.expect('OP', ']');
            node = { kind: 'Slice', object: node, start, stop, line: tok.line };
            continue;
          }
          index = start;
        }
        this.expect('OP', ']');
        node = { kind: 'Subscript', object: node, index, line: tok.line };
        continue;
      }
      if (tok.type === 'OP' && tok.value === '(') {
        this.next();
        const args = [];
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

  /** @returns {Node} */
  parseAtom() {
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
        const elts = [first];
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
      const elts = [];
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
      const keys = [];
      const values = [];
      if (!(this.peek()?.type === 'OP' && this.peek().value === '}')) {
        for (;;) {
          keys.push(this.parseExpr());
          this.expect('OP', ':');
          values.push(this.parseExpr());
          if (!this.eatOp(',')) break;
          if (this.peek()?.type === 'OP' && this.peek().value === '}') break;
        }
      }
      this.expect('OP', '}');
      return { kind: 'Dict', keys, values, line: tok.line };
    }
    if (tok.type === 'OP' && tok.value === '(') {
      // handled above
    }
    throw new Error(`SyntaxError: unexpected token ${JSON.stringify(tok.value)} at line ${tok.line}`);
  }
}

/**
 * Parse source into an AST statement list.
 *
 * @param {string} source
 * @returns {Node[]}
 * @throws {Error} on syntax errors
 */
export function parse(source) {
  const tokens = tokenize(source);
  return new Parser(tokens).parseModule();
}
