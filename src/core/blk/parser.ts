import { NAME_RE, type BlkBlock, type BlkDocument, type BlkNode, type BlkType, type BlkValue } from './types';

export interface BlkIssue {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ParseResult {
  doc: BlkDocument;
  issues: BlkIssue[];
  ok: boolean;
}

const TYPES: BlkType[] = ['t', 'r', 'i', 'b', 'c', 'p2', 'p3', 'p4'];
const REAL_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
const INT_RE = /^[+-]?\d+$/;
const BOOL_TRUE = ['yes', 'on', 'true', '1'];
const BOOL_FALSE = ['no', 'off', 'false', '0'];

/** Replace comments with spaces (keeping newlines so line numbers stay right). Strings are respected. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let inStr = false;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (inStr) {
      out += ch;
      if (ch === '"') inStr = false;
      else if (ch === '\n') inStr = false; // unterminated string: reported later by value check
      i++;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      i++;
    } else if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (ch === '/' && next === '*') {
      i += 2;
      out += '  ';
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      i += 2;
      out += '  ';
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

const IDENT_RE = /[^\s{}:=;"]+/y;

class Scanner {
  pos = 0;
  private linePos = 0;
  private lineNo = 1;
  constructor(readonly src: string) {}
  /** Current line number; counted incrementally so big generated files stay linear-time. */
  get line() {
    if (this.pos < this.linePos) {
      this.linePos = 0;
      this.lineNo = 1;
    }
    for (let i = this.linePos; i < this.pos && i < this.src.length; i++) if (this.src[i] === '\n') this.lineNo++;
    this.linePos = this.pos;
    return this.lineNo;
  }
  eof() {
    return this.pos >= this.src.length;
  }
  peek() {
    return this.src[this.pos];
  }
  skipSpace(includeSeparators = true) {
    while (!this.eof()) {
      const c = this.peek();
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '﻿' || (includeSeparators && c === ';')) this.pos++;
      else break;
    }
  }
  skipInlineSpace() {
    while (!this.eof() && (this.peek() === ' ' || this.peek() === '\t')) this.pos++;
  }
  ident(): string {
    IDENT_RE.lastIndex = this.pos;
    const m = IDENT_RE.exec(this.src);
    if (!m) return '';
    this.pos += m[0].length;
    return m[0];
  }
  /** Raw value: until newline, ';' or '}' outside of quotes. */
  rawValue(): string {
    let s = '';
    let inStr = false;
    while (!this.eof()) {
      const c = this.peek();
      if (inStr) {
        s += c;
        this.pos++;
        if (c === '"') inStr = false;
        if (c === '\n') break;
        continue;
      }
      if (c === '"') {
        inStr = true;
        s += c;
        this.pos++;
        continue;
      }
      if (c === '\n' || c === ';' || c === '}') break;
      s += c;
      this.pos++;
    }
    return s.trim();
  }
}

function parseNumbers(raw: string, count: number, label: string): number[] | string {
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== count) return `${label} expects ${count} comma-separated values, got ${parts.length} ("${raw}")`;
  const nums: number[] = [];
  for (const p of parts) {
    if (!REAL_RE.test(p)) return `${label}: "${p}" is not a plain decimal number`;
    nums.push(parseFloat(p));
  }
  return nums;
}

export function parseValue(type: BlkType, raw: string): BlkValue | string {
  switch (type) {
    case 't': {
      const m = /^"([^"]*)"$/.exec(raw);
      if (!m) return `text value must be enclosed in double quotes: ${raw}`;
      return { type: 't', value: m[1] };
    }
    case 'r':
      if (!REAL_RE.test(raw)) return `"${raw}" is not a plain decimal number (type r)`;
      return { type: 'r', value: parseFloat(raw) };
    case 'i':
      if (!INT_RE.test(raw)) return `"${raw}" is not an integer (type i)`;
      return { type: 'i', value: parseInt(raw, 10) };
    case 'b': {
      const v = raw.toLowerCase();
      if (BOOL_TRUE.includes(v)) return { type: 'b', value: true };
      if (BOOL_FALSE.includes(v)) return { type: 'b', value: false };
      return `"${raw}" is not a boolean (yes/no, on/off, true/false, 1/0)`;
    }
    case 'c': {
      const parts = raw.split(',').map((p) => p.trim());
      if (parts.length !== 4) return `color expects 4 integers (r, g, b, a), got ${parts.length}`;
      const nums: number[] = [];
      for (const p of parts) {
        if (!INT_RE.test(p)) return `color component "${p}" is not an integer`;
        const n = parseInt(p, 10);
        if (n < 0 || n > 255) return `color component ${n} is outside 0..255`;
        nums.push(n);
      }
      return { type: 'c', value: nums as [number, number, number, number] };
    }
    case 'p2':
    case 'p3':
    case 'p4': {
      const count = Number(type[1]);
      const nums = parseNumbers(raw, count, type);
      if (typeof nums === 'string') return nums;
      return { type, value: nums } as BlkValue;
    }
  }
}

/**
 * Strict parser for the sight subset of the .blk text format.
 * Anything the game would refuse (wrong type, wrong arity, unbalanced braces, bad names)
 * is reported as an error.
 */
export function parseBlk(text: string): ParseResult {
  const sc = new Scanner(stripComments(text));
  const issues: BlkIssue[] = [];
  const root: BlkDocument = { children: [] };
  const stack: { node: { children: BlkNode[] }; name: string; line: number }[] = [{ node: root, name: '<root>', line: 1 }];
  const err = (message: string, line = sc.line) => issues.push({ line, message, severity: 'error' });

  while (true) {
    sc.skipSpace();
    if (sc.eof()) break;
    const top = stack[stack.length - 1];
    if (sc.peek() === '}') {
      if (stack.length === 1) err('Unexpected "}" without a matching "{"');
      else stack.pop();
      sc.pos++;
      continue;
    }
    const line = sc.line;
    const name = sc.ident();
    if (!name) {
      err(`Unexpected character "${sc.peek()}"`);
      sc.pos++;
      continue;
    }
    if (!NAME_RE.test(name)) err(`Invalid name "${name}" (must start with a Latin letter or "_" and contain only letters, digits, "_")`, line);
    sc.skipSpace(false);
    const c = sc.peek();
    if (c === '{') {
      sc.pos++;
      const blk: BlkBlock = { kind: 'block', name, children: [] };
      top.node.children.push(blk);
      stack.push({ node: blk, name, line });
      continue;
    }
    if (c === ':') {
      sc.pos++;
      sc.skipInlineSpace();
      const type = sc.ident() as BlkType;
      sc.skipInlineSpace();
      if (!TYPES.includes(type)) {
        err(`Unknown type "${type}" for parameter "${name}"`, line);
        sc.rawValue();
        continue;
      }
      if (sc.peek() !== '=') {
        err(`Expected "=" after "${name}:${type}"`, line);
        sc.rawValue();
        continue;
      }
      sc.pos++;
      const raw = sc.rawValue();
      const v = parseValue(type, raw);
      if (typeof v === 'string') err(`${name}: ${v}`, line);
      else top.node.children.push({ kind: 'param', name, value: v });
      continue;
    }
    err(`Expected ":type = value" or "{" after "${name}"`, line);
    sc.rawValue();
  }
  for (let i = stack.length - 1; i > 0; i--) err(`Block "${stack[i].name}" opened here is never closed`, stack[i].line);

  return { doc: root, issues, ok: !issues.some((i) => i.severity === 'error') };
}

// ---- small query helpers used by tests and the validator ----

export function findBlocks(nodes: BlkNode[], name: string): BlkBlock[] {
  return nodes.filter((n): n is BlkBlock => n.kind === 'block' && n.name === name);
}

export function getParam(nodes: BlkNode[], name: string): BlkValue | undefined {
  for (const n of nodes) if (n.kind === 'param' && n.name === name) return n.value;
  return undefined;
}
