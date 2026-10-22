import type { ArtGeometry } from '../image/trace';
import { MILS_PER_RAD, type ArtPreset, type ArtworkSettings, type ElementsConfig, type Prim, type SightGlobals, type Vec } from './model';

const line = (a: Vec, b: Vec): Prim => ({ kind: 'line', a, b, src: 'element' });
const rectQuad = (x0: number, y0: number, x1: number, y1: number): Prim => ({
  kind: 'quad',
  p: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
  src: 'element',
});
const text = (t: string, pos: Vec, size = 0.8, align = 0): Prim => ({ kind: 'text', text: t, pos, size, align, src: 'element' });

/**
 * Split a convex polygon into convex quads (triangle fan, two triangles per quad).
 * drawQuads only draws convex 4-vertex shapes; a triangle repeats its last vertex.
 */
export function convexPolygonToQuads(pts: Vec[]): [Vec, Vec, Vec, Vec][] {
  const out: [Vec, Vec, Vec, Vec][] = [];
  for (let i = 1; i + 1 < pts.length; i += 2) {
    const c = pts[i + 2] ?? pts[i + 1];
    out.push([pts[0], pts[i], pts[i + 1], c]);
  }
  return out;
}

export function buildElementPrims(el: ElementsConfig, g: SightGlobals): Prim[] {
  const out: Prim[] = [];

  if (el.centerDot.enabled && el.centerDot.diameter > 0) {
    const r = el.centerDot.diameter / 2;
    let poly: Vec[];
    if (el.centerDot.shape === 'square') poly = [[-r, -r], [r, -r], [r, r], [-r, r]];
    else if (el.centerDot.shape === 'diamond') poly = [[0, -r], [r, 0], [0, r], [-r, 0]];
    else poly = Array.from({ length: 12 }, (_, i): Vec => [r * Math.cos((i / 12) * 2 * Math.PI), r * Math.sin((i / 12) * 2 * Math.PI)]);
    for (const q of convexPolygonToQuads(poly)) out.push({ kind: 'quad', p: q, src: 'element' });
  }

  const ch = el.crosshair;
  if (ch.enabled && ch.length > 0) {
    const g0 = ch.gap;
    const g1 = ch.gap + ch.length;
    const t = ch.thickness / 2;
    const arms: [boolean, Vec, Vec][] = [
      [ch.top, [0, -g0], [0, -g1]],
      [ch.bottom, [0, g0], [0, g1]],
      [ch.left, [-g0, 0], [-g1, 0]],
      [ch.right, [g0, 0], [g1, 0]],
    ];
    for (const [on, a, b] of arms) {
      if (!on) continue;
      if (ch.style === 'line') out.push(line(a, b));
      else {
        const vertical = a[0] === 0;
        const [x0, x1] = vertical ? [-t, t] : [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
        const [y0, y1] = vertical ? [Math.min(a[1], b[1]), Math.max(a[1], b[1])] : [-t, t];
        out.push(rectQuad(x0, y0, x1, y1));
      }
    }
  }

  const hl = el.horizontalLine;
  if (hl.enabled && hl.length > hl.gap) {
    out.push(line([-hl.length, 0], [-hl.gap, 0]), line([hl.gap, 0], [hl.length, 0]));
    if (hl.tickStep > 0 && hl.tickSize > 0) {
      let n = 0;
      for (let x = Math.ceil(hl.gap / hl.tickStep) * hl.tickStep; x <= hl.length + 1e-6; x += hl.tickStep, n++) {
        if (x < hl.gap) continue;
        const big = n % 2 === 1 || hl.tickStep >= 8;
        const s = big ? hl.tickSize * 1.6 : hl.tickSize;
        out.push(line([x, 0], [x, s]), line([-x, 0], [-x, s]));
        if (hl.labels && big) {
          const label = String(Math.round(x));
          out.push(text(label, [x, s + 1.8]), text(label, [-x, s + 1.8]));
        }
      }
    }
  }

  const vl = el.verticalLine;
  if (vl.enabled) {
    if (vl.lengthUp > vl.gap) out.push(line([0, -vl.gap], [0, -vl.lengthUp]));
    if (vl.lengthDown > vl.gap) out.push(line([0, vl.gap], [0, vl.lengthDown]));
    if (vl.tickStep > 0 && vl.tickSize > 0) {
      for (let y = Math.ceil(vl.gap / vl.tickStep) * vl.tickStep, n = 0; y <= vl.lengthDown + 1e-6; y += vl.tickStep, n++) {
        const s = n % 2 === 1 ? vl.tickSize * 1.6 : vl.tickSize;
        out.push(line([-s / 2, y], [s / 2, y]));
      }
    }
  }

  const rf = el.rangefinder;
  if (rf.enabled && rf.distances.length > 0 && rf.targetHeight > 0) {
    // Stadiametric scale: at distance d a target of height H subtends H/d radians.
    const k = MILS_PER_RAD[g.thousandth];
    const ds = [...rf.distances].filter((d) => d > 0).sort((a, b) => a - b);
    const pts: Vec[] = ds.map((d, i) => [rf.x + i * rf.spacing, rf.y - (rf.targetHeight / d) * k]);
    const xEnd = rf.x + (ds.length - 1) * rf.spacing;
    out.push(line([rf.x, rf.y], [xEnd, rf.y]));
    pts.forEach((p, i) => {
      out.push(line([p[0], rf.y], p));
      if (i > 0) out.push(line(pts[i - 1], p));
      if (rf.labels) out.push(text(String(Math.round(ds[i] / 100)), [p[0], rf.y + 1.8], 0.7));
    });
  }

  if (el.circles.enabled)
    for (const c of el.circles.items)
      if (c.diameter > 0) out.push({ kind: 'circle', pos: [c.x, c.y], diameter: c.diameter, size: c.size, segment: [c.start, c.end], src: 'element' });

  if (el.customLines.enabled) for (const l of el.customLines.items) out.push(line([l.x1, l.y1], [l.x2, l.y2]));

  return out;
}

/** Place normalised artwork geometry into sight space (mils): scale, flip, rotate, offset. */
export function placeArtwork(geo: ArtGeometry, a: ArtworkSettings): Prim[] {
  const rad = (a.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const fx = a.flipX ? -1 : 1;
  const fy = a.flipY ? -1 : 1;
  const tf = ([x, y]: Vec): Vec => {
    const sx = x * a.size * fx;
    const sy = y * a.size * fy;
    return [sx * cos - sy * sin + a.offsetX, sx * sin + sy * cos + a.offsetY];
  };
  const screen = a.anchor === 'screen';
  const out: Prim[] = [];
  const mirrored = a.flipX !== a.flipY;
  for (const q of geo.quads) {
    let p = q.map(tf) as [Vec, Vec, Vec, Vec];
    // Mirroring reverses the winding; keep tl→tr→br→bl order consistent.
    if (mirrored) p = [p[1], p[0], p[3], p[2]];
    out.push({ kind: 'quad', p, src: 'artwork', screen });
  }
  for (const [s, e] of geo.segments) out.push({ kind: 'line', a: tf(s), b: tf(e), src: 'artwork', screen });
  return out;
}

/** Tight bounding box of the placed artwork (ignores offset), or null when nothing is drawn. */
export function artworkBounds(geo: ArtGeometry, a: ArtworkSettings) {
  const prims = placeArtwork(geo, { ...a, offsetX: 0, offsetY: 0 });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of prims) {
    const pts = p.kind === 'quad' ? p.p : p.kind === 'line' ? [p.a, p.b] : [];
    for (const [x, y] of pts) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/**
 * Offsets that put the artwork in a quadrant next to the crosshair, its nearest corner
 * `gap` away from both centre lines (gap in the artwork's own unit).
 */
export function presetOffset(geo: ArtGeometry, a: ArtworkSettings, preset: ArtPreset, gap: number): { offsetX: number; offsetY: number } {
  const b = artworkBounds(geo, a);
  if (!b || preset === 'center') return { offsetX: 0, offsetY: 0 };
  const right = preset === 'topRight' || preset === 'bottomRight';
  const top = preset === 'topRight' || preset === 'topLeft';
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return {
    offsetX: round(right ? gap - b.minX : -gap - b.maxX),
    offsetY: round(top ? -gap - b.maxY : gap - b.minY),
  };
}

/** Gap between the artwork and the centre lines for corner presets, per anchor unit. */
export const PRESET_GAP = { screen: 0.012, mils: 1.5 } as const;

/** Artwork settings with preset-derived offsets filled in (what actually gets exported). */
export function resolveArtwork(geo: ArtGeometry, a: ArtworkSettings): ArtworkSettings {
  if (!a.preset) return a;
  return { ...a, ...presetOffset(geo, a, a.preset, PRESET_GAP[a.anchor]) };
}
