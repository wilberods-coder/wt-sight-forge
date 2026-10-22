/**
 * Procedural terrain backgrounds for the preview, drawn in "mils space" so they zoom
 * together with the reticle. Ground features at distance d sit h/d radians below the horizon
 * (camera height h), so the scene has correct perspective and the target tanks have their
 * true angular size — useful to check rangefinder scales.
 */
export type SceneKind = 'steppe' | 'forest' | 'desert' | 'winter' | 'night' | 'gray';
export const SCENES: SceneKind[] = ['steppe', 'forest', 'desert', 'winter', 'night', 'gray'];

export interface View {
  w: number;
  h: number;
  cx: number;
  cy: number;
  ppm: number; // device px per mil
  panX: number;
  panY: number;
  milsPerRad: number;
}

interface Palette {
  skyTop: string;
  skyBottom: string;
  far: string;
  mid: string;
  groundFar: string;
  groundNear: string;
  feature: string;
  tank: string;
  stars?: boolean;
}

const PALETTES: Record<SceneKind, Palette> = {
  steppe: { skyTop: '#5d86b5', skyBottom: '#c9d6df', far: '#8a9a9e', mid: '#6f7d58', groundFar: '#9a9563', groundNear: '#6e6a3f', feature: '#4f5a33', tank: '#2b2f26' },
  forest: { skyTop: '#6f8fae', skyBottom: '#d3dbe0', far: '#5f7364', mid: '#2f4a2f', groundFar: '#5c6b3c', groundNear: '#3f4a29', feature: '#263a22', tank: '#22251e' },
  desert: { skyTop: '#7aa3cc', skyBottom: '#f0e2c8', far: '#c9a77c', mid: '#b98f5d', groundFar: '#dcc092', groundNear: '#b99460', feature: '#8d6b3f', tank: '#4a3b28' },
  winter: { skyTop: '#8ea2b8', skyBottom: '#e6ebf0', far: '#aab6c2', mid: '#7d8a84', groundFar: '#eef2f5', groundNear: '#d4dbe2', feature: '#59645e', tank: '#3a3f42' },
  night: { skyTop: '#05080d', skyBottom: '#1a2433', far: '#141c26', mid: '#0f1610', groundFar: '#1a2216', groundNear: '#10150d', feature: '#0a0e08', tank: '#050605', stars: true },
  gray: { skyTop: '#5b6470', skyBottom: '#7a838f', far: '#6c7480', mid: '#666e79', groundFar: '#6a727d', groundNear: '#5d646e', feature: '#4b5159', tank: '#2a2e33' },
};

const HORIZON = 4; // mils below the aim point
const CAM_HEIGHT = 2.6; // metres
export const TARGETS = [
  { d: 400, x: -55 },
  { d: 800, x: 18 },
  { d: 1500, x: 70 },
];

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Smooth 1D value noise for hill silhouettes. */
function ridge(seed: number) {
  const r = rng(seed);
  const pts = Array.from({ length: 256 }, () => r());
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = pts[((i % 256) + 256) % 256];
    const b = pts[(((i + 1) % 256) + 256) % 256];
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  };
}

const features = new Map<SceneKind, { x: number; d: number; s: number; kind: number }[]>();
function featureList(kind: SceneKind) {
  if (!features.has(kind)) {
    const r = rng(kind.length * 977 + 13);
    features.set(
      kind,
      Array.from({ length: 220 }, () => ({ x: (r() - 0.5) * 1600, d: 60 + Math.pow(r(), 1.6) * 2600, s: 0.5 + r(), kind: Math.floor(r() * 3) })),
    );
  }
  return features.get(kind)!;
}

const ridges = { far: ridge(11), mid: ridge(29) };

export function drawScene(ctx: CanvasRenderingContext2D, kind: SceneKind, v: View) {
  const p = PALETTES[kind];
  const toX = (mx: number) => v.cx + (mx + v.panX) * v.ppm;
  const toY = (my: number) => v.cy + (my + v.panY) * v.ppm;
  const hy = toY(HORIZON);

  const sky = ctx.createLinearGradient(0, Math.min(0, hy - v.h), 0, hy);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(1, p.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, v.w, Math.max(0, Math.min(v.h, hy + 1)));

  if (p.stars) {
    const r = rng(5);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < 160; i++) {
      const x = toX((r() - 0.5) * 1600);
      const y = toY(HORIZON - 5 - r() * 300);
      if (x > 0 && x < v.w && y > 0 && y < hy) ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  if (hy < v.h) {
    const g = ctx.createLinearGradient(0, hy, 0, Math.max(hy + 1, v.h));
    g.addColorStop(0, p.groundFar);
    g.addColorStop(1, p.groundNear);
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.max(0, hy), v.w, v.h - Math.max(0, hy));
  }

  // Hills: far ridge and a nearer treeline / dune line.
  const minMx = -v.cx / v.ppm - v.panX;
  const maxMx = (v.w - v.cx) / v.ppm - v.panX;
  const step = Math.max(0.5, 3 / v.ppm);
  const silhouette = (fn: (x: number) => number, scale: number, height: number, base: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(toX(minMx) - 2, toY(HORIZON + base));
    for (let mx = minMx; mx <= maxMx + step; mx += step) ctx.lineTo(toX(mx), toY(HORIZON + base - fn(mx / scale) * height));
    ctx.lineTo(toX(maxMx) + 2, toY(HORIZON + base));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  if (kind !== 'gray') {
    silhouette(ridges.far, 60, kind === 'desert' ? 6 : 10, 0.3, p.far);
    silhouette((x) => ridges.mid(x) * (0.6 + 0.4 * ridges.far(x * 3)), kind === 'forest' ? 4 : 18, kind === 'forest' ? 7 : 3.5, 0.6, p.mid);
  }

  // Ground features (bushes, rocks) with perspective.
  if (kind !== 'gray') {
    ctx.fillStyle = p.feature;
    for (const f of featureList(kind)) {
      const y = HORIZON + (CAM_HEIGHT / f.d) * v.milsPerRad;
      const size = ((f.s * 2.2) / f.d) * v.milsPerRad;
      const sx = toX(f.x);
      const sy = toY(y);
      const r = size * v.ppm;
      if (sx < -r || sx > v.w + r || sy < -r || sy > v.h + r) continue;
      ctx.beginPath();
      if (f.kind === 0) ctx.ellipse(sx, sy - r * 0.4, r, r * 0.6, 0, 0, Math.PI * 2);
      else if (f.kind === 1) ctx.ellipse(sx, sy - r * 0.2, r * 0.7, r * 0.3, 0, 0, Math.PI * 2);
      else {
        ctx.moveTo(sx - r * 0.5, sy);
        ctx.lineTo(sx, sy - r * 1.6);
        ctx.lineTo(sx + r * 0.5, sy);
      }
      ctx.fill();
    }
  }

  // Target tanks: 6.8 m long, 2.4 m tall.
  for (const t of TARGETS) {
    const k = v.milsPerRad / t.d;
    const baseY = HORIZON + CAM_HEIGHT * k;
    const L = 6.8 * k;
    const H = 2.4 * k;
    const x0 = t.x - L / 2;
    const P = (fx: number, fy: number): [number, number] => [toX(x0 + fx * L), toY(baseY - fy * H)];
    const hull: [number, number][] = [P(0.04, 0), P(0.96, 0), P(1, 0.25), P(0.95, 0.55), P(0.05, 0.55), P(0, 0.25)];
    const turret: [number, number][] = [P(0.3, 0.55), P(0.68, 0.55), P(0.64, 1), P(0.36, 1)];
    const gun: [number, number][] = [P(0.66, 0.8), P(1.18, 0.82), P(1.18, 0.74), P(0.66, 0.7)];
    ctx.fillStyle = p.tank;
    for (const poly of [hull, turret, gun]) {
      ctx.beginPath();
      poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    }
  }
}
