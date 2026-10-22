import { NAME_RE, type BlkDocument, type BlkNode, type BlkValue } from './types';

/**
 * Fixed-point number formatting. Never emits exponent notation, NaN, Infinity or "-0":
 * a single malformed value makes the game silently ignore the whole sight file.
 */
export function formatNumber(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) throw new Error(`Non-finite number cannot be written to .blk: ${value}`);
  // toFixed switches to exponent notation from 1e21; sight values are never anywhere near that.
  if (Math.abs(value) >= 1e9) throw new Error(`Number out of range for a sight file: ${value}`);
  let s = value.toFixed(decimals);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0' || s === '') s = '0';
  return s;
}

function formatInt(value: number): string {
  if (!Number.isInteger(value)) throw new Error(`Integer parameter got a fractional value: ${value}`);
  return String(value);
}

export function formatValue(v: BlkValue): string {
  switch (v.type) {
    case 't':
      if (v.value.includes('"')) throw new Error('Text values cannot contain double quotes');
      return `"${v.value}"`;
    case 'r':
      return formatNumber(v.value);
    case 'i':
      return formatInt(v.value);
    case 'b':
      return v.value ? 'yes' : 'no';
    case 'c':
      return v.value.map((n) => formatInt(Math.max(0, Math.min(255, Math.round(n))))).join(', ');
    case 'p2':
    case 'p3':
    case 'p4':
      return v.value.map((n) => formatNumber(n)).join(', ');
  }
}

function checkName(name: string) {
  if (!NAME_RE.test(name)) throw new Error(`Invalid .blk identifier: "${name}"`);
}

function writeNode(node: BlkNode, indent: string, out: string[]) {
  if (node.kind === 'comment') {
    out.push(`${indent}// ${node.text}`);
    return;
  }
  checkName(node.name);
  if (node.kind === 'param') {
    const c = node.comment ? ` // ${node.comment}` : '';
    out.push(`${indent}${node.name}:${node.value.type} = ${formatValue(node.value)}${c}`);
    return;
  }
  const c = node.comment ? ` // ${node.comment}` : '';
  if (node.inline) {
    // Same compact form as the official wiki example: `line { line:p4 = 0, -1.0, 0, -0.018; move:b = false; }`
    const parts = node.children.map((child) => {
      if (child.kind !== 'param') throw new Error(`Inline block "${node.name}" may contain only parameters`);
      checkName(child.name);
      return `${child.name}:${child.value.type} = ${formatValue(child.value)};`;
    });
    out.push(`${indent}${node.name} { ${parts.join(' ')} }${c}`);
    return;
  }
  out.push(`${indent}${node.name} {${c}`);
  for (const child of node.children) writeNode(child, indent + '  ', out);
  out.push(`${indent}}`);
}

export function writeBlk(doc: BlkDocument): string {
  const out: string[] = [];
  doc.children.forEach((node, idx) => {
    // Blank line before each top-level block for readability.
    if (node.kind === 'block' && idx > 0) out.push('');
    writeNode(node, '', out);
  });
  return out.join('\n') + '\n';
}
