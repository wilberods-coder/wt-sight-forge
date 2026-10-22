import type { Mask } from './raster';

export type Pt = [number, number];
export interface Polyline {
  points: Pt[];
  closed: boolean;
}

// Edge ids inside a marching-squares cell.
const T = 0, R = 1, B = 2, L = 3;
// Corner bits: tl=8, tr=4, br=2, bl=1. Saddles (5, 10) are resolved as two separate segments.
const CASES: number[][][] = [
  [], [[L, B]], [[B, R]], [[L, R]], [[T, R]], [[T, R], [L, B]], [[T, B]], [[T, L]],
  [[T, L]], [[T, B]], [[T, L], [B, R]], [[T, R]], [[L, R]], [[R, B]], [[L, B]], [],
];

/**
 * Marching squares over pixel centres. Returns closed outlines (outer borders and holes)
 * in mask pixel coordinates (0..width, 0..height).
 */
export function traceContours(mask: Mask): Polyline[] {
  const { width: w, height: h, data } = mask;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[y * w + x]);
  const W = w + 2;
  // Unique id for an edge midpoint: horizontal edges (between corner (x,y) and (x+1,y)) are even, vertical odd.
  const hId = (x: number, y: number) => ((y + 1) * W + (x + 1)) * 2;
  const vId = (x: number, y: number) => ((y + 1) * W + (x + 1)) * 2 + 1;
  const pos = new Map<number, Pt>();
  const adj = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  };

  for (let y = -1; y < h; y++)
    for (let x = -1; x < w; x++) {
      const c = (at(x, y) << 3) | (at(x + 1, y) << 2) | (at(x + 1, y + 1) << 1) | at(x, y + 1);
      if (c === 0 || c === 15) continue;
      const edgeId = (e: number) => {
        let id: number;
        let p: Pt;
        // Pixel centre of pixel i sits at i + 0.5.
        if (e === T) [id, p] = [hId(x, y), [x + 1, y + 0.5]];
        else if (e === B) [id, p] = [hId(x, y + 1), [x + 1, y + 1.5]];
        else if (e === L) [id, p] = [vId(x, y), [x + 0.5, y + 1]];
        else [id, p] = [vId(x + 1, y), [x + 1.5, y + 1]];
        if (!pos.has(id)) pos.set(id, p);
        return id;
      };
      for (const [e1, e2] of CASES[c]) link(edgeId(e1), edgeId(e2));
    }

  const visited = new Set<number>();
  const out: Polyline[] = [];
  for (const start of adj.keys()) {
    if (visited.has(start)) continue;
    const ids: number[] = [start];
    visited.add(start);
    let prev = -1;
    let cur = start;
    let closed = false;
    while (true) {
      const next = (adj.get(cur) ?? []).find((n) => n !== prev && !visited.has(n));
      if (next === undefined) {
        closed = (adj.get(cur) ?? []).includes(start) && ids.length > 2;
        break;
      }
      visited.add(next);
      ids.push(next);
      prev = cur;
      cur = next;
    }
    out.push({ points: ids.map((id) => pos.get(id)!), closed });
  }
  return out;
}

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer–Douglas–Peucker simplification of an open polyline (iterative, no recursion limit). */
export function rdp(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3 || epsilon <= 0) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > epsilon && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplify a closed outline: split at the point farthest from the first one, simplify both halves. */
export function simplifyClosed(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 4) return points.slice();
  let far = 0;
  let farD = -1;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const a = rdp(points.slice(0, far + 1), epsilon);
  const b = rdp([...points.slice(far), points[0]], epsilon);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

export function polylineLength(p: Polyline): number {
  let len = 0;
  for (let i = 1; i < p.points.length; i++) len += Math.hypot(p.points[i][0] - p.points[i - 1][0], p.points[i][1] - p.points[i - 1][1]);
  if (p.closed && p.points.length > 1) {
    const a = p.points[p.points.length - 1];
    len += Math.hypot(p.points[0][0] - a[0], p.points[0][1] - a[1]);
  }
  return len;
}
