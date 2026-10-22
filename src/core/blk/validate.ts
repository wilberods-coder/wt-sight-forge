import { parseBlk, type BlkIssue } from './parser';
import type { BlkBlock, BlkNode, BlkType, BlkValue } from './types';

/** Top-level parameters documented on the official wiki or seen in working community sights. */
export const KNOWN_TOP_PARAMS: Record<string, BlkType> = {
  thousandth: 't',
  crosshairHorVertSize: 'p2',
  rangefinderProgressBarColor1: 'c',
  rangefinderProgressBarColor2: 'c',
  rangefinderTextScale: 'r',
  rangefinderVerticalOffset: 'r',
  rangefinderHorizontalOffset: 'r',
  rangefinderUseThousandth: 'b',
  detectAllyTextScale: 'r',
  detectAllyOffset: 'p2',
  fontSizeMult: 'r',
  lineSizeMult: 'r',
  drawCentralLineVert: 'b',
  drawCentralLineHorz: 'b',
  crosshairColor: 'c',
  crosshairLightColor: 'c',
  crosshairDistHorSizeMain: 'p2',
  crosshairDistHorSizeAdditional: 'p2',
  distanceCorrectionPos: 'p2',
  drawDistanceCorrection: 'b',
  drawUpward: 'b',
  distancePos: 'p2',
  textPos: 'p2',
  textAlign: 'i',
  textShift: 'r',
  useSmoothEdge: 'b',
};

export const KNOWN_TOP_BLOCKS = [
  'crosshair_distances',
  'crosshair_hor_ranges',
  'matchExpClass',
  'ballistics',
  'drawLines',
  'drawTexts',
  'drawCircles',
  'drawQuads',
];

const ELEMENT_SCHEMA: Record<string, { element: string; required: Record<string, BlkType>; optional: Record<string, BlkType> }> = {
  drawLines: {
    element: 'line',
    required: { line: 'p4' },
    optional: { move: 'b', thousandth: 'b', radialCenter: 'p2', radialAngle: 'r', radialMoveSpeed: 'r', moveRadial: 'b', center: 'p2' },
  },
  drawQuads: {
    element: 'quad',
    required: { tl: 'p2', tr: 'p2', br: 'p2', bl: 'p2' },
    optional: { move: 'b', thousandth: 'b', center: 'p2', radialCenter: 'p2', radialAngle: 'r', radialMoveSpeed: 'r', moveRadial: 'b' },
  },
  drawCircles: {
    element: 'circle',
    required: { pos: 'p2', diameter: 'r' },
    optional: { segment: 'p2', size: 'r', move: 'b', thousandth: 'b', radialCenter: 'p2', radialAngle: 'r', radialMoveSpeed: 'r', moveRadial: 'b' },
  },
  drawTexts: {
    element: 'text',
    required: { text: 't', pos: 'p2' },
    optional: { align: 'i', move: 'b', thousandth: 'b', size: 'r', highlight: 'b', radialCenter: 'p2', radialAngle: 'r', radialMoveSpeed: 'r', moveRadial: 'b' },
  },
};

/** Soft limit: community tools report several thousand elements load fine; beyond that is untested. */
export const ELEMENT_SOFT_LIMIT = 4000;

export interface ValidationReport {
  ok: boolean;
  issues: BlkIssue[];
  counts: { lines: number; quads: number; circles: number; texts: number; total: number };
}

function params(nodes: BlkNode[]) {
  const map = new Map<string, BlkValue>();
  for (const n of nodes) if (n.kind === 'param') map.set(n.name, n.value);
  return map;
}

export function isConvexQuad(pts: [number, number][]): boolean {
  let pos = false;
  let neg = false;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % 4];
    const [cx, cy] = pts[(i + 2) % 4];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (cross > 1e-9) pos = true;
    else if (cross < -1e-9) neg = true;
  }
  return !(pos && neg);
}

function checkElements(blk: BlkBlock, issues: BlkIssue[]): number {
  const schema = ELEMENT_SCHEMA[blk.name];
  let count = 0;
  for (const child of blk.children) {
    if (child.kind !== 'block' || child.name !== schema.element) {
      if (child.kind !== 'comment')
        issues.push({ line: 0, severity: 'warning', message: `${blk.name}: unexpected entry "${child.name}" (expected "${schema.element}" blocks)` });
      continue;
    }
    count++;
    const p = params(child.children);
    for (const [name, type] of Object.entries(schema.required)) {
      const v = p.get(name);
      if (!v) issues.push({ line: 0, severity: 'error', message: `${blk.name}/${schema.element} #${count}: missing required "${name}:${type}"` });
      else if (v.type !== type) issues.push({ line: 0, severity: 'error', message: `${blk.name}/${schema.element} #${count}: "${name}" must be of type ${type}, got ${v.type}` });
    }
    for (const [name, v] of p) {
      const expected = schema.required[name] ?? schema.optional[name];
      if (!expected) issues.push({ line: 0, severity: 'warning', message: `${blk.name}/${schema.element} #${count}: unknown parameter "${name}"` });
      else if (expected !== v.type) issues.push({ line: 0, severity: 'error', message: `${blk.name}/${schema.element} #${count}: "${name}" must be of type ${expected}, got ${v.type}` });
    }
    if (blk.name === 'drawQuads') {
      const corners = ['tl', 'tr', 'br', 'bl'].map((k) => p.get(k)?.value as [number, number] | undefined);
      if (corners.every(Boolean) && !isConvexQuad(corners as [number, number][]))
        issues.push({ line: 0, severity: 'error', message: `drawQuads/quad #${count}: corners tl→tr→br→bl do not form a convex shape` });
    }
  }
  return count;
}

/** Full check of a sight file: syntax (parser) + structure of the known sight blocks. */
export function validateSightText(text: string): ValidationReport {
  const parsed = parseBlk(text);
  const issues = [...parsed.issues];
  const counts = { lines: 0, quads: 0, circles: 0, texts: 0, total: 0 };

  for (const node of parsed.doc.children) {
    if (node.kind === 'param') {
      const expected = KNOWN_TOP_PARAMS[node.name];
      if (!expected) issues.push({ line: 0, severity: 'warning', message: `Unknown top-level parameter "${node.name}"` });
      else if (expected !== node.value.type)
        issues.push({ line: 0, severity: 'error', message: `"${node.name}" must be of type ${expected}, got ${node.value.type}` });
      if (node.name === 'thousandth' && node.value.type === 't' && !['ussr', 'nato', 'real'].includes(node.value.value))
        issues.push({ line: 0, severity: 'error', message: `thousandth must be "ussr", "nato" or "real"` });
    } else if (node.kind === 'block') {
      if (!KNOWN_TOP_BLOCKS.includes(node.name)) {
        issues.push({ line: 0, severity: 'warning', message: `Unknown top-level block "${node.name}"` });
        continue;
      }
      if (node.name in ELEMENT_SCHEMA) {
        const n = checkElements(node, issues);
        if (node.name === 'drawLines') counts.lines += n;
        if (node.name === 'drawQuads') counts.quads += n;
        if (node.name === 'drawCircles') counts.circles += n;
        if (node.name === 'drawTexts') counts.texts += n;
      }
      if (node.name === 'crosshair_distances') {
        const kinds = new Set(node.children.map((c) => (c.kind === 'block' ? 'block' : c.kind === 'param' ? c.value.type : 'comment')));
        kinds.delete('comment');
        if (kinds.size > 1) issues.push({ line: 0, severity: 'error', message: 'crosshair_distances mixes different distance formats (p2 / p3 / block) — the game does not allow that' });
      }
    }
  }
  counts.total = counts.lines + counts.quads + counts.circles + counts.texts;
  if (counts.total > ELEMENT_SOFT_LIMIT)
    issues.push({ line: 0, severity: 'warning', message: `${counts.total} drawing elements — more than ~${ELEMENT_SOFT_LIMIT} has not been tested in-game` });

  return { ok: !issues.some((i) => i.severity === 'error'), issues, counts };
}
