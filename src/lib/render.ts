import { approxDropMils, distanceList } from '../core/sight/compile';
import type { ArtworkSettings, ElementsConfig, Prim, RGBA, SightGlobals } from '../core/sight/model';
import { MILS_PER_RAD } from '../core/sight/model';
import { drawScene, type SceneKind, type View } from './scenes';

export interface PreviewOptions {
  scene: SceneKind;
  /** Vertical field of view of the simulated sight, in mils. */
  fovMils: number;
  panX: number;
  panY: number;
  grid: boolean;
  centerMark: boolean;
  showSource: boolean;
  sourceOpacity: number;
  light: boolean;
  mask: boolean;
}

export interface RenderInput {
  prims: Prim[];
  globals: SightGlobals;
  elements: ElementsConfig;
  artwork: ArtworkSettings;
  source: HTMLImageElement | null;
  opts: PreviewOptions;
}

const rgba = (c: RGBA) => `rgba(${c[0]},${c[1]},${c[2]},${(c[3] / 255).toFixed(3)})`;

/** Cache of batched Path2D objects (in mils) per primitive list — thousands of quads stay cheap to redraw. */
const pathCache = new WeakMap<Prim[], { quads: Path2D; lines: Path2D }>();
function batched(prims: Prim[]) {
  let c = pathCache.get(prims);
  if (!c) {
    const quads = new Path2D();
    const lines = new Path2D();
    for (const p of prims) {
      if (p.kind === 'quad') {
        quads.moveTo(p.p[0][0], p.p[0][1]);
        for (let i = 1; i < 4; i++) quads.lineTo(p.p[i][0], p.p[i][1]);
        quads.closePath();
      } else if (p.kind === 'line') {
        lines.moveTo(p.a[0], p.a[1]);
        lines.lineTo(p.b[0], p.b[1]);
      }
    }
    c = { quads, lines };
    pathCache.set(prims, c);
  }
  return c;
}

export function niceStep(ppm: number, minPx: number) {
  for (const s of [0.5, 1, 2, 4, 5, 10, 20, 50, 100, 200]) if (s * ppm >= minPx) return s;
  return 500;
}

export function renderPreview(ctx: CanvasRenderingContext2D, w: number, h: number, inp: RenderInput) {
  const { opts, globals: g } = inp;
  const ppm = h / opts.fovMils;
  const milsPerRad = MILS_PER_RAD[g.thousandth];
  const view: View = { w, h, cx: w / 2, cy: h / 2, ppm, panX: opts.panX, panY: opts.panY, milsPerRad };
  // Screen-fraction units (used by the native range scale) are approximated as fractions of screen height.
  const unit = h;
  const scale = h / 1080;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  drawScene(ctx, opts.scene, view);

  const toMils = () => ctx.setTransform(ppm, 0, 0, ppm, w / 2, h / 2);

  // Original image as an underlay, placed exactly like the traced artwork.
  if (opts.showSource && inp.source && inp.artwork.enabled) {
    const a = inp.artwork;
    const iw = inp.source.naturalWidth;
    const ih = inp.source.naturalHeight;
    const side = Math.max(iw, ih);
    toMils();
    ctx.save();
    ctx.translate(a.offsetX, a.offsetY);
    ctx.rotate((a.rotation * Math.PI) / 180);
    ctx.scale((a.flipX ? -1 : 1) * (a.size / side), (a.flipY ? -1 : 1) * (a.size / side));
    ctx.globalAlpha = opts.sourceOpacity;
    ctx.drawImage(inp.source, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Mil grid.
  if (opts.grid) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const step = niceStep(ppm, 36 * scale + 18);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120,220,255,.18)';
    ctx.fillStyle = 'rgba(160,230,255,.75)';
    ctx.font = `${Math.round(10 + 6 * scale)}px "JetBrains Mono", ui-monospace, monospace`;
    const nx = Math.ceil(w / 2 / (step * ppm));
    const ny = Math.ceil(h / 2 / (step * ppm));
    ctx.beginPath();
    for (let i = -nx; i <= nx; i++) {
      const x = Math.round(w / 2 + i * step * ppm) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let j = -ny; j <= ny; j++) {
      const y = Math.round(h / 2 + j * step * ppm) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = -nx; i <= nx; i += 2) if (i) ctx.fillText(String(i * step), w / 2 + i * step * ppm + 3, h / 2 + 3);
    for (let j = -ny; j <= ny; j += 2) if (j) ctx.fillText(String(j * step), w / 2 + 3, h / 2 + j * step * ppm + 3);
  }

  // The sight itself.
  const color = rgba(opts.light ? g.lightColor : g.color);
  const lineW = Math.max(1, 1.6 * scale) * g.lineSizeMult;
  const { quads, lines } = batched(inp.prims);
  toMils();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'butt';
  ctx.fill(quads);
  ctx.lineWidth = lineW / ppm;
  ctx.stroke(lines);

  for (const p of inp.prims) {
    if (p.kind === 'circle') {
      ctx.lineWidth = (Math.max(0.5, p.size) * lineW * 0.8) / ppm;
      ctx.beginPath();
      const full = Math.abs(p.segment[1] - p.segment[0]) >= 360;
      const a0 = ((p.segment[0] - 90) * Math.PI) / 180;
      const a1 = ((p.segment[1] - 90) * Math.PI) / 180;
      ctx.arc(p.pos[0], p.pos[1], p.diameter / 2, full ? 0 : a0, full ? Math.PI * 2 : a1);
      ctx.stroke();
    }
  }

  // Texts are screen-sized in game; draw them in pixel space at their mil position.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textBaseline = 'middle';
  for (const p of inp.prims) {
    if (p.kind !== 'text') continue;
    ctx.font = `600 ${Math.max(9, 26 * p.size * g.fontSizeMult * scale)}px Rajdhani, "Arial Narrow", sans-serif`;
    ctx.textAlign = p.align === 1 ? 'left' : p.align === 2 ? 'right' : 'center';
    ctx.fillText(p.text, w / 2 + p.pos[0] * ppm, h / 2 + p.pos[1] * ppm);
  }

  // Native ballistic range scale (approximation: vacuum trajectory, positions from the game's screen units).
  const dt = inp.elements.distanceTicks;
  if (dt.enabled) {
    const x0 = w / 2 + dt.posX * unit;
    ctx.lineWidth = lineW;
    ctx.font = `600 ${Math.max(9, 22 * g.fontSizeMult * scale)}px Rajdhani, "Arial Narrow", sans-serif`;
    ctx.textAlign = 'right';
    for (const [d, label] of distanceList(dt)) {
      const drop = approxDropMils(d, Math.max(100, dt.previewSpeed), milsPerRad);
      const y = h / 2 + (dt.drawUpward ? -drop : drop) * ppm;
      if (y < -20 || y > h + 20) continue;
      const len = dt.tickLength * unit * (label ? 1.5 : 1);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + len, y);
      ctx.stroke();
      if (label) ctx.fillText(String(label), x0 - 4 * scale - 2, y);
    }
  }

  if (opts.mask) {
    ctx.fillStyle = 'rgba(0,0,0,.92)';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.49, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
  }

  if (opts.centerMark) {
    ctx.strokeStyle = 'rgba(0,229,255,.9)';
    ctx.lineWidth = Math.max(1, scale * 1.5);
    const r = 7 * Math.max(1, scale);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.moveTo(w / 2 - r * 1.8, h / 2);
    ctx.lineTo(w / 2 - r * 0.6, h / 2);
    ctx.moveTo(w / 2 + r * 0.6, h / 2);
    ctx.lineTo(w / 2 + r * 1.8, h / 2);
    ctx.stroke();
  }
}
